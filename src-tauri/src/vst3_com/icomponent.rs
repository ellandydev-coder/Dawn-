// src-tauri/src/vst3_com/icomponent.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 IComponent — Instancia viva de un plugin VST3
// ═══════════════════════════════════════════════════════════════
//
// ── QUÉ ES ──
// IComponent representa un plugin instanciado. Se obtiene via:
//   factory->createInstance(cid, IID_ICOMPONENT, &out_component)
//
// donde `cid` es el CID de una clase con category = "Audio Module Class".
//
// Un IComponent nos permite:
//   • Inicializar/apagar el plugin (initialize/terminate)
//   • Consultar buses de audio de entrada/salida
//   • Activar/desactivar el plugin
//   • Guardar/restaurar estado (preset)
//   • Vincular con su controller (getControllerClassId)
//
// ── HERENCIA ──
//
//   FUnknown       (slots 0-2: query, addRef, release)
//   └── IPluginBase (slots 3-4: initialize, terminate)
//       └── IComponent (slots 5+: getControllerClassId, ...)
//
// Cada nivel añade slots al final de la vtable — nunca insertados
// en medio. Esto es la esencia de la "herencia" en COM.
//
// ── ESTADO ACTUAL (Paso 2.2) ──
// ✅ Definido el layout completo de la vtable
// ✅ IID_ICOMPONENT correcto (con byte-swap Windows)
// ⬜ createInstance() ← siguiente paso (2.3)
// ⬜ initialize() con host context ← Paso 2.4
// ⬜ Enumerar buses de audio ← Fase futura

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};
use super::funknown::FUnknownVtable;

// ═══════════════════════════════════════════════════════════════
// 🎯 IIDs
// ═══════════════════════════════════════════════════════════════

/// IID de IPluginBase — 22888DDB-156E-45AE-8358-B34808190625
pub const IID_IPLUGIN_BASE: Tuid =
    tuid(0x22888DDB, 0x156E45AE, 0x8358B348, 0x08190625);

/// IID de IComponent — E831FF31-F2D5-4301-928E-BBEE25697802
pub const IID_ICOMPONENT: Tuid =
    tuid(0xE831FF31, 0xF2D54301, 0x928EBBEE, 0x25697802);

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES ADICIONALES
// ═══════════════════════════════════════════════════════════════

/// Media type: audio (usado en getBusInfo, activateBus, etc.)
#[allow(dead_code)]
pub const MEDIA_TYPE_AUDIO: i32 = 0;

/// Media type: event (MIDI)
#[allow(dead_code)]
pub const MEDIA_TYPE_EVENT: i32 = 1;

/// Bus direction: input
#[allow(dead_code)]
pub const BUS_DIRECTION_INPUT: i32 = 0;

/// Bus direction: output
#[allow(dead_code)]
pub const BUS_DIRECTION_OUTPUT: i32 = 1;

// ═══════════════════════════════════════════════════════════════
// 🎯 STRUCT BusInfo (para uso futuro en getBusInfo)
// ═══════════════════════════════════════════════════════════════

/// BusInfo — información de un bus de audio/MIDI del plugin.
///
/// Layout de `pluginterfaces/vst/ivstcomponent.h`:
///
///   struct BusInfo {
///       MediaType     mediaType;    // 4 bytes (int32)
///       BusDirection  direction;    // 4 bytes (int32)
///       int32         channelCount; // 4 bytes
///       String128     name;         // 256 bytes (128 chars UTF-16)
///       BusType       busType;      // 4 bytes (int32)
///       uint32        flags;        // 4 bytes
///   };                              // total: 276 bytes
#[allow(dead_code)]
#[repr(C)]
pub struct BusInfo {
    pub media_type:    i32,
    pub direction:     i32,
    pub channel_count: i32,
    /// Nombre en UTF-16 (128 chars). VST3 usa `char16` no `wchar_t`.
    pub name:          [u16; 128],
    pub bus_type:      i32,
    pub flags:         u32,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 VTABLE
// ═══════════════════════════════════════════════════════════════

/// Vtable de IComponent.
///
/// Layout completo (14 slots):
///   [0-2]  FUnknown       (query_interface, add_ref, release)
///   [3-4]  IPluginBase    (initialize, terminate)
///   [5-13] IComponent     (get_controller_class_id ... get_state)
#[repr(C)]
pub struct IComponentVtable {
    // ── FUnknown (slots 0-2) ──────────────────────────────
    pub base: FUnknownVtable,

    // ── IPluginBase (slots 3-4) ───────────────────────────

    /// initialize(this, host_context) → HRESULT
    /// El plugin arranca. `host_context` es un puntero a un FUnknown
    /// que el host provee — típicamente un IHostApplication. Muchos
    /// plugins funcionan con NULL, otros crashean sin él (Paso 2.4).
    pub initialize: unsafe extern "system" fn(
        this:    *mut c_void,
        context: *mut c_void,
    ) -> Hresult,

    /// terminate(this) → HRESULT
    /// El plugin se apaga. Simétrico a initialize.
    pub terminate: unsafe extern "system" fn(this: *mut c_void) -> Hresult,

    // ── IComponent (slots 5-13) ───────────────────────────

    /// get_controller_class_id(this, out_cid) → HRESULT
    /// Devuelve el CID del IEditController asociado a este componente.
    /// El host debe instanciarlo por separado para tener UI/parámetros.
    pub get_controller_class_id: unsafe extern "system" fn(
        this:    *mut c_void,
        out_cid: *mut Tuid,
    ) -> Hresult,

    /// set_io_mode(this, mode) → HRESULT
    /// Configura modo de I/O (ej: advanced, offline). Casi nunca se usa.
    pub set_io_mode: unsafe extern "system" fn(
        this: *mut c_void,
        mode: i32,
    ) -> Hresult,

    /// get_bus_count(this, media_type, direction) → nº de buses
    pub get_bus_count: unsafe extern "system" fn(
        this:       *mut c_void,
        media_type: i32,
        direction:  i32,
    ) -> i32,

    /// get_bus_info(this, media_type, direction, index, out) → HRESULT
    pub get_bus_info: unsafe extern "system" fn(
        this:       *mut c_void,
        media_type: i32,
        direction:  i32,
        index:      i32,
        info:       *mut BusInfo,
    ) -> Hresult,

    /// get_routing_info(this, in_info, out_info) → HRESULT
    /// Routing MIDI/audio. Raramente usado.
    pub get_routing_info: unsafe extern "system" fn(
        this:     *mut c_void,
        in_info:  *mut c_void,
        out_info: *mut c_void,
    ) -> Hresult,

    /// activate_bus(this, media_type, direction, index, state) → HRESULT
    /// Habilita/deshabilita un bus específico.
    pub activate_bus: unsafe extern "system" fn(
        this:       *mut c_void,
        media_type: i32,
        direction:  i32,
        index:      i32,
        state:      u8,   // TBool = uint8
    ) -> Hresult,

    /// set_active(this, state) → HRESULT
    /// Activa/desactiva el plugin completo. Debe llamarse antes de process.
    pub set_active: unsafe extern "system" fn(
        this:  *mut c_void,
        state: u8,
    ) -> Hresult,

    /// set_state(this, stream) → HRESULT
    /// Restaura estado del plugin desde un IBStream (preset).
    pub set_state: unsafe extern "system" fn(
        this:   *mut c_void,
        stream: *mut c_void,
    ) -> Hresult,

    /// get_state(this, stream) → HRESULT
    /// Guarda estado del plugin en un IBStream (preset).
    pub get_state: unsafe extern "system" fn(
        this:   *mut c_void,
        stream: *mut c_void,
    ) -> Hresult,
}

/// Objeto IComponent — puntero a vtable.
#[repr(C)]
pub struct IComponent {
    pub vtable: *const IComponentVtable,
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "windows")]
    #[test]
    fn iid_icomponent_windows_bytes() {
        // {E831FF31-F2D5-4301-928E-BBEE25697802}
        let expected: Tuid = [
            0x31, 0xFF, 0x31, 0xE8,
            0xD5, 0xF2, 0x01, 0x43,
            0x92, 0x8E, 0xBB, 0xEE,
            0x25, 0x69, 0x78, 0x02,
        ];
        assert_eq!(IID_ICOMPONENT, expected,
            "IID de IComponent no coincide con SDK");
    }

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
        assert_eq!(IID_IPLUGIN_BASE, expected);
    }

    #[test]
    fn vtable_slot_count_is_14() {
        // 3 (FUnknown) + 2 (IPluginBase) + 9 (IComponent) = 14
        let expected = std::mem::size_of::<usize>() * 14;
        assert_eq!(std::mem::size_of::<IComponentVtable>(), expected);
    }

    #[test]
    fn bus_info_layout() {
        // 4 + 4 + 4 + 256 + 4 + 4 = 276 bytes
        assert_eq!(std::mem::size_of::<BusInfo>(), 276);
    }
}