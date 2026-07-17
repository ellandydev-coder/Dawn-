// src-tauri/src/vst3_com/iplug_view.rs
//
// Layout COM de IPlugView (VST3 SDK)
//
// IPlugView es la interfaz que permite al plugin dibujar su UI
// dentro de una ventana nativa que nosotros creamos.

#![allow(dead_code)]

use core::ffi::c_void;
use super::Tuid;

// ═══════════════════════════════════════════════════════════════
// 🎯 IID
// ═══════════════════════════════════════════════════════════════

/// IID de IPlugView — del VST3 SDK
/// {5BC32507-D060-49EA-A615-1B522B755B29}
pub const IID_IPLUG_VIEW: Tuid = [
    0x5B, 0xC3, 0x25, 0x07,
    0xD0, 0x60, 0x49, 0xEA,
    0xA6, 0x15, 0x1B, 0x52,
    0x2B, 0x75, 0x5B, 0x29,
];

// ═══════════════════════════════════════════════════════════════
// 🎯 ViewRect — tamaño de la ventana
// ═══════════════════════════════════════════════════════════════

/// Rectángulo que describe el tamaño de la vista del plugin.
/// Coordenadas en píxeles, origen top-left.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct ViewRect {
    pub left:   i32,
    pub top:    i32,
    pub right:  i32,
    pub bottom: i32,
}

impl ViewRect {
    pub fn new(width: i32, height: i32) -> Self {
        Self { left: 0, top: 0, right: width, bottom: height }
    }

    pub fn width(&self)  -> i32 { self.right  - self.left }
    pub fn height(&self) -> i32 { self.bottom - self.top  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 VTABLE
// ═══════════════════════════════════════════════════════════════

/// Vtable de IPlugView.
/// 15 slots en total (3 FUnknown + 12 IPlugView).
#[repr(C)]
pub struct IPlugViewVtable {
    // ── FUnknown (slots 0-2) ─────────────────────────────────
    pub query_interface: unsafe extern "system" fn(
        this: *mut c_void,
        iid:  *const Tuid,
        obj:  *mut *mut c_void,
    ) -> i32,

    pub add_ref: unsafe extern "system" fn(this: *mut c_void) -> u32,
    pub release: unsafe extern "system" fn(this: *mut c_void) -> u32,

    // ── IPlugView (slots 3-14) ───────────────────────────────

    /// [3] Pregunta si soporta el tipo de plataforma.
    /// Para Windows: pasar b"HWND\0"
    /// Retorna S_OK si soporta, kResultFalse si no.
    pub is_platform_type_supported: unsafe extern "system" fn(
        this: *mut c_void,
        type_: *const u8,
    ) -> i32,

    /// [4] Adjunta la vista a una ventana nativa.
    /// `parent` = HWND en Windows
    /// `type_`  = b"HWND\0"
    pub attached: unsafe extern "system" fn(
        this:   *mut c_void,
        parent: *mut c_void,
        type_:  *const u8,
    ) -> i32,

    /// [5] Quita la vista de la ventana.
    pub removed: unsafe extern "system" fn(this: *mut c_void) -> i32,

    /// [6] Rueda del ratón.
    pub on_wheel: unsafe extern "system" fn(
        this:     *mut c_void,
        distance: f32,
    ) -> i32,

    /// [7] Tecla presionada.
    pub on_key_down: unsafe extern "system" fn(
        this:    *mut c_void,
        key:     u16,
        key_code: i16,
        modifiers: i16,
    ) -> i32,

    /// [8] Tecla liberada.
    pub on_key_up: unsafe extern "system" fn(
        this:     *mut c_void,
        key:      u16,
        key_code: i16,
        modifiers: i16,
    ) -> i32,

    /// [9] Tamaño preferido del plugin.
    /// Escribimos en `size` el ViewRect que el plugin quiere.
    pub get_size: unsafe extern "system" fn(
        this: *mut c_void,
        size: *mut ViewRect,
    ) -> i32,

    /// [10] Notifica al plugin del tamaño actual de la ventana.
    pub on_size: unsafe extern "system" fn(
        this:      *mut c_void,
        new_size:  *mut ViewRect,
    ) -> i32,

    /// [11] Foco de la ventana cambió.
    pub on_focus: unsafe extern "system" fn(
        this:  *mut c_void,
        state: u8,
    ) -> i32,

    /// [12] Asigna handler de resize (IPlugFrame).
    pub set_frame: unsafe extern "system" fn(
        this:  *mut c_void,
        frame: *mut c_void,
    ) -> i32,

    /// [13] ¿Puede redimensionarse?
    pub can_resize: unsafe extern "system" fn(this: *mut c_void) -> i32,

    /// [14] Verifica/ajusta restricciones de tamaño.
    pub check_size_constraint: unsafe extern "system" fn(
        this: *mut c_void,
        rect: *mut ViewRect,
    ) -> i32,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 STRUCT
// ═══════════════════════════════════════════════════════════════

#[repr(C)]
pub struct IPlugView {
    pub vtable: *const IPlugViewVtable,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

/// Constante para el tipo de plataforma Windows.
pub const PLATFORM_TYPE_HWND: &[u8] = b"HWND\0";

/// Pregunta si el plugin soporta ventana HWND.
pub unsafe fn is_platform_supported(view: *mut c_void) -> bool {
    let v = view as *mut IPlugView;
    let vtable = (*v).vtable;
    if vtable.is_null() { return false; }

    let hr = ((*vtable).is_platform_type_supported)(view, PLATFORM_TYPE_HWND.as_ptr());
    let supported = hr == 0; // S_OK
    log::info!("[iplug_view] isPlatformTypeSupported('HWND') → {} (hr=0x{:08X})", supported, hr as u32);
    supported
}

/// Obtiene el tamaño preferido del plugin.
pub unsafe fn get_size(view: *mut c_void) -> Result<ViewRect, i32> {
    let v = view as *mut IPlugView;
    let vtable = (*v).vtable;
    if vtable.is_null() { return Err(-1); }

    let mut rect = ViewRect::default();
    let hr = ((*vtable).get_size)(view, &mut rect);

    if hr == 0 {
        log::info!(
            "[iplug_view] getSize → {}x{}",
            rect.width(), rect.height()
        );
        Ok(rect)
    } else {
        log::warn!("[iplug_view] getSize falló: HRESULT=0x{:08X}", hr as u32);
        Err(hr)
    }
}

/// Adjunta la vista a un HWND.
pub unsafe fn attached(view: *mut c_void, hwnd: *mut c_void) -> i32 {
    let v = view as *mut IPlugView;
    let vtable = (*v).vtable;
    if vtable.is_null() { return -1; }

    let hr = ((*vtable).attached)(view, hwnd, PLATFORM_TYPE_HWND.as_ptr());
    log::info!(
        "[iplug_view] attached(hwnd=0x{:016x}) → HRESULT=0x{:08X}",
        hwnd as usize, hr as u32
    );
    hr
}

/// Notifica al plugin del tamaño de la ventana.
pub unsafe fn on_size(view: *mut c_void, rect: &mut ViewRect) -> i32 {
    let v = view as *mut IPlugView;
    let vtable = (*v).vtable;
    if vtable.is_null() { return -1; }

    let hr = ((*vtable).on_size)(view, rect as *mut ViewRect);
    log::info!(
        "[iplug_view] onSize({}x{}) → HRESULT=0x{:08X}",
        rect.width(), rect.height(), hr as u32
    );
    hr
}

/// Desvincula la vista de la ventana.
pub unsafe fn removed(view: *mut c_void) -> i32 {
    let v = view as *mut IPlugView;
    let vtable = (*v).vtable;
    if vtable.is_null() { return -1; }

    let hr = ((*vtable).removed)(view);
    log::info!("[iplug_view] removed() → HRESULT=0x{:08X}", hr as u32);
    hr
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use std::mem;

    #[test]
    fn vtable_has_15_slots() {
        let slot_count = mem::size_of::<IPlugViewVtable>()
            / mem::size_of::<*const ()>();
        assert_eq!(slot_count, 15, "IPlugViewVtable debe tener 15 slots");
    }

    #[test]
    fn iplug_view_is_single_pointer() {
        assert_eq!(
            mem::size_of::<IPlugView>(),
            mem::size_of::<*const ()>()
        );
    }

    #[test]
    fn view_rect_dimensions() {
        let r = ViewRect::new(800, 600);
        assert_eq!(r.width(),  800);
        assert_eq!(r.height(), 600);
        assert_eq!(r.left,   0);
        assert_eq!(r.top,    0);
        assert_eq!(r.right,  800);
        assert_eq!(r.bottom, 600);
    }

    #[test]
    fn view_rect_default_is_zero() {
        let r = ViewRect::default();
        assert_eq!(r.width(),  0);
        assert_eq!(r.height(), 0);
    }

    #[test]
    fn iid_iplug_view_first_bytes() {
        assert_eq!(IID_IPLUG_VIEW[0], 0x5B);
        assert_eq!(IID_IPLUG_VIEW[1], 0xC3);
        assert_eq!(IID_IPLUG_VIEW[2], 0x25);
        assert_eq!(IID_IPLUG_VIEW[3], 0x07);
    }

    #[test]
    fn platform_type_hwnd_is_null_terminated() {
        assert_eq!(PLATFORM_TYPE_HWND, b"HWND\0");
        assert_eq!(PLATFORM_TYPE_HWND.last(), Some(&0u8));
    }
}