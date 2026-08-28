// src-tauri/src/vst3/audio/activate.rs

use tauri::State;
use crate::vst3::registry::Vst3Registry;
use crate::vst3::audio::processor_factory::obtain_and_init_audio_processor;
use crate::vst3_com::iaudio_processor::{self, ProcessSetup};
use crate::vst3_com::funknown;
use crate::vst3_com::icomponent::{
    BUS_DIRECTION_INPUT, BUS_DIRECTION_OUTPUT, MEDIA_TYPE_AUDIO, IComponent,
};

#[derive(Debug, serde::Serialize)]
pub struct ActivateProcessingResult {
    pub success: bool,
    pub message: String,
    pub processor_ptr: Option<String>,
    pub latency_samples: u32,
    pub sample_rate: f64,
    pub max_block_size: i32,
}

#[tauri::command]
pub fn vst3_activate_processing(
    plugin_key: String,
    instance_id: String,
    sample_rate: f64,
    max_block_size: i32,
    registry: State<'_, Vst3Registry>,
) -> ActivateProcessingResult {
    #[cfg(target_os = "windows")]
    {
        let max_block = if max_block_size <= 0 { 512 } else { max_block_size };
        let sr = if sample_rate <= 0.0 { 48000.0 } else { sample_rate };

        let (component_ptr, factory_ptr, class_cid) = match registry.with_plugin(&plugin_key, |p| {
            p.instances.get(&instance_id).map(|i| {
                (
                    i.component_ptr,
                    p.factory_ptr,
                    i.class_cid.clone(),
                    i.initialized,
                    i.processor_ptr,
                    i.processing_active,
                )
            })
        }).flatten() {
            Some((_, _, _, true, proc, true)) if proc != 0 => {
                return ActivateProcessingResult {
                    success: true,
                    message: "Processing ya activo".into(),
                    processor_ptr: Some(format!("0x{:016x}", proc)),
                    latency_samples: unsafe {
                        iaudio_processor::get_latency_samples(proc as *mut _)
                    },
                    sample_rate: sr,
                    max_block_size: max_block,
                };
            }
            Some((c, fac, cid, true, _, _)) if c != 0 => (c, fac, cid),
            Some((_, _, _, false, _, _)) => {
                return ActivateProcessingResult {
                    success: false,
                    message: "Instancia no inicializada".into(),
                    processor_ptr: None,
                    latency_samples: 0,
                    sample_rate: sr,
                    max_block_size: max_block,
                };
            }
            _ => {
                return ActivateProcessingResult {
                    success: false,
                    message: "Instancia no encontrada".into(),
                    processor_ptr: None,
                    latency_samples: 0,
                    sample_rate: sr,
                    max_block_size: max_block,
                };
            }
        };

        // 1. Obtener E INICIALIZAR IAudioProcessor (Single o Split Component)
        let processor_ptr = unsafe {
            match obtain_and_init_audio_processor(component_ptr as *mut _, factory_ptr, &class_cid) {
                Ok(ptr) => ptr,
                Err(err_msg) => {
                    return ActivateProcessingResult {
                        success: false,
                        message: err_msg,
                        processor_ptr: None,
                        latency_samples: 0,
                        sample_rate: sr,
                        max_block_size: max_block,
                    };
                }
            }
        };

        // 2. Validar Float32
        if !unsafe { iaudio_processor::can_process_f32(processor_ptr) } {
            if processor_ptr != component_ptr as *mut _ {
                unsafe { funknown::release(processor_ptr); }
            }
            return ActivateProcessingResult {
                success: false,
                message: "Plugin no soporta Sample32 (Float32)".into(),
                processor_ptr: None,
                latency_samples: 0,
                sample_rate: sr,
                max_block_size: max_block,
            };
        }

        // 3. Configurar bus estéreo
        let _ = unsafe { iaudio_processor::set_bus_arrangements_stereo(processor_ptr) };

        // 4. Activar buses de audio principales
        unsafe {
            activate_main_audio_buses(component_ptr as *mut _);
            if processor_ptr != component_ptr as *mut _ {
                activate_main_audio_buses(processor_ptr);
            }
        }

        // 5. setupProcessing
        let mut setup = ProcessSetup::realtime_f32(sr, max_block);
        let hr_setup = unsafe { iaudio_processor::setup_processing(processor_ptr, &mut setup) };
        if hr_setup != 0 {
            if processor_ptr != component_ptr as *mut _ {
                unsafe { funknown::release(processor_ptr); }
            }
            return ActivateProcessingResult {
                success: false,
                message: format!("setupProcessing falló: 0x{:08X}", hr_setup as u32),
                processor_ptr: None,
                latency_samples: 0,
                sample_rate: sr,
                max_block_size: max_block,
            };
        }

        // 6. Activar componente y procesador
        unsafe {
            let _ = set_component_active(component_ptr as *mut _, true);
            if processor_ptr != component_ptr as *mut _ {
                let _ = set_component_active(processor_ptr, true);
            }
        }

        // 7. setProcessing(true)
        let hr_proc = unsafe { iaudio_processor::set_processing(processor_ptr, true) };
        if hr_proc != 0 {
            unsafe {
                let _ = set_component_active(component_ptr as *mut _, false);
                if processor_ptr != component_ptr as *mut _ {
                    funknown::release(processor_ptr);
                }
            }
            return ActivateProcessingResult {
                success: false,
                message: format!("setProcessing falló: 0x{:08X}", hr_proc as u32),
                processor_ptr: None,
                latency_samples: 0,
                sample_rate: sr,
                max_block_size: max_block,
            };
        }

        let latency = unsafe { iaudio_processor::get_latency_samples(processor_ptr) };
        let proc_addr = processor_ptr as usize;

        registry.with_plugin_mut(&plugin_key, |p| {
            if let Some(inst) = p.instances.get_mut(&instance_id) {
                inst.processor_ptr = proc_addr;
                inst.processing_active = true;
                inst.sample_rate = sr;
                inst.max_block_size = max_block;
            }
        });

        ActivateProcessingResult {
            success: true,
            message: "Processing activo OK!".into(),
            processor_ptr: Some(format!("0x{:016x}", proc_addr)),
            latency_samples: latency,
            sample_rate: sr,
            max_block_size: max_block,
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, instance_id, sample_rate, max_block_size, registry);
        ActivateProcessingResult {
            success: false,
            message: "Solo Windows".into(),
            processor_ptr: None,
            latency_samples: 0,
            sample_rate: 0.0,
            max_block_size: 0,
        }
    }
}

#[cfg(target_os = "windows")]
unsafe fn activate_main_audio_buses(component: *mut core::ffi::c_void) {
    if component.is_null() { return; }
    let comp = component as *mut IComponent;
    let vt = (*comp).vtable;
    if vt.is_null() { return; }
    let _ = ((*vt).activate_bus)(component, MEDIA_TYPE_AUDIO, BUS_DIRECTION_INPUT, 0, 1);
    let _ = ((*vt).activate_bus)(component, MEDIA_TYPE_AUDIO, BUS_DIRECTION_OUTPUT, 0, 1);
}

#[cfg(target_os = "windows")]
unsafe fn set_component_active(component: *mut core::ffi::c_void, active: bool) -> i32 {
    if component.is_null() { return -1; }
    let comp = component as *mut IComponent;
    let vt = (*comp).vtable;
    if vt.is_null() { return -1; }
    ((*vt).set_active)(component, if active { 1 } else { 0 })
}