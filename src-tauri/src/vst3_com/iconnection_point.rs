// src-tauri/src/vst3_com/iconnection_point.rs
//
// Layout COM de IConnectionPoint (VST3 SDK)
//
// Permite conectar el IComponent con el IEditController
// para que puedan comunicarse (parámetros, estado, etc).

#![allow(dead_code)]

use core::ffi::c_void;
use super::Tuid;

// ═══════════════════════════════════════════════════════════════
// 🎯 IID
// ═══════════════════════════════════════════════════════════════

/// IID de IConnectionPoint — del VST3 SDK
/// {70A4156F-6E6E-4026-9891-48BFAA60D8D1}
/// Bytes en orden COM/Windows (little-endian en grupos 1-3)
pub const IID_ICONNECTION_POINT: Tuid = [
    0x6F, 0x15, 0xA4, 0x70,   // 70A4156F → little-endian
    0x6E, 0x6E,                 // 6E6E → little-endian
    0x26, 0x40,                 // 4026 → little-endian
    0x98, 0x91, 0x48, 0xBF,
    0xAA, 0x60, 0xD8, 0xD1,
];

// ═══════════════════════════════════════════════════════════════
// 🎯 VTABLE
// ═══════════════════════════════════════════════════════════════

/// Vtable de IConnectionPoint.
/// 5 slots: 3 FUnknown + 2 IConnectionPoint.
#[repr(C)]
pub struct IConnectionPointVtable {
    // ── FUnknown (slots 0-2) ─────────────────────────────────
    pub query_interface: unsafe extern "system" fn(
        this: *mut c_void,
        iid:  *const Tuid,
        obj:  *mut *mut c_void,
    ) -> i32,
    pub add_ref: unsafe extern "system" fn(this: *mut c_void) -> u32,
    pub release: unsafe extern "system" fn(this: *mut c_void) -> u32,

    // ── IConnectionPoint (slots 3-4) ─────────────────────────

    /// [3] Conecta este objeto con otro.
    /// `other` es el objeto con el que nos conectamos.
    pub connect: unsafe extern "system" fn(
        this:  *mut c_void,
        other: *mut c_void,
    ) -> i32,

    /// [4] Desconecta.
    pub disconnect: unsafe extern "system" fn(
        this:  *mut c_void,
        other: *mut c_void,
    ) -> i32,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 STRUCT
// ═══════════════════════════════════════════════════════════════

#[repr(C)]
pub struct IConnectionPoint {
    pub vtable: *const IConnectionPointVtable,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

/// Conecta dos objetos VST3 mutuamente.
///
/// Llama:
///   a->connect(b)
///   b->connect(a)
///
/// Los punteros devueltos por QI(IConnectionPoint) tienen addRef.
/// Esta función los release al final.
///
/// SAFETY: ambos punteros deben ser IConnectionPoint válidos.
pub unsafe fn connect_peers(
    comp_ptr: *mut c_void,
    ctrl_ptr: *mut c_void,
) -> Result<(), String> {
    use crate::vst3_com::funknown;

    // QI IConnectionPoint en el component
    let comp_cp = match funknown::query_interface(comp_ptr, &IID_ICONNECTION_POINT) {
        Ok(p) => p,
        Err(hr) => {
            // Muchos plugins no implementan IConnectionPoint — no es error fatal
            log::info!(
                "[iconnection_point] component no expone IConnectionPoint \
                 (hr=0x{:08X}) — OK, algunos plugins no lo necesitan",
                hr as u32
            );
            return Ok(());
        }
    };

    // QI IConnectionPoint en el controller
    let ctrl_cp = match funknown::query_interface(ctrl_ptr, &IID_ICONNECTION_POINT) {
        Ok(p) => p,
        Err(hr) => {
            log::info!(
                "[iconnection_point] controller no expone IConnectionPoint \
                 (hr=0x{:08X}) — OK",
                hr as u32
            );
            funknown::release(comp_cp);
            return Ok(());
        }
    };

    // comp->connect(ctrl)
    {
        let cp = comp_cp as *mut IConnectionPoint;
        let vtable = (*cp).vtable;
        let hr = ((*vtable).connect)(comp_cp, ctrl_ptr);
        log::info!(
            "[iconnection_point] comp->connect(ctrl) → hr=0x{:08X}",
            hr as u32
        );
    }

    // ctrl->connect(comp)
    {
        let cp = ctrl_cp as *mut IConnectionPoint;
        let vtable = (*cp).vtable;
        let hr = ((*vtable).connect)(ctrl_cp, comp_ptr);
        log::info!(
            "[iconnection_point] ctrl->connect(comp) → hr=0x{:08X}",
            hr as u32
        );
    }

    // Release los IConnectionPoint (ya no los necesitamos)
    funknown::release(comp_cp);
    funknown::release(ctrl_cp);

    Ok(())
}

/// Desconecta dos objetos VST3 mutuamente.
pub unsafe fn disconnect_peers(
    comp_ptr: *mut c_void,
    ctrl_ptr: *mut c_void,
) {
    use crate::vst3_com::funknown;

    let comp_cp = match funknown::query_interface(comp_ptr, &IID_ICONNECTION_POINT) {
        Ok(p) => p,
        Err(_) => return,
    };

    let ctrl_cp = match funknown::query_interface(ctrl_ptr, &IID_ICONNECTION_POINT) {
        Ok(p) => p,
        Err(_) => {
            funknown::release(comp_cp);
            return;
        }
    };

    {
        let cp = comp_cp as *mut IConnectionPoint;
        let vtable = (*cp).vtable;
        let _ = ((*vtable).disconnect)(comp_cp, ctrl_ptr);
    }

    {
        let cp = ctrl_cp as *mut IConnectionPoint;
        let vtable = (*cp).vtable;
        let _ = ((*vtable).disconnect)(ctrl_cp, comp_ptr);
    }

    funknown::release(comp_cp);
    funknown::release(ctrl_cp);
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use std::mem;

    #[test]
    fn vtable_has_5_slots() {
        let slot_count = mem::size_of::<IConnectionPointVtable>()
            / mem::size_of::<*const ()>();
        assert_eq!(slot_count, 5);
    }

    #[test]
    fn iconnection_point_is_single_pointer() {
        assert_eq!(
            mem::size_of::<IConnectionPoint>(),
            mem::size_of::<*const ()>()
        );
    }

    #[test]
    fn iid_iconnection_point_first_bytes() {
        // 70A4156F → little-endian → 6F 15 A4 70
        assert_eq!(IID_ICONNECTION_POINT[0], 0x6F);
        assert_eq!(IID_ICONNECTION_POINT[1], 0x15);
        assert_eq!(IID_ICONNECTION_POINT[2], 0xA4);
        assert_eq!(IID_ICONNECTION_POINT[3], 0x70);
    }
}