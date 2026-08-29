// src-tauri/src/vst3/commands/instance.rs

use tauri::State;
use super::super::types::{CreateInstanceResult, InitializeResult};
use super::super::registry::{make_instance_id, ComponentInstance, InstanceInfo, Vst3Registry};
use super::super::cid::parse_cid;

#[cfg(target_os = "windows")]
use crate::vst3_com::funknown;
#[cfg(target_os = "windows")]
use crate::vst3_com::funknown::IID_FUNKNOWN;
#[cfg(target_os = "windows")]
use crate::vst3_com::ifactory;
#[cfg(target_os = "windows")]
use crate::vst3_com::icomponent::IID_ICOMPONENT;
#[cfg(target_os = "windows")]
use crate::vst3_com::iplugin_base;

#[tauri::command]
pub fn vst3_create_instance(
    plugin_key:  String,
    class_cid:   String,
    instance_id: Option<String>,
    registry:    State<'_, Vst3Registry>,
) -> CreateInstanceResult {
    #[cfg(target_os = "windows")]
    {
        let cid_bytes = match parse_cid(&class_cid) {
            Some(b) => b,
            None => return CreateInstanceResult {
                success: false,
                message: format!("CID inválido: {}", class_cid),
                instance_id: None, component_ptr: None, class_cid,
            },
        };

        let factory_ptr = match registry.with_plugin(&plugin_key, |p| p.factory_ptr) {
            Some(ptr) => ptr,
            None => return CreateInstanceResult {
                success: false,
                message: format!("Plugin no cargado: {}", plugin_key),
                instance_id: None, component_ptr: None, class_cid,
            },
        };

        if factory_ptr == 0 {
            return CreateInstanceResult {
                success: false, message: "factory_ptr es NULL".into(),
                instance_id: None, component_ptr: None, class_cid,
            };
        }

        let component_ptr = unsafe {
            match ifactory::create_instance(
                factory_ptr as *mut _,
                &cid_bytes,
                &IID_ICOMPONENT,
            ) {
                Ok(ptr) => ptr,
                Err(hr) => {
                    // Fallback para plugins (ej: Auto-Tune Pro) que no soportan IID_ICOMPONENT
                    // directamente en createInstance y requieren IID_FUNKNOWN + QueryInterface.
                    match ifactory::create_instance(
                        factory_ptr as *mut _,
                        &cid_bytes,
                        &IID_FUNKNOWN,
                    ) {
                        Ok(raw_ptr) => {
                            match funknown::query_interface(raw_ptr, &IID_ICOMPONENT) {
                                Ok(comp) => {
                                    funknown::release(raw_ptr);
                                    comp
                                }
                                Err(q_hr) => {
                                    funknown::release(raw_ptr);
                                    return CreateInstanceResult {
                                        success: false,
                                        message: format!(
                                            "createInstance falló: 0x{:08X} (QI IComponent: 0x{:08X})",
                                            hr as u32, q_hr as u32
                                        ),
                                        instance_id: None, component_ptr: None, class_cid,
                                    };
                                }
                            }
                        }
                        Err(_) => return CreateInstanceResult {
                            success: false,
                            message: format!("createInstance falló: 0x{:08X}", hr as u32),
                            instance_id: None, component_ptr: None, class_cid,
                        },
                    }
                }
            }
        };

        let component_addr = component_ptr as usize;
        let component_hex  = format!("0x{:016x}", component_addr);
        let target_instance_id = instance_id.unwrap_or_else(make_instance_id);

        let registered = registry.with_plugin_mut(&plugin_key, |p| {
            p.instances.insert(
                target_instance_id.clone(),
                ComponentInstance::new(component_addr, class_cid.clone()),
            );
            p.instances.len()
        });

        if registered.is_none() {
            unsafe {
                funknown::release(component_ptr);
            }
            return CreateInstanceResult {
                success: false, message: "Plugin desaparecido durante createInstance".into(),
                instance_id: None, component_ptr: None, class_cid,
            };
        }

        CreateInstanceResult {
            success: true,
            message: "Instancia creada".into(),
            instance_id: Some(target_instance_id),
            component_ptr: Some(component_hex),
            class_cid,
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, class_cid, instance_id, registry);
        CreateInstanceResult {
            success: false, message: "Plataforma no soportada".into(),
            instance_id: None, component_ptr: None, class_cid,
        }
    }
}

#[tauri::command]
pub fn vst3_release_instance(
    plugin_key:  String,
    instance_id: String,
    registry:    State<'_, Vst3Registry>,
) -> bool {
    #[cfg(target_os = "windows")]
    {
        let removed = registry.with_plugin_mut(&plugin_key, |p| {
            p.instances.remove(&instance_id)
        }).flatten();

        match removed {
            Some(mut inst) => {
                unsafe { inst.teardown(); }
                true
            }
            None => false,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, instance_id, registry);
        false
    }
}

#[tauri::command]
pub fn vst3_list_instances(
    plugin_key: String,
    registry:   State<'_, Vst3Registry>,
) -> Vec<InstanceInfo> {
    #[cfg(target_os = "windows")]
    {
        registry.with_plugin(&plugin_key, |p| {
            p.instances.iter().map(|(id, inst)| inst.to_info(id)).collect()
        }).unwrap_or_default()
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, registry);
        Vec::new()
    }
}

#[tauri::command]
pub fn vst3_initialize_instance(
    plugin_key:  String,
    instance_id: String,
    registry:    State<'_, Vst3Registry>,
) -> InitializeResult {
    #[cfg(target_os = "windows")]
    {
        use crate::vst3_com::iplugin_base::IID_IPLUGIN_BASE;
        use crate::vst3_host_context::DawnHost;

        let component_ptr = match registry.with_plugin(&plugin_key, |p| {
            p.instances.get(&instance_id).map(|inst| (inst.component_ptr, inst.initialized))
        }).flatten() {
            Some((ptr, already_init)) => {
                if already_init {
                    return InitializeResult {
                        success: true,
                        message: "La instancia ya está inicializada".into(),
                        hresult: 0, plugin_base_ptr: None, host_context_ptr: None,
                    };
                }
                if ptr == 0 {
                    return InitializeResult {
                        success: false, message: "component_ptr es NULL".into(),
                        hresult: -1, plugin_base_ptr: None, host_context_ptr: None,
                    };
                }
                ptr
            }
            None => return InitializeResult {
                success: false, message: format!("Instancia no encontrada: {}", instance_id),
                hresult: -1, plugin_base_ptr: None, host_context_ptr: None,
            },
        };

        let plugin_base_ptr = unsafe {
            match funknown::query_interface(component_ptr as *mut _, &IID_IPLUGIN_BASE) {
                Ok(ptr) => ptr,
                Err(hr) => return InitializeResult {
                    success: false, message: format!("IPluginBase error: 0x{:08X}", hr as u32),
                    hresult: hr, plugin_base_ptr: None, host_context_ptr: None,
                },
            }
        };

        let plugin_base_addr = plugin_base_ptr as usize;
        let host_ptr = DawnHost::get_singleton_ptr();
        let host_addr = host_ptr as usize;

        let hr = unsafe { iplugin_base::initialize(plugin_base_ptr, host_ptr) };
        if hr != 0 {
            unsafe { funknown::release(plugin_base_ptr); }
            return InitializeResult {
                success: false, message: format!("initialize error: 0x{:08X}", hr as u32),
                hresult: hr, plugin_base_ptr: None, host_context_ptr: Some(format!("0x{:016x}", host_addr)),
            };
        }

        let stored = registry.with_plugin_mut(&plugin_key, |p| {
            if let Some(inst) = p.instances.get_mut(&instance_id) {
                inst.plugin_base_ptr = plugin_base_addr;
                inst.initialized = true;
                true
            } else { false }
        }).unwrap_or(false);

        if !stored {
            unsafe {
                let _ = iplugin_base::terminate(plugin_base_ptr);
                funknown::release(plugin_base_ptr);
            }
            return InitializeResult {
                success: false, message: "Instancia desapareció".into(),
                hresult: 0, plugin_base_ptr: None, host_context_ptr: Some(format!("0x{:016x}", host_addr)),
            };
        }

        InitializeResult {
            success: true, message: "Instancia inicializada OK".into(),
            hresult: 0,
            plugin_base_ptr: Some(format!("0x{:016x}", plugin_base_addr)),
            host_context_ptr: Some(format!("0x{:016x}", host_addr)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, instance_id, registry);
        InitializeResult {
            success: false, message: "Plataforma no soportada".into(),
            hresult: -1, plugin_base_ptr: None, host_context_ptr: None,
        }
    }
}

#[tauri::command]
pub fn vst3_terminate_instance(
    plugin_key:  String,
    instance_id: String,
    registry:    State<'_, Vst3Registry>,
) -> bool {
    #[cfg(target_os = "windows")]
    {
        let plugin_base_ptr = registry.with_plugin_mut(&plugin_key, |p| {
            let inst = p.instances.get_mut(&instance_id)?;
            if !inst.initialized || inst.plugin_base_ptr == 0 { return None; }
            let ptr = inst.plugin_base_ptr;
            inst.plugin_base_ptr = 0;
            inst.initialized = false;
            Some(ptr)
        }).flatten();

        match plugin_base_ptr {
            Some(ptr) => {
                unsafe {
                    let _ = iplugin_base::terminate(ptr as *mut _);
                    let _ = funknown::release(ptr as *mut _);
                }
                true
            }
            None => false,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, instance_id, registry);
        false
    }
}