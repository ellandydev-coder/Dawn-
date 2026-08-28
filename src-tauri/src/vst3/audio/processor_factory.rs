// src-tauri/src/vst3/audio/processor_factory.rs
//
// Responsabilidad única: Obtener e INICIALIZAR el objeto IAudioProcessor
// respetando la especificación VST3 para Single-Component y Split-Component.

use std::os::raw::c_void;
use crate::vst3_com::{funknown, ifactory, iplugin_base, iconnection_point};
use crate::vst3_com::iaudio_processor::IID_IAUDIO_PROCESSOR;
use crate::vst3_host_context::DawnHost;
use crate::vst3::cid::parse_cid;

#[cfg(target_os = "windows")]
pub unsafe fn obtain_and_init_audio_processor(
    component_ptr: *mut c_void,
    factory_ptr: usize,
    class_cid: &str,
) -> Result<*mut c_void, String> {
    if component_ptr.is_null() {
        return Err("component_ptr es NULL".into());
    }

    // 1. Single-Component: El IComponent ya implementa IAudioProcessor y ya fue inicializado
    if let Ok(proc_ptr) = funknown::query_interface(component_ptr, &IID_IAUDIO_PROCESSOR) {
        log::info!("[processor_factory] IAudioProcessor obtenido vía QueryInterface (Single-Component)");
        return Ok(proc_ptr);
    }

    // 2. Split-Component (Auto-Tune Pro, Waves): Crear procesador independiente desde la fábrica
    if factory_ptr == 0 {
        return Err("QueryInterface falló y factory_ptr es NULL".into());
    }

    let cid_bytes = parse_cid(class_cid)
        .ok_or_else(|| format!("CID inválido: {}", class_cid))?;

    let proc_ptr = match ifactory::create_instance(factory_ptr as *mut _, &cid_bytes, &IID_IAUDIO_PROCESSOR) {
        Ok(ptr) => ptr,
        Err(hr) => {
            return Err(format!(
                "QI IAudioProcessor y createInstance(IAudioProcessor) fallaron: 0x{:08X}",
                hr as u32
            ));
        }
    };

    // PASO CRÍTICO: Si la fábrica creó un objeto C++ independiente, DEBE inicializarse con IPluginBase::initialize
    let host_ptr = DawnHost::get_singleton_ptr();
    if let Ok(base_ptr) = funknown::query_interface(proc_ptr, &iplugin_base::IID_IPLUGIN_BASE) {
        let hr_init = iplugin_base::initialize(base_ptr, host_ptr);
        funknown::release(base_ptr);
        if hr_init != 0 {
            funknown::release(proc_ptr);
            return Err(format!("initialize() en IAudioProcessor falló: 0x{:08X}", hr_init as u32));
        }
    }

    // Conectar puertos peer-to-peer entre el Componente y el Procesador (si el plugin lo requiere)
    let _ = iconnection_point::connect_peers(component_ptr, proc_ptr);

    log::info!("[processor_factory] IAudioProcessor creado e inicializado OK (Split-Component)");
    Ok(proc_ptr)
}