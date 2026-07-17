// src-tauri/src/vst3_com/iplugin_base.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 IPluginBase — Ciclo de vida del plugin
// ═══════════════════════════════════════════════════════════════
//
// ── QUÉ ES ──
// IPluginBase es la interfaz que expone el ciclo initialize/terminate
// de cualquier plugin VST3. Es la base de:
//   • IComponent (audio processing)
//   • IEditController (parámetros y UI)
//   • Otros como IProcessContext, etc.
//
// ── HERENCIA ──
//
//   FUnknown
//   └── IPluginBase
//         slots 0-2: query_interface, add_ref, release
//         slot 3:    initialize(host_context)
//         slot 4:    terminate()
//
// ── CICLO DE VIDA ──
//
//   1. Plugin instanciado (Fase 2.3) → estado "created"
//   2. initialize(host) → estado "initialized"
//   3. [uso normal: setActive, process, etc.]
//   4. terminate() → vuelve a "created"
//   5. release() → destruido
//
// Es INVÁLIDO:
//   • Llamar initialize dos veces sin terminate en medio
//   • Llamar terminate sin haber llamado initialize
//   • Hacer process() sin initialize
//
// Nuestro Vst3Registry rastrea el estado con `initialized: bool`
// (Sub-paso 2.5.b) para prevenir estos errores.
//
// ── OBTENER EL IPluginBase DE UN COMPONENT ──
//
// Aunque IComponent hereda de IPluginBase (vtable slots 3-4 son los
// mismos), la spec dice que pidas explícitamente via queryInterface:
//
//   let base = query_interface(component, &IID_IPLUGIN_BASE)?;
//   initialize(base, host);
//   release(base);
//
// Algunos plugins reales solo funcionan correctamente si haces esto.

#![allow(dead_code)]

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};
use super::funknown::FUnknownVtable;

// ═══════════════════════════════════════════════════════════════
// 🎯 IID
// ═══════════════════════════════════════════════════════════════

/// IID de IPluginBase — 22888DDB-156E-45AE-8358-B34808190625
///
/// Verificado en `pluginterfaces/base/ipluginbase.h`:
///   DECLARE_CLASS_IID(IPluginBase,
///       0x22888DDB, 0x156E45AE, 0x8358B348, 0x08190625)
pub const IID_IPLUGIN_BASE: Tuid =
    tuid(0x22888DDB, 0x156E45AE, 0x8358B348, 0x08190625);

// ═══════════════════════════════════════════════════════════════
// 🎯 VTABLE
// ═══════════════════════════════════════════════════════════════

/// Vtable de IPluginBase.
///
/// Layout (5 slots):
///   [0-2] FUnknown (query_interface, add_ref, release)
///   [3]   initialize(host_context) → HRESULT
///   [4]   terminate() → HRESULT
#[repr(C)]
pub struct IPluginBaseVtable {
    pub base: FUnknownVtable,

    /// initialize(this, host_context) → HRESULT
    ///
    /// El plugin arranca. `host_context` es un puntero a un FUnknown
    /// que implementa IHostApplication (nuestro DawnHost).
    ///
    /// Retornos comunes:
    ///   S_OK           → arrancó correctamente
    ///   kResultFalse   → ya estaba inicializado o no puede arrancar
    ///   kInvalidArgument → host_context es inválido
    pub initialize: unsafe extern "system" fn(
        this:         *mut c_void,
        host_context: *mut c_void,
    ) -> Hresult,

    /// terminate(this) → HRESULT
    ///
    /// El plugin se apaga. Simétrico a initialize.
    /// Debe llamarse ANTES de release() si initialize() tuvo éxito.
    pub terminate: unsafe extern "system" fn(this: *mut c_void) -> Hresult,
}

/// Objeto IPluginBase — puntero a vtable.
#[repr(C)]
pub struct IPluginBase {
    pub vtable: *const IPluginBaseVtable,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 WRAPPERS SEGUROS
// ═══════════════════════════════════════════════════════════════

/// Llama a `initialize()` en un IPluginBase.
///
/// SAFETY:
/// - `plugin_base` debe apuntar a un IPluginBase válido (obtenido
///   via queryInterface con IID_IPLUGIN_BASE).
/// - `host_context` debe ser un puntero válido a un objeto que
///   implemente IHostApplication (o NULL si el plugin lo permite).
///
/// Retorna S_OK en éxito, o el HRESULT devuelto por el plugin.
pub unsafe fn initialize(
    plugin_base: *mut c_void,
    host_context: *mut c_void,
) -> Hresult {
    if plugin_base.is_null() {
        return -1;
    }
    let base = plugin_base as *mut IPluginBase;
    let vtable = (*base).vtable;
    if vtable.is_null() {
        return -1;
    }
    ((*vtable).initialize)(plugin_base, host_context)
}

/// Llama a `terminate()` en un IPluginBase.
///
/// SAFETY: `plugin_base` debe ser un IPluginBase válido que
/// haya sido inicializado previamente con `initialize()`.
///
/// Llamar terminate sin haber inicializado ES undefined behavior
/// según la spec — algunos plugins lo toleran, otros crashean.
pub unsafe fn terminate(plugin_base: *mut c_void) -> Hresult {
    if plugin_base.is_null() {
        return -1;
    }
    let base = plugin_base as *mut IPluginBase;
    let vtable = (*base).vtable;
    if vtable.is_null() {
        return -1;
    }
    ((*vtable).terminate)(plugin_base)
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "windows")]
    #[test]
    fn iid_iplugin_base_windows_bytes() {
        // {22888DDB-156E-45AE-8358-B34808190625}
        let expected: Tuid = [
            0xDB, 0x8D, 0x88, 0x22,
            0x6E, 0x15, 0xAE, 0x45,
            0x83, 0x58, 0xB3, 0x48,
            0x08, 0x19, 0x06, 0x25,
        ];
        assert_eq!(IID_IPLUGIN_BASE, expected,
            "IID de IPluginBase no coincide con SDK");
    }

    #[test]
    fn vtable_has_5_slots() {
        // 3 (FUnknown) + 2 (IPluginBase) = 5
        let expected = std::mem::size_of::<usize>() * 5;
        assert_eq!(std::mem::size_of::<IPluginBaseVtable>(), expected);
    }

    #[test]
    fn iplugin_base_is_single_pointer() {
        assert_eq!(
            std::mem::size_of::<IPluginBase>(),
            std::mem::size_of::<usize>()
        );
    }

    #[test]
    fn matches_icomponent_iid_iplugin_base() {
        // Verificar que este IID es EXACTAMENTE el mismo que ya
        // teníamos en icomponent.rs. Ambos deben coincidir (misma constante).
        use crate::vst3_com::icomponent::IID_IPLUGIN_BASE as OTHER;
        assert_eq!(IID_IPLUGIN_BASE, OTHER);
    }
}