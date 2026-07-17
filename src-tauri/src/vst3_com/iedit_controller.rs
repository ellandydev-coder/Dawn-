// src-tauri/src/vst3_com/iedit_controller.rs
//
// Layout COM de IEditController (VST3 SDK)

#![allow(dead_code)]

use core::ffi::c_void;
use super::Tuid;

// ═══════════════════════════════════════════════════════════════
// 🎯 IID
// ═══════════════════════════════════════════════════════════════

/// IID de IEditController — del VST3 SDK
/// {DCD7BBE3-7742-448D-A874-AACC979C759E}
/// Bytes en orden COM/Windows (little-endian en grupos 1-3)
pub const IID_IEDIT_CONTROLLER: Tuid = [
    0xE3, 0xBB, 0xD7, 0xDC,   // DCD7BBE3 → little-endian
    0x42, 0x77,                 // 7742 → little-endian
    0x8D, 0x44,                 // 448D → little-endian
    0xA8, 0x74, 0xAA, 0xCC,
    0x97, 0x9C, 0x75, 0x9E,
];

// ═══════════════════════════════════════════════════════════════
// 🎯 VTABLE
// ═══════════════════════════════════════════════════════════════

#[repr(C)]
pub struct IEditControllerVtable {
    pub query_interface: unsafe extern "system" fn(
        this: *mut c_void,
        iid:  *const Tuid,
        obj:  *mut *mut c_void,
    ) -> i32,
    pub add_ref: unsafe extern "system" fn(this: *mut c_void) -> u32,
    pub release: unsafe extern "system" fn(this: *mut c_void) -> u32,
    pub initialize: unsafe extern "system" fn(
        this:    *mut c_void,
        context: *mut c_void,
    ) -> i32,
    pub terminate: unsafe extern "system" fn(this: *mut c_void) -> i32,
    pub set_component_state: unsafe extern "system" fn(
        this:  *mut c_void,
        state: *mut c_void,
    ) -> i32,
    pub set_state: unsafe extern "system" fn(
        this:  *mut c_void,
        state: *mut c_void,
    ) -> i32,
    pub get_state: unsafe extern "system" fn(
        this:  *mut c_void,
        state: *mut c_void,
    ) -> i32,
    pub get_parameter_count: unsafe extern "system" fn(this: *mut c_void) -> i32,
    pub get_parameter_info: unsafe extern "system" fn(
        this:        *mut c_void,
        param_index: i32,
        info:        *mut c_void,
    ) -> i32,
    pub get_param_string_by_value: unsafe extern "system" fn(
        this:       *mut c_void,
        id:         u32,
        value_norm: f64,
        string:     *mut c_void,
    ) -> i32,
    pub get_param_value_by_string: unsafe extern "system" fn(
        this:       *mut c_void,
        id:         u32,
        string:     *const u16,
        value_norm: *mut f64,
    ) -> i32,
    pub normalized_param_to_plain: unsafe extern "system" fn(
        this:       *mut c_void,
        id:         u32,
        value_norm: f64,
    ) -> f64,
    pub plain_param_to_normalized: unsafe extern "system" fn(
        this:        *mut c_void,
        id:          u32,
        plain_value: f64,
    ) -> f64,
    pub get_param_normalized: unsafe extern "system" fn(
        this: *mut c_void,
        id:   u32,
    ) -> f64,
    pub set_param_normalized: unsafe extern "system" fn(
        this:  *mut c_void,
        id:    u32,
        value: f64,
    ) -> i32,
    pub set_component_handler: unsafe extern "system" fn(
        this:    *mut c_void,
        handler: *mut c_void,
    ) -> i32,
    pub create_view: unsafe extern "system" fn(
        this: *mut c_void,
        name: *const u8,
    ) -> *mut c_void,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 STRUCT
// ═══════════════════════════════════════════════════════════════

#[repr(C)]
pub struct IEditController {
    pub vtable: *const IEditControllerVtable,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPER — createView
// ═══════════════════════════════════════════════════════════════

pub unsafe fn create_view(controller: *mut c_void) -> Result<*mut c_void, i32> {
    let ctrl   = controller as *mut IEditController;
    let vtable = (*ctrl).vtable;

    if vtable.is_null() {
        return Err(-1);
    }

    let view_name = b"editor\0";
    let view_ptr  = ((*vtable).create_view)(controller, view_name.as_ptr());

    if view_ptr.is_null() {
        log::warn!("[iedit_controller] createView('editor') devolvió NULL");
        Err(0x80004005u32 as i32)
    } else {
        log::info!(
            "[iedit_controller] createView OK → 0x{:016x}",
            view_ptr as usize
        );
        Ok(view_ptr)
    }
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use std::mem;

    #[test]
    fn vtable_has_18_slots() {
        let slot_count = mem::size_of::<IEditControllerVtable>()
            / mem::size_of::<*const ()>();
        assert_eq!(slot_count, 18);
    }

    #[test]
    fn iedit_controller_is_single_pointer() {
        assert_eq!(
            mem::size_of::<IEditController>(),
            mem::size_of::<*const ()>()
        );
    }

    #[test]
    fn iid_iedit_controller_first_bytes() {
        // DCD7BBE3 en little-endian → E3 BB D7 DC
        assert_eq!(IID_IEDIT_CONTROLLER[0], 0xE3);
        assert_eq!(IID_IEDIT_CONTROLLER[1], 0xBB);
        assert_eq!(IID_IEDIT_CONTROLLER[2], 0xD7);
        assert_eq!(IID_IEDIT_CONTROLLER[3], 0xDC);
    }

    #[test]
    fn create_view_slot_is_last() {
        let base = 0usize;
        let vtable = IEditControllerVtable {
            query_interface:           unsafe { mem::transmute(base + 0) },
            add_ref:                   unsafe { mem::transmute(base + 1) },
            release:                   unsafe { mem::transmute(base + 2) },
            initialize:                unsafe { mem::transmute(base + 3) },
            terminate:                 unsafe { mem::transmute(base + 4) },
            set_component_state:       unsafe { mem::transmute(base + 5) },
            set_state:                 unsafe { mem::transmute(base + 6) },
            get_state:                 unsafe { mem::transmute(base + 7) },
            get_parameter_count:       unsafe { mem::transmute(base + 8) },
            get_parameter_info:        unsafe { mem::transmute(base + 9) },
            get_param_string_by_value: unsafe { mem::transmute(base + 10) },
            get_param_value_by_string: unsafe { mem::transmute(base + 11) },
            normalized_param_to_plain: unsafe { mem::transmute(base + 12) },
            plain_param_to_normalized: unsafe { mem::transmute(base + 13) },
            get_param_normalized:      unsafe { mem::transmute(base + 14) },
            set_param_normalized:      unsafe { mem::transmute(base + 15) },
            set_component_handler:     unsafe { mem::transmute(base + 16) },
            create_view:               unsafe { mem::transmute(base + 17) },
        };

        let vtable_ptr = &vtable as *const IEditControllerVtable as *const usize;
        let create_view_val = unsafe { *vtable_ptr.add(17) };
        assert_eq!(create_view_val, 17);
    }
}