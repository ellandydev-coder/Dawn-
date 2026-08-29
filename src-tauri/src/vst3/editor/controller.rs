// src-tauri/src/vst3/editor/controller.rs

#[cfg(target_os = "windows")]
fn cid_hex(cid: &[u8; 16]) -> String {
    cid.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join("")
}

#[cfg(target_os = "windows")]
pub unsafe fn create_controller_from_component(
    component_ptr: *mut core::ffi::c_void,
    factory_ptr: usize,
    host_ptr: *mut core::ffi::c_void,
) -> Result<*mut core::ffi::c_void, String> {
    use crate::vst3_com::icomponent;
    use crate::vst3_com::funknown::{self, IID_FUNKNOWN};
    use crate::vst3_com::iplugin_base;
    use crate::vst3_com::ifactory::{self, IPluginFactory, PClassInfo};
    use crate::vst3_com::iedit_controller::{self, IID_IEDIT_CONTROLLER};
    use crate::vst3_com::iconnection_point;
    use crate::vst3_host_context::DawnComponentHandler;

    if factory_ptr == 0 { return Err("factory_ptr es NULL".into()); }
    if component_ptr.is_null() { return Err("component_ptr es NULL".into()); }

    println!("[controller] === create_controller_from_component ===");

    // 1. Single-Component check
    if let Ok(ctrl_ptr) = funknown::query_interface(component_ptr, &IID_IEDIT_CONTROLLER) {
        println!("[controller] Single-Component OK -> 0x{:016X}", ctrl_ptr as usize);
        let handler_ptr = DawnComponentHandler::get_singleton_ptr();
        let _ = iedit_controller::set_component_handler(ctrl_ptr, handler_ptr);
        return Ok(ctrl_ptr);
    }

    // 2. Buscar CIDs
    let mut candidate_cids: Vec<[u8; 16]> = Vec::new();

    if let Ok(cid) = icomponent::get_controller_class_id(component_ptr) {
        if cid.iter().any(|&b| b != 0) {
            println!("[controller] getControllerClassId OK -> {}", cid_hex(&cid));
            candidate_cids.push(cid);
        }
    }

    let factory = factory_ptr as *mut IPluginFactory;
    let vtable = (*factory).vtable;
    if !vtable.is_null() {
        let count = ((*vtable).count_classes)(factory_ptr as *mut _);
        for i in 0..count {
            let mut info = PClassInfo::zeroed();
            if ((*vtable).get_class_info)(factory_ptr as *mut _, i, &mut info) == 0 {
                let cat = info.category_str();
                if cat.contains("Controller") && !candidate_cids.contains(&info.cid) {
                    println!("[controller] Factory controller class -> {}", cid_hex(&info.cid));
                    candidate_cids.push(info.cid);
                }
            }
        }
    }

    let handler_ptr = DawnComponentHandler::get_singleton_ptr();

    // 3. Crear e inicializar la clase Controller
    for cid in candidate_cids {
        println!("[controller] Probando CID {}", cid_hex(&cid));

        // Intento 1: Solicitar IEditController directamente a la Factory
        if let Ok(ctrl_ptr) = ifactory::create_instance(factory_ptr as *mut _, &cid, &IID_IEDIT_CONTROLLER) {
            println!("[controller] create_instance(IEditController) OK: 0x{:016X}", ctrl_ptr as usize);
            if let Ok(base_ptr) = funknown::query_interface(ctrl_ptr, &iplugin_base::IID_IPLUGIN_BASE) {
                let _ = iplugin_base::initialize(base_ptr, host_ptr);
                funknown::release(base_ptr);
            } else {
                let _ = iplugin_base::initialize(ctrl_ptr, host_ptr);
            }
            let _ = iedit_controller::set_component_handler(ctrl_ptr, handler_ptr);
            let _ = iconnection_point::connect_peers(component_ptr, ctrl_ptr);
            return Ok(ctrl_ptr);
        }

        // Intento 2: Solicitar FUnknown
        if let Ok(raw_ptr) = ifactory::create_instance(factory_ptr as *mut _, &cid, &IID_FUNKNOWN) {
            println!("[controller] create_instance(FUnknown) OK -> 0x{:016X}", raw_ptr as usize);

            // Inicialización de IPluginBase OBLIGATORIA con el host_ptr
            if let Ok(base_ptr) = funknown::query_interface(raw_ptr, &iplugin_base::IID_IPLUGIN_BASE) {
                let hr_init = iplugin_base::initialize(base_ptr, host_ptr);
                println!("[controller] initialize(IPluginBase) hr=0x{:08X}", hr_init as u32);
                funknown::release(base_ptr);
            } else {
                let hr_init = iplugin_base::initialize(raw_ptr, host_ptr);
                println!("[controller] initialize(raw_ptr) hr=0x{:08X}", hr_init as u32);
            }

            let _ = iedit_controller::set_component_handler(raw_ptr, handler_ptr);
            let _ = iconnection_point::connect_peers(component_ptr, raw_ptr);

            if let Ok(ctrl_ptr) = funknown::query_interface(raw_ptr, &IID_IEDIT_CONTROLLER) {
                println!("[controller] QueryInterface(IEditController) OK -> 0x{:016X}", ctrl_ptr as usize);
                funknown::release(raw_ptr);
                return Ok(ctrl_ptr);
            }

            println!("[controller] Usando raw_ptr como IEditController (JUCE / Antares)");
            return Ok(raw_ptr);
        }
    }

    Err("No controller instance could be created".into())
}

#[cfg(target_os = "windows")]
pub unsafe fn create_controller_from_factory(
    factory_ptr: usize,
    host_ptr: *mut core::ffi::c_void,
) -> Result<*mut core::ffi::c_void, String> {
    use crate::vst3_com::ifactory::{self, IPluginFactory, PClassInfo};
    use crate::vst3_com::iedit_controller::IID_IEDIT_CONTROLLER;
    use crate::vst3_com::iplugin_base;
    use crate::vst3_com::funknown::{self, IID_FUNKNOWN};

    if factory_ptr == 0 { return Err("factory_ptr NULL".into()); }
    let factory = factory_ptr as *mut IPluginFactory;
    let vtable = (*factory).vtable;
    if vtable.is_null() { return Err("vtable NULL".into()); }

    let count = ((*vtable).count_classes)(factory_ptr as *mut _);
    for i in 0..count {
        let mut info = PClassInfo::zeroed();
        if ((*vtable).get_class_info)(factory_ptr as *mut _, i, &mut info) != 0 { continue; }
        if !info.category_str().contains("Controller") { continue; }

        if let Ok(ctrl_ptr) = ifactory::create_instance(factory_ptr as *mut _, &info.cid, &IID_IEDIT_CONTROLLER) {
            if let Ok(base_ptr) = funknown::query_interface(ctrl_ptr, &iplugin_base::IID_IPLUGIN_BASE) {
                let _ = iplugin_base::initialize(base_ptr, host_ptr);
                funknown::release(base_ptr);
            }
            return Ok(ctrl_ptr);
        }

        if let Ok(raw_ptr) = ifactory::create_instance(factory_ptr as *mut _, &info.cid, &IID_FUNKNOWN) {
            if let Ok(base_ptr) = funknown::query_interface(raw_ptr, &iplugin_base::IID_IPLUGIN_BASE) {
                let _ = iplugin_base::initialize(base_ptr, host_ptr);
                funknown::release(base_ptr);
            }
            if let Ok(ctrl) = funknown::query_interface(raw_ptr, &IID_IEDIT_CONTROLLER) {
                funknown::release(raw_ptr);
                return Ok(ctrl);
            }
            return Ok(raw_ptr);
        }
    }

    Err("No controller class found in factory".into())
}