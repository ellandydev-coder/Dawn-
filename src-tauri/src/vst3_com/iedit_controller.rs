// src-tauri/src/vst3_com/iedit_controller.rs
// Layout C++ oficial Steinberg VST3: IEditController hereda de IPluginBase hereda de FUnknown (18 slots)

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};
use super::funknown::FUnknownVtable;

/// IID IEditController — 7C2A9620-7984-4A86-8E02-CD3E10C282C9
pub const IID_IEDIT_CONTROLLER: Tuid =
    tuid(0x7C2A9620, 0x79844A86, 0x8E02CD3E, 0x10C282C9);

#[repr(C)]
pub struct IEditControllerVtable {
    // FUnknown (slots 0-2)
    pub base: FUnknownVtable,

    // IPluginBase (slots 3-4)
    pub initialize: unsafe extern "system" fn(this: *mut c_void, context: *mut c_void) -> Hresult,
    pub terminate: unsafe extern "system" fn(this: *mut c_void) -> Hresult,

    // IEditController (slots 5-17)
    pub set_component_state: unsafe extern "system" fn(this: *mut c_void, state: *mut c_void) -> Hresult,
    pub set_state: unsafe extern "system" fn(this: *mut c_void, state: *mut c_void) -> Hresult,
    pub get_state: unsafe extern "system" fn(this: *mut c_void, state: *mut c_void) -> Hresult,
    pub get_parameter_count: unsafe extern "system" fn(this: *mut c_void) -> i32,
    pub get_parameter_info: unsafe extern "system" fn(this: *mut c_void, param_index: i32, info: *mut c_void) -> Hresult,
    pub get_param_string_by_value: unsafe extern "system" fn(this: *mut c_void, id: u32, value_normalized: f64, string: *mut u16) -> Hresult,
    pub get_param_value_by_string: unsafe extern "system" fn(this: *mut c_void, id: u32, string: *const u16, value_normalized: *mut f64) -> Hresult,
    pub normalized_param_to_plain: unsafe extern "system" fn(this: *mut c_void, id: u32, value_normalized: f64) -> f64,
    pub plain_param_to_normalized: unsafe extern "system" fn(this: *mut c_void, id: u32, plain_value: f64) -> f64,
    pub get_param_normalized: unsafe extern "system" fn(this: *mut c_void, id: u32) -> f64,
    pub set_param_normalized: unsafe extern "system" fn(this: *mut c_void, id: u32, value: f64) -> Hresult,
    pub set_component_handler: unsafe extern "system" fn(this: *mut c_void, handler: *mut c_void) -> Hresult,
    pub create_view: unsafe extern "system" fn(this: *mut c_void, name: *const std::os::raw::c_char) -> *mut c_void,
}

#[repr(C)]
pub struct IEditController {
    pub vtable: *const IEditControllerVtable,
}

#[inline]
unsafe fn vtable(this: *mut c_void) -> Option<&'static IEditControllerVtable> {
    if this.is_null() { return None; }
    let obj = this as *mut IEditController;
    let vt = (*obj).vtable;
    if vt.is_null() { return None; }
    Some(&*vt)
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
            let view = (vt.create_view)(this, name.as_ptr());
            if !view.is_null() {
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
        assert_eq!(std::mem::size_of::<IEditControllerVtable>(), std::mem::size_of::<usize>() * 18);
    }
}