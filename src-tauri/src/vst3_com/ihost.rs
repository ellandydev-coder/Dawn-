// src-tauri/src/vst3_com/ihost.rs

#![allow(dead_code)]

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};
use super::funknown::FUnknownVtable;
use super::string_convert::STRING128_LEN;

/// IID de IHostApplication — 58E595CC-DB2A-4969-8AA9-ADEE49BF31C6
pub const IID_IHOST_APPLICATION: Tuid =
    tuid(0x58E595CC, 0xDB2A4969, 0x8AA9ADEE, 0x49BF31C6);

pub type String128 = [u16; STRING128_LEN];

#[repr(C)]
pub struct IHostApplicationVtable {
    pub base: FUnknownVtable,
    pub get_name: unsafe extern "system" fn(this: *mut c_void, name: *mut String128) -> Hresult,
    pub create_instance: unsafe extern "system" fn(this: *mut c_void, cid: *const Tuid, iid: *const Tuid, obj: *mut *mut c_void) -> Hresult,
}

#[repr(C)]
pub struct IHostApplication {
    pub vtable: *const IHostApplicationVtable,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "windows")]
    #[test]
    fn iid_ihost_application_windows_bytes() {
        let expected: Tuid = [
            0xCC, 0x95, 0xE5, 0x58,
            0x2A, 0xDB, 0x69, 0x49,
            0x8A, 0xA9, 0xAD, 0xEE,
            0x49, 0xBF, 0x31, 0xC6,
        ];
        assert_eq!(IID_IHOST_APPLICATION, expected);
    }

    #[test]
    fn vtable_slot_count_is_5() {
        assert_eq!(std::mem::size_of::<IHostApplicationVtable>(), std::mem::size_of::<usize>() * 5);
    }

    #[test]
    fn string128_is_256_bytes() {
        assert_eq!(std::mem::size_of::<String128>(), 256);
    }
}