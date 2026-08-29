// src-tauri/src/vst3/commands/editor.rs

use tauri::{AppHandle, Manager, State};
use super::super::types::OpenEditorResult;
use super::super::registry::{EditorInstance, Vst3Registry};
use super::super::editor::{
    create_popup_plugin_window, create_controller_from_component, update_editor_position,
    destroy_window, show_window,
};

#[tauri::command]
pub fn vst3_open_editor(
    app: AppHandle,
    plugin_key: String,
    instance_id: String,
    x: Option<i32>,
    y: Option<i32>,
    width: Option<i32>,
    height: Option<i32>,
    _registry: State<'_, Vst3Registry>,
) -> OpenEditorResult {
    let pos_x = x.unwrap_or(0);
    let pos_y = y.unwrap_or(0);
    let pos_w = width.unwrap_or(800);
    let pos_h = height.unwrap_or(600);

    #[cfg(target_os = "windows")]
    {
        use std::sync::mpsc::channel;
        use crate::vst3_com::{funknown, iedit_controller, iplug_view, icomponent, iaudio_processor};
        use crate::vst3_com::iaudio_processor::IID_IAUDIO_PROCESSOR;
        use crate::vst3_com::ibstream::MemoryStream;
        use crate::vst3_host_context::{DawnHost, DawnComponentHandler, DawnPlugFrame};

        let main_window = match app.get_webview_window("main") {
            Some(w) => w,
            None => {
                return OpenEditorResult {
                    success: false,
                    message: "Ventana principal 'main' no encontrada".into(),
                    hwnd: None, width: 0, height: 0,
                    controller_ptr: None, view_ptr: None,
                }
            }
        };

        let parent_hwnd = match main_window.hwnd() {
            Ok(h) => h.0 as usize,
            Err(e) => {
                return OpenEditorResult {
                    success: false,
                    message: format!("HWND main error: {}", e),
                    hwnd: None, width: 0, height: 0,
                    controller_ptr: None, view_ptr: None,
                }
            }
        };

        let app_handle = app.clone();
        let plugin_key_clone = plugin_key.clone();
        let instance_id_clone = instance_id.clone();

        let (tx, rx) = channel::<OpenEditorResult>();

        let dispatch_result = app.run_on_main_thread(move || {
            let registry = app_handle.state::<Vst3Registry>();
            let mut final_w = pos_w;
            let mut final_h = pos_h;

            let (component_ptr, factory_ptr) = match registry
                .with_plugin(&plugin_key_clone, |p| {
                    p.instances.get(&instance_id_clone).map(|inst| {
                        (
                            inst.component_ptr,
                            inst.initialized,
                            inst.editor.is_some(),
                            p.factory_ptr,
                        )
                    })
                })
                .flatten()
            {
                Some((ptr, initialized, has_editor, factory)) => {
                    if !initialized {
                        let _ = tx.send(OpenEditorResult {
                            success: false, message: "Instancia no inicializada".into(),
                            hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
                        });
                        return;
                    }
                    if has_editor {
                        unsafe {
                            update_editor_position(
                                parent_hwnd, registry.inner(),
                                &plugin_key_clone, &instance_id_clone,
                                pos_x, pos_y, final_w, final_h,
                            );
                        }
                        let _ = tx.send(OpenEditorResult {
                            success: true, message: "Editor ya abierto, reposicionado".into(),
                            hwnd: None, width: final_w, height: final_h,
                            controller_ptr: None, view_ptr: None,
                        });
                        return;
                    }
                    if ptr == 0 {
                        let _ = tx.send(OpenEditorResult {
                            success: false, message: "component_ptr es NULL".into(),
                            hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
                        });
                        return;
                    }
                    (ptr, factory)
                }
                None => {
                    let _ = tx.send(OpenEditorResult {
                        success: false,
                        message: format!("Instancia no encontrada: {}", instance_id_clone),
                        hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
                    });
                    return;
                }
            };

            let host_ptr = DawnHost::get_singleton_ptr();

            // 1. IEditController
            let controller_ptr = unsafe {
                match create_controller_from_component(
                    component_ptr as *mut _,
                    factory_ptr,
                    host_ptr,
                ) {
                    Ok(ptr) => ptr,
                    Err(e) => {
                        let _ = tx.send(OpenEditorResult {
                            success: false, message: format!("IEditController error: {}", e),
                            hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
                        });
                        return;
                    }
                }
            };

            // 2. Component Handler
            let handler_ptr = DawnComponentHandler::get_singleton_ptr();
            unsafe {
                let hr_handler = iedit_controller::set_component_handler(controller_ptr, handler_ptr);
                println!("[editor] set_component_handler hr=0x{:08X}", hr_handler as u32);
            }

            // 3. Conectar peers (split component)
            if (component_ptr as *mut core::ffi::c_void) != controller_ptr {
                unsafe {
                    use crate::vst3_com::iconnection_point;
                    let hr_peers = iconnection_point::connect_peers(component_ptr as *mut _, controller_ptr);
                    println!("[editor] connect_peers hr=0x{:08X}", hr_peers as u32);
                }
            }

            // 3b. Sync estado DSP → Controller
            unsafe {
                let stream_ptr = MemoryStream::new();
                let hr_get = icomponent::get_state(component_ptr as *mut _, stream_ptr);
                MemoryStream::seek_start(stream_ptr);
                let hr_set = iedit_controller::set_component_state(controller_ptr, stream_ptr);
                println!(
                    "[editor] getState=0x{:08X}, setComponentState=0x{:08X}",
                    hr_get as u32, hr_set as u32
                );
                MemoryStream::release_stream(stream_ptr);
            }

            // 3c. CONFIGURACIÓN DE AUDIO Y ACTIVACIÓN DE PROCESADOR
            unsafe {
                let _ = icomponent::activate_bus(component_ptr as *mut _, icomponent::MEDIA_TYPE_AUDIO, icomponent::BUS_DIRECTION_INPUT, 0, true);
                let _ = icomponent::activate_bus(component_ptr as *mut _, icomponent::MEDIA_TYPE_AUDIO, icomponent::BUS_DIRECTION_OUTPUT, 0, true);

                if let Ok(proc_ptr) = funknown::query_interface(component_ptr as *mut _, &IID_IAUDIO_PROCESSOR) {
                    let mut setup = iaudio_processor::ProcessSetup::default_48k();
                    let hr_setup = iaudio_processor::setup_processing(proc_ptr, &mut setup);
                    let hr_proc = iaudio_processor::set_processing(proc_ptr, true);
                    println!("[editor] setupProcessing hr=0x{:08X}, setProcessing hr=0x{:08X}", hr_setup as u32, hr_proc as u32);
                    funknown::release(proc_ptr);
                }

                let hr_active = icomponent::set_active(component_ptr as *mut _, true);
                println!("[editor] setActive(true) hr=0x{:08X}", hr_active as u32);
            }

            // 4. createView
            let view_ptr = unsafe {
                match iedit_controller::create_view(controller_ptr) {
                    Ok(ptr) => ptr,
                    Err(_) => std::ptr::null_mut(),
                }
            };

            if view_ptr.is_null() {
                println!("[editor] ERROR: createView devolvió NULL");
                unsafe { funknown::release(controller_ptr); }
                let _ = tx.send(OpenEditorResult {
                    success: false,
                    message: "El plugin no provee interfaz gráfica (createView devolvió NULL)".into(),
                    hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
                });
                return;
            }

            println!("[editor] createView OK (ptr=0x{:016X})", view_ptr as usize);

            // 5. IPlugFrame
            let frame_ptr = DawnPlugFrame::get_singleton_ptr();
            unsafe {
                let hr_frame = iplug_view::set_frame(view_ptr, frame_ptr);
                println!("[editor] setFrame hr=0x{:08X}", hr_frame as u32);
            }

            // 6. Tamaño preferido
            unsafe {
                let mut requested_rect = crate::vst3_com::iplug_view::ViewRect::new(0, 0);
                if iplug_view::get_size(view_ptr, &mut requested_rect) == 0 {
                    let req_w = requested_rect.right - requested_rect.left;
                    let req_h = requested_rect.bottom - requested_rect.top;
                    if req_w > 0 && req_h > 0 {
                        final_w = req_w;
                        final_h = req_h;
                    }
                }
                println!("[editor] getSize final_w={}, final_h={}", final_w, final_h);
            }

            // 7. HWND contenedor
            let child_hwnd = match create_popup_plugin_window(parent_hwnd, pos_x, pos_y, final_w, final_h) {
                Ok(h) => {
                    println!("[editor] HWND creado: 0x{:016X} pos=({},{}) size={}x{}", h, pos_x, pos_y, final_w, final_h);
                    h
                }
                Err(e) => {
                    println!("[editor] ERROR create_popup_plugin_window: {}", e);
                    unsafe {
                        funknown::release(view_ptr);
                        funknown::release(controller_ptr);
                    }
                    let _ = tx.send(OpenEditorResult {
                        success: false, message: format!("HWND error: {}", e),
                        hwnd: None, width: 0, height: 0,
                        controller_ptr: None, view_ptr: None,
                    });
                    return;
                }
            };

            // 8. attached
            let hr_attach = unsafe { iplug_view::attached(view_ptr, child_hwnd as *mut _) };
            println!("[editor] attached hr=0x{:08X}", hr_attach as u32);
            if hr_attach != 0 {
                println!("[editor] ERROR: attached falló 0x{:08X}, destruyendo HWND...", hr_attach as u32);
                unsafe {
                    funknown::release(view_ptr);
                    funknown::release(controller_ptr);
                    destroy_window(child_hwnd);
                }
                let _ = tx.send(OpenEditorResult {
                    success: false,
                    message: format!("attached error: 0x{:08X}", hr_attach as u32),
                    hwnd: None, width: 0, height: 0,
                    controller_ptr: None, view_ptr: None,
                });
                return;
            }

            // 9. onSize + show
            unsafe {
                let mut rect = crate::vst3_com::iplug_view::ViewRect::new(final_w, final_h);
                let hr_size = iplug_view::on_size(view_ptr, &mut rect);
                println!("[editor] on_size hr=0x{:08X}", hr_size as u32);
                show_window(child_hwnd);
            }

            let editor = EditorInstance {
                controller_ptr: controller_ptr as usize,
                view_ptr: view_ptr as usize,
                hwnd: child_hwnd,
                width: final_w,
                height: final_h,
            };

            registry.with_plugin_mut(&plugin_key_clone, |p| {
                if let Some(inst) = p.instances.get_mut(&instance_id_clone) {
                    inst.editor = Some(editor);
                }
            });

            let _ = tx.send(OpenEditorResult {
                success: true,
                message: format!("Editor abierto (0x{:016x})", child_hwnd),
                hwnd: Some(format!("0x{:016x}", child_hwnd)),
                width: final_w,
                height: final_h,
                controller_ptr: Some(format!("0x{:016x}", controller_ptr as usize)),
                view_ptr: Some(format!("0x{:016x}", view_ptr as usize)),
            });
        });

        if let Err(e) = dispatch_result {
            return OpenEditorResult {
                success: false,
                message: format!("No se pudo despachar al main thread: {}", e),
                hwnd: None, width: 0, height: 0,
                controller_ptr: None, view_ptr: None,
            };
        }

        match rx.recv() {
            Ok(result) => result,
            Err(_) => OpenEditorResult {
                success: false,
                message: "Canal de comunicación con main thread cerrado".into(),
                hwnd: None, width: 0, height: 0,
                controller_ptr: None, view_ptr: None,
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, plugin_key, instance_id, x, y, width, height, _registry);
        OpenEditorResult {
            success: false, message: "Plataforma no soportada".into(),
            hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
        }
    }
}

#[tauri::command]
pub fn vst3_update_editor_bounds(
    app: AppHandle,
    plugin_key: String,
    instance_id: String,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    registry: State<'_, Vst3Registry>,
) -> bool {
    #[cfg(target_os = "windows")]
    {
        let parent_hwnd = match app.get_webview_window("main") {
            Some(w) => w.hwnd().map(|h| h.0 as usize).unwrap_or(0),
            None => 0,
        };
        if parent_hwnd == 0 { return false; }
        unsafe {
            update_editor_position(
                parent_hwnd, &registry, &plugin_key, &instance_id, x, y, width, height,
            )
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, plugin_key, instance_id, x, y, width, height, registry);
        false
    }
}

#[tauri::command]
pub fn vst3_close_editor(
    app: AppHandle,
    plugin_key: String,
    instance_id: String,
    registry: State<'_, Vst3Registry>,
) -> bool {
    #[cfg(target_os = "windows")]
    {
        let editor = registry
            .with_plugin_mut(&plugin_key, |p| {
                p.instances.get_mut(&instance_id)?.editor.take()
            })
            .flatten();

        match editor {
            Some(ed) => {
                let ed_share = std::sync::Arc::new(std::sync::Mutex::new(Some(ed)));
                let ed_closure = ed_share.clone();
                let (tx, rx) = std::sync::mpsc::channel::<()>();

                let dispatch = app.run_on_main_thread(move || {
                    if let Some(mut ed) = ed_closure.lock().unwrap().take() {
                        unsafe { ed.teardown(); }
                    }
                    let _ = tx.send(());
                });

                if dispatch.is_ok() {
                    let _ = rx.recv();
                } else if let Some(mut ed) = ed_share.lock().unwrap().take() {
                    unsafe { ed.teardown(); }
                }
                true
            }
            None => false,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, plugin_key, instance_id, registry);
        false
    }
}