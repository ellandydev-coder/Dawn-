// src-tauri/src/vst3_com/funknown.rs

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};

pub const IID_FUNKNOWN: Tuid =
    tuid(0x00000000, 0x00000000, 0xC0000000, 0x00000046);

#[repr(C)]
pub struct FUnknownVtable {
    pub query_interface: unsafe extern "system" fn(
        this: *mut c_void,
        iid:  *const Tuid,
        out:  *mut *mut c_void,
    ) -> Hresult,
    pub add_ref: unsafe extern "system" fn(this: *mut c_void) -> u32,
    pub release: unsafe extern "system" fn(this: *mut c_void) -> u32,
}

#[repr(C)]
pub struct FUnknown {
    pub vtable: *const FUnknownVtable,
}

pub unsafe fn query_interface(
    this: *mut c_void,
    iid:  &Tuid,
) -> Result<*mut c_void, Hresult> {
    if this.is_null() {
        return Err(-1);
    }

    let funknown = this as *mut FUnknown;
    let vtable   = (*funknown).vtable;

    if vtable.is_null() {
        return Err(-1);
    }

    let mut out: *mut c_void = std::ptr::null_mut();
    let hr = ((*vtable).query_interface)(
        this,
        iid as *const Tuid,
        &mut out as *mut *mut c_void,
    );

    // En Win32 COM: hr >= 0 (SUCCEEDED) significa que la interfaz fue entregada en `out`
    if hr >= 0 && !out.is_null() {
        Ok(out)
    } else {
        Err(hr)
    }
}

pub unsafe fn release(this: *mut c_void) -> u32 {
    if this.is_null() {
        return 0;
    }
    let funknown = this as *mut FUnknown;
    let vtable   = (*funknown).vtable;
    if vtable.is_null() {
        return 0;
    }
    ((*vtable).release)(this)
}

#[allow(dead_code)]
pub unsafe fn add_ref(this: *mut c_void) -> u32 {
    if this.is_null() {
        return 0;
    }
    let funknown = this as *mut FUnknown;
    let vtable   = (*funknown).vtable;
    if vtable.is_null() {
        return 0;
    }
    ((*vtable).add_ref)(this)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iid_funknown_is_classic_iunknown() {
        let expected: Tuid = [
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0xC0, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x46,
        ];
        assert_eq!(IID_FUNKNOWN, expected);
    }

    #[test]
    fn vtable_has_three_slots() {
        let expected_size = std::mem::size_of::<usize>() * 3;
        assert_eq!(std::mem::size_of::<FUnknownVtable>(), expected_size);
    }

    #[test]
    fn funknown_is_single_pointer() {
        assert_eq!(std::mem::size_of::<FUnknown>(), std::mem::size_of::<usize>());
    }
}