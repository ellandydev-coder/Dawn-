// src-tauri/src/vst3_com/iconnection_point.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 IConnectionPoint — Conexión Component ↔ Controller en VST3
// ═══════════════════════════════════════════════════════════════

use std::os::raw::c_void;
use super::{tuid, funknown, Hresult, Tuid, S_OK};
use super::funknown::FUnknownVtable;

/// IID de IConnectionPoint — 7B4FA160-E4CD-4A74-86A5-0616AA93D49F
pub const IID_ICONNECTION_POINT: Tuid =
    tuid(0x7B4FA160, 0xE4CD4A74, 0x86A50616, 0xAA93D49F);

#[repr(C)]
pub struct IConnectionPointVtable {
    pub base: FUnknownVtable,

    pub connect: unsafe extern "system" fn(
        this: *mut c_void,
        other: *mut c_void,
    ) -> Hresult,

    pub disconnect: unsafe extern "system" fn(
        this: *mut c_void,
        other: *mut c_void,
    ) -> Hresult,

    pub notify: unsafe extern "system" fn(
        this: *mut c_void,
        message: *mut c_void,
    ) -> Hresult,
}

#[repr(C)]
pub struct IConnectionPoint {
    pub vtable: *const IConnectionPointVtable,
}

#[inline]
unsafe fn vtable(this: *mut c_void) -> Option<&'static IConnectionPointVtable> {
    if this.is_null() {
        return None;
    }
    let obj = this as *mut IConnectionPoint;
    let vt = (*obj).vtable;
    if vt.is_null() {
        return None;
    }
    Some(&*vt)
}

/// Llama a `connect` en un objeto IConnectionPoint.
pub unsafe fn connect(this: *mut c_void, other: *mut c_void) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.connect)(this, other),
        None => -1,
    }
}

/// Llama a `disconnect` en un objeto IConnectionPoint.
pub unsafe fn disconnect(this: *mut c_void, other: *mut c_void) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.disconnect)(this, other),
        None => -1,
    }
}

/// Conecta bidireccionalmente un Component y un EditController.
/// (Component ↔ Controller Peer Connection)
///
/// Si alguno de los dos no soporta IConnectionPoint, no hace nada y devuelve S_OK (best effort).
pub unsafe fn connect_peers(component: *mut c_void, controller: *mut c_void) -> Hresult {
    if component.is_null() || controller.is_null() {
        return S_OK;
    }

    let comp_cp = match funknown::query_interface(component, &IID_ICONNECTION_POINT) {
        Ok(ptr) => ptr,
        Err(_) => return S_OK, // Best effort si el plugin no usa IConnectionPoint
    };

    let ctrl_cp = match funknown::query_interface(controller, &IID_ICONNECTION_POINT) {
        Ok(ptr) => ptr,
        Err(_) => {
            funknown::release(comp_cp);
            return S_OK;
        }
    };

    let hr1 = connect(comp_cp, ctrl_cp);
    let hr2 = connect(ctrl_cp, comp_cp);

    log::info!(
        "[iconnection_point] comp->connect(ctrl) hr=0x{:08X}, ctrl->connect(comp) hr=0x{:08X}",
        hr1 as u32, hr2 as u32
    );

    funknown::release(ctrl_cp);
    funknown::release(comp_cp);

    if hr1 == S_OK && hr2 == S_OK {
        S_OK
    } else {
        hr1
    }
}