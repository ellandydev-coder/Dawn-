// src-tauri/src/vst3_com/iplugin_base.rs

#![allow(dead_code)]

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};
use super::funknown::FUnknownVtable;

/// IID de IPluginBase — 22888DDB-156E-45AE-8358-B34808190625
pub const IID_IPLUGIN_BASE: Tuid =
    tuid(0x22888DDB, 0x156E45AE, 0x8358B348, 0x08190625);

#[repr(C)]
pub struct IPluginBaseVtable {
    pub base: FUnknownVtable,
    pub initialize: unsafe extern "system" fn(this: *mut c_void, host_context: *mut c_void) -> Hresult,
    pub terminate: unsafe extern "system" fn(this: *mut c_void) -> Hresult,
}

#[repr(C)]
pub struct IPluginBase {
    pub vtable: *const IPluginBaseVtable,
}

pub unsafe fn initialize(plugin_base: *mut c_void, host_context: *mut c_void) -> Hresult {
    if plugin_base.is_null() { return -1; }
    let base = plugin_base as *mut IPluginBase;
    let vtable = (*base).vtable;
    if vtable.is_null() { return -1; }
    ((*vtable).initialize)(plugin_base, host_context)
}

pub unsafe fn terminate(plugin_base: *mut c_void) -> Hresult {
    if plugin_base.is_null() { return -1; }
    let base = plugin_base as *mut IPluginBase;
    let vtable = (*base).vtable;
    if vtable.is_null() { return -1; }
    ((*vtable).terminate)(plugin_base)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "windows")]
    #[test]
    fn iid_iplugin_base_windows_bytes() {
        let expected: Tuid = [
            0xDB, 0x8D, 0x88, 0x22,
            0x6E, 0x15, 0xAE, 0x45,
            0x83, 0x58, 0xB3, 0x48,
            0x08, 0x19, 0x06, 0x25,
        ];
        assert_eq!(IID_IPLUGIN_BASE, expected);
    }

    #[test]
    fn vtable_has_5_slots() {
        assert_eq!(std::mem::size_of::<IPluginBaseVtable>(), std::mem::size_of::<usize>() * 5);
    }

    #[test]
    fn iplugin_base_is_single_pointer() {
        assert_eq!(std::mem::size_of::<IPluginBase>(), std::mem::size_of::<usize>());
    }
}