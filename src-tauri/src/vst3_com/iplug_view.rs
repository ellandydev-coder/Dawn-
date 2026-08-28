// src-tauri/src/vst3_com/iplug_view.rs
// Layout C++ oficial Steinberg VST3: IPlugView hereda de FUnknown (15 slots en total)

use std::os::raw::{c_char, c_void};
use super::{tuid, Hresult, Tuid};
use super::funknown::FUnknownVtable;

pub const IID_IPLUG_VIEW: Tuid =
    tuid(0xC9DBF18F, 0x8C194833, 0xB7805175, 0x51E28333);

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct ViewRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

impl ViewRect {
    pub fn new(width: i32, height: i32) -> Self {
        Self {
            left: 0,
            top: 0,
            right: width,
            bottom: height,
        }
    }
}

#[repr(C)]
pub struct IPlugViewVtable {
    // FUnknown (slots 0-2)
    pub base: FUnknownVtable,

    // IPlugView (slots 3-14)
    pub is_platform_type_supported: unsafe extern "system" fn(this: *mut c_void, platform_type: *const c_char) -> Hresult,
    pub attached: unsafe extern "system" fn(this: *mut c_void, parent: *mut c_void, platform_type: *const c_char) -> Hresult,
    pub removed: unsafe extern "system" fn(this: *mut c_void) -> Hresult,
    pub on_wheel: unsafe extern "system" fn(this: *mut c_void, distance: f32) -> Hresult,
    pub on_key_down: unsafe extern "system" fn(this: *mut c_void, key: u16, key_code: i16, modifiers: i16) -> Hresult,
    pub on_key_up: unsafe extern "system" fn(this: *mut c_void, key: u16, key_code: i16, modifiers: i16) -> Hresult,
    pub get_size: unsafe extern "system" fn(this: *mut c_void, size: *mut ViewRect) -> Hresult,
    pub on_size: unsafe extern "system" fn(this: *mut c_void, new_size: *mut ViewRect) -> Hresult,
    pub on_focus: unsafe extern "system" fn(this: *mut c_void, state: u8) -> Hresult,
    pub set_frame: unsafe extern "system" fn(this: *mut c_void, frame: *mut c_void) -> Hresult,
    pub can_resize: unsafe extern "system" fn(this: *mut c_void) -> Hresult,
    pub check_size_constraint: unsafe extern "system" fn(this: *mut c_void, rect: *mut ViewRect) -> Hresult,
}

#[repr(C)]
pub struct IPlugView {
    pub vtable: *const IPlugViewVtable,
}

#[inline]
unsafe fn vtable(this: *mut c_void) -> Option<&'static IPlugViewVtable> {
    if this.is_null() { return None; }
    let obj = this as *mut IPlugView;
    let vt = (*obj).vtable;
    if vt.is_null() { return None; }
    Some(&*vt)
}

pub unsafe fn attached(this: *mut c_void, parent_hwnd: *mut c_void) -> Hresult {
    match vtable(this) {
        Some(vt) => {
            let platform_type = std::ffi::CString::new("HWND").unwrap();
            (vt.attached)(this, parent_hwnd, platform_type.as_ptr())
        }
        None => -1,
    }
}

pub unsafe fn set_frame(this: *mut c_void, frame: *mut c_void) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.set_frame)(this, frame),
        None => -1,
    }
}

pub unsafe fn on_size(this: *mut c_void, new_size: &mut ViewRect) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.on_size)(this, new_size as *mut ViewRect),
        None => -1,
    }
}

pub unsafe fn get_size(this: *mut c_void, size: &mut ViewRect) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.get_size)(this, size as *mut ViewRect),
        None => -1,
    }
}

pub unsafe fn removed(this: *mut c_void) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.removed)(this),
        None => -1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iplug_view_vtable_size() {
        assert_eq!(std::mem::size_of::<IPlugViewVtable>(), std::mem::size_of::<usize>() * 15);
    }
}