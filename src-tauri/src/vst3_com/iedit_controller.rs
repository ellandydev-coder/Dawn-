// src-tauri/src/vst3_com/iedit_controller.rs
// Layout C++ oficial Steinberg VST3: IEditController hereda DIRECTAMENTE de FUnknown (16 slots exactos)

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};
use super::funknown::FUnknownVtable;

/// IID IEditController oficial Steinberg — DCD4096E-0E5C-4449-83B3-979075C4E088
pub const IID_IEDIT_CONTROLLER: Tuid =
    tuid(0xDCD4096E, 0x0E5C4449, 0x83B39790, 0x75C4E088);

#[repr(C)]
pub struct IEditControllerVtable {
    // FUnknown (slots 0-2)
    pub base: FUnknownVtable,

    // IEditController (slots 3-15)
    pub set_component_state: unsafe extern "system" fn(this: *mut c_void, state: *mut c_void) -> Hresult, // slot 3
    pub set_state: unsafe extern "system" fn(this: *mut c_void, state: *mut c_void) -> Hresult,            // slot 4
    pub get_state: unsafe extern "system" fn(this: *mut c_void, state: *mut c_void) -> Hresult,            // slot 5
    pub get_parameter_count: unsafe extern "system" fn(this: *mut c_void) -> i32,                          // slot 6
    pub get_parameter_info: unsafe extern "system" fn(this: *mut c_void, param_index: i32, info: *mut c_void) -> Hresult, // slot 7
    pub get_param_string_by_value: unsafe extern "system" fn(this: *mut c_void, id: u32, value_normalized: f64, string: *mut u16) -> Hresult, // slot 8
    pub get_param_value_by_string: unsafe extern "system" fn(this: *mut c_void, id: u32, string: *const u16, value_normalized: *mut f64) -> Hresult, // slot 9
    pub normalized_param_to_plain: unsafe extern "system" fn(this: *mut c_void, id: u32, value_normalized: f64) -> f64, // slot 10
    pub plain_param_to_normalized: unsafe extern "system" fn(this: *mut c_void, id: u32, plain_value: f64) -> f64, // slot 11
    pub get_param_normalized: unsafe extern "system" fn(this: *mut c_void, id: u32) -> f64,                // slot 12
    pub set_param_normalized: unsafe extern "system" fn(this: *mut c_void, id: u32, value: f64) -> Hresult,// slot 13
    pub set_component_handler: unsafe extern "system" fn(this: *mut c_void, handler: *mut c_void) -> Hresult, // slot 14
    pub create_view: unsafe extern "system" fn(this: *mut c_void, name: *const std::os::raw::c_char) -> *mut c_void, // slot 15
}

#[repr(C)]
pub struct IEditController {
    pub vtable: *const IEditControllerVtable,
}

#[inline]
unsafe fn vtable(this: *mut c_void) -> Option<&'static IEditControllerVtable> {
    if this.is_null() || (this as usize) < 0x10000 {
        return None;
    }
    let obj = this as *mut IEditController;
    let vt = (*obj).vtable;
    if vt.is_null() || (vt as usize) < 0x10000 {
        return None;
    }
    Some(&*vt)
}

pub unsafe fn set_component_state(this: *mut c_void, state: *mut c_void) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.set_component_state)(this, state),
        None => -1,
    }
}

pub unsafe fn set_component_handler(this: *mut c_void, handler: *mut c_void) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.set_component_handler)(this, handler),
        None => -1,
    }
}

pub unsafe fn create_view(this: *mut c_void) -> Result<*mut c_void, Hresult> {
    match vtable(this) {
        Some(vt) => {
            let name = std::ffi::CString::new("editor").unwrap();
            let mut view = (vt.create_view)(this, name.as_ptr());
            if view.is_null() {
                view = (vt.create_view)(this, std::ptr::null());
            }
            if !view.is_null() && (view as usize) >= 0x10000 {
                Ok(view)
            } else {
                Err(-1)
            }
        }
        None => Err(-1),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iedit_controller_vtable_size() {
        assert_eq!(std::mem::size_of::<IEditControllerVtable>(), std::mem::size_of::<usize>() * 16);
    }
}