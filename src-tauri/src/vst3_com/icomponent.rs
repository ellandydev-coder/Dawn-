// src-tauri/src/vst3_com/icomponent.rs

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};
use super::funknown::FUnknownVtable;

pub const IID_IPLUGIN_BASE: Tuid =
    tuid(0x22888DDB, 0x156E45AE, 0x8358B348, 0x08190625);

pub const IID_ICOMPONENT: Tuid =
    tuid(0xE831FF31, 0xF2D54301, 0x928EBBEE, 0x25697802);

#[allow(dead_code)]
pub const MEDIA_TYPE_AUDIO: i32 = 0;
#[allow(dead_code)]
pub const MEDIA_TYPE_EVENT: i32 = 1;
#[allow(dead_code)]
pub const BUS_DIRECTION_INPUT: i32 = 0;
#[allow(dead_code)]
pub const BUS_DIRECTION_OUTPUT: i32 = 1;

#[allow(dead_code)]
#[repr(C)]
pub struct BusInfo {
    pub media_type:    i32,
    pub direction:     i32,
    pub channel_count: i32,
    pub name:          [u16; 128],
    pub bus_type:      i32,
    pub flags:         u32,
}

#[repr(C)]
pub struct IComponentVtable {
    pub base: FUnknownVtable,
    pub initialize: unsafe extern "system" fn(this: *mut c_void, context: *mut c_void) -> Hresult,
    pub terminate: unsafe extern "system" fn(this: *mut c_void) -> Hresult,
    pub get_controller_class_id: unsafe extern "system" fn(this: *mut c_void, out_cid: *mut Tuid) -> Hresult,
    pub set_io_mode: unsafe extern "system" fn(this: *mut c_void, mode: i32) -> Hresult,
    pub get_bus_count: unsafe extern "system" fn(this: *mut c_void, media_type: i32, direction: i32) -> i32,
    pub get_bus_info: unsafe extern "system" fn(this: *mut c_void, media_type: i32, direction: i32, index: i32, info: *mut BusInfo) -> Hresult,
    pub get_routing_info: unsafe extern "system" fn(this: *mut c_void, in_info: *mut c_void, out_info: *mut c_void) -> Hresult,
    pub activate_bus: unsafe extern "system" fn(this: *mut c_void, media_type: i32, direction: i32, index: i32, state: u8) -> Hresult,
    pub set_active: unsafe extern "system" fn(this: *mut c_void, state: u8) -> Hresult,
    pub set_state: unsafe extern "system" fn(this: *mut c_void, stream: *mut c_void) -> Hresult,
    pub get_state: unsafe extern "system" fn(this: *mut c_void, stream: *mut c_void) -> Hresult,
}

#[repr(C)]
pub struct IComponent {
    pub vtable: *const IComponentVtable,
}

#[inline]
unsafe fn vtable(this: *mut c_void) -> Option<&'static IComponentVtable> {
    if this.is_null() { return None; }
    let obj = this as *mut IComponent;
    let vt = (*obj).vtable;
    if vt.is_null() { return None; }
    Some(&*vt)
}

pub unsafe fn get_controller_class_id(this: *mut c_void) -> Result<Tuid, Hresult> {
    match vtable(this) {
        Some(vt) => {
            let mut cid = [0u8; 16];
            let hr = (vt.get_controller_class_id)(this, &mut cid as *mut Tuid);
            if hr == super::S_OK {
                Ok(cid)
            } else {
                Err(hr)
            }
        }
        None => Err(-1),
    }
}

pub unsafe fn get_state(this: *mut c_void, stream: *mut c_void) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.get_state)(this, stream),
        None => -1,
    }
}

pub unsafe fn set_state(this: *mut c_void, stream: *mut c_void) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.set_state)(this, stream),
        None => -1,
    }
}

pub unsafe fn set_active(this: *mut c_void, state: bool) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.set_active)(this, if state { 1 } else { 0 }),
        None => -1,
    }
}

pub unsafe fn activate_bus(
    this: *mut c_void,
    media_type: i32,
    direction: i32,
    index: i32,
    state: bool,
) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.activate_bus)(this, media_type, direction, index, if state { 1 } else { 0 }),
        None => -1,
    }
}

pub unsafe fn get_bus_count(this: *mut c_void, media_type: i32, direction: i32) -> i32 {
    match vtable(this) {
        Some(vt) => (vt.get_bus_count)(this, media_type, direction),
        None => 0,
    }
}