// src-tauri/src/vst3_com/mod.rs

pub mod funknown;
pub mod ibstream;
pub mod icomponent;
pub mod iconnection_point;
pub mod iedit_controller;
pub mod ifactory;
pub mod ihost;
pub mod iplug_view;
pub mod iplugin_base;
pub mod string_convert;
pub mod iaudio_processor;

pub type Tuid    = [u8; 16];
pub type Hresult = i32;

pub const S_OK:    Hresult = 0;
#[allow(dead_code)]
pub const S_FALSE: Hresult = 1;
pub type ComPtr = *mut core::ffi::c_void;

#[cfg(target_os = "windows")]
pub const fn tuid(l1: u32, l2: u32, l3: u32, l4: u32) -> Tuid {
    [
        ((l1 & 0x000000FF) >>  0) as u8,
        ((l1 & 0x0000FF00) >>  8) as u8,
        ((l1 & 0x00FF0000) >> 16) as u8,
        ((l1 & 0xFF000000) >> 24) as u8,
        ((l2 & 0x00FF0000) >> 16) as u8,
        ((l2 & 0xFF000000) >> 24) as u8,
        ((l2 & 0x000000FF) >>  0) as u8,
        ((l2 & 0x0000FF00) >>  8) as u8,
        ((l3 & 0xFF000000) >> 24) as u8,
        ((l3 & 0x00FF0000) >> 16) as u8,
        ((l3 & 0x0000FF00) >>  8) as u8,
        ((l3 & 0x000000FF) >>  0) as u8,
        ((l4 & 0xFF000000) >> 24) as u8,
        ((l4 & 0x00FF0000) >> 16) as u8,
        ((l4 & 0x0000FF00) >>  8) as u8,
        ((l4 & 0x000000FF) >>  0) as u8,
    ]
}

#[cfg(not(target_os = "windows"))]
pub const fn tuid(l1: u32, l2: u32, l3: u32, l4: u32) -> Tuid {
    [
        ((l1 & 0xFF000000) >> 24) as u8,
        ((l1 & 0x00FF0000) >> 16) as u8,
        ((l1 & 0x0000FF00) >>  8) as u8,
        ((l1 & 0x000000FF) >>  0) as u8,
        ((l2 & 0xFF000000) >> 24) as u8,
        ((l2 & 0x00FF0000) >> 16) as u8,
        ((l2 & 0x0000FF00) >>  8) as u8,
        ((l2 & 0x000000FF) >>  0) as u8,
        ((l3 & 0xFF000000) >> 24) as u8,
        ((l3 & 0x00FF0000) >> 16) as u8,
        ((l3 & 0x0000FF00) >>  8) as u8,
        ((l3 & 0x000000FF) >>  0) as u8,
        ((l4 & 0xFF000000) >> 24) as u8,
        ((l4 & 0x00FF0000) >> 16) as u8,
        ((l4 & 0x0000FF00) >>  8) as u8,
        ((l4 & 0x000000FF) >>  0) as u8,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "windows")]
    #[test]
    fn tuid_windows_icomponent_layout() {
        let iid = tuid(0xE831FF31, 0xF2D54301, 0x928EBBEE, 0x25697802);
        let expected: Tuid = [
            0x31, 0xFF, 0x31, 0xE8,
            0xD5, 0xF2, 0x01, 0x43,
            0x92, 0x8E, 0xBB, 0xEE,
            0x25, 0x69, 0x78, 0x02,
        ];
        assert_eq!(iid, expected);
    }
}