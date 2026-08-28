// src-tauri/src/vst3/editor/controller.rs

#[cfg(target_os = "windows")]
pub unsafe fn create_controller_from_factory(
    factory_ptr: usize,
    host_ptr: *mut core::ffi::c_void,
) -> Result<*mut core::ffi::c_void, String> {
    use crate::vst3_com::ifactory::{IPluginFactory, PClassInfo};
    use crate::vst3_com::iedit_controller::IID_IEDIT_CONTROLLER;
    use crate::vst3_com::iplugin_base;
    use crate::vst3_com::funknown;
    use crate::vst3_com::Tuid;

    const IID_FUNKNOWN: Tuid = [
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46,
    ];

    if factory_ptr == 0 { return Err("factory_ptr NULL".into()); }
    let factory = factory_ptr as *mut IPluginFactory;
    let vtable = (*factory).vtable;
    if vtable.is_null() { return Err("vtable NULL".into()); }

    let count = ((*vtable).count_classes)(factory_ptr as *mut _);

    for i in 0..count {
        let mut info = PClassInfo::zeroed();
        let hr = ((*vtable).get_class_info)(factory_ptr as *mut _, i, &mut info);
        if hr != 0 || !info.category_str().contains("Controller") { continue; }

        // Instanciar clase de controlador como FUnknown
        let raw_ptr = match crate::vst3_com::ifactory::create_instance(
            factory_ptr as *mut _, &info.cid, &IID_FUNKNOWN,
        ) {
            Ok(ptr) => ptr,
            Err(_) => continue,
        };

        // Inicializar vía IPluginBase ÚNICAMENTE si el objeto implementa IPluginBase
        if let Ok(base_ptr) = funknown::query_interface(raw_ptr, &iplugin_base::IID_IPLUGIN_BASE) {
            let _ = iplugin_base::initialize(base_ptr, host_ptr);
            funknown::release(base_ptr);
        }

        // Obtener IEditController de forma segura
        let controller_ptr = match funknown::query_interface(raw_ptr, &IID_IEDIT_CONTROLLER) {
            Ok(ctrl) => ctrl,
            Err(e) => {
                funknown::release(raw_ptr);
                return Err(format!("QI IEditController falló: 0x{:08X}", e as u32));
            }
        };

        funknown::release(raw_ptr);
        return Ok(controller_ptr);
    }

    Err("No controller class found in factory".into())
}