// src-tauri/src/vst3_com/ihost.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 IHostApplication — El host expuesto al plugin
// ═══════════════════════════════════════════════════════════════
//
// ── QUÉ ES ──
// Cuando el host llama `component->initialize(context)`, el plugin
// recibe un puntero a un objeto que implementa IHostApplication (o
// alguna interfaz derivada). El plugin lo usa para:
//
//   • Preguntar cómo se llama el host (getName)
//   • Pedir al host que instancie objetos "de servicio" para
//     comunicación interna (createInstance) — raro
//
// ── INVERSIÓN DE ROLES ──
// Aquí Rust actúa como SERVIDOR COM. Definimos la vtable que el
// plugin va a llamar. Todo lo demás (implementación real, singleton,
// refcount) va en `vst3_host_context.rs` (Sub-paso 2.4.c).
//
// ── HERENCIA ──
//
//   FUnknown
//   └── IHostApplication
//         slots 0-2: query_interface, add_ref, release (FUnknown)
//         slot 3:    get_name
//         slot 4:    create_instance
//
// ── ESTADO ACTUAL (Sub-paso 2.4.b) ──
// ✅ IID definido con byte-swap Windows
// ✅ Vtable declarada con signatures correctas
// ✅ String128 alias para claridad
// ⬜ Implementación del objeto DawnHost              [Sub-paso 2.4.c]
// ⬜ Pasar el host a initialize()                    [Paso 2.5]

#![allow(dead_code)]

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};
use super::funknown::FUnknownVtable;
use super::string_convert::STRING128_LEN;

// ═══════════════════════════════════════════════════════════════
// 🎯 IID
// ═══════════════════════════════════════════════════════════════

/// IID de IHostApplication — 58E595CC-DB2A-4969-8AA9-ADEE49BF31C6
///
/// Verificado contra `pluginterfaces/vst/ivsthostapplication.h`:
///   DECLARE_CLASS_IID(IHostApplication,
///       0x58E595CC, 0xDB2A4969, 0x8AA9ADEE, 0x49BF31C6)
pub const IID_IHOST_APPLICATION: Tuid =
    tuid(0x58E595CC, 0xDB2A4969, 0x8AA9ADEE, 0x49BF31C6);

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPO — String128 (buffer que el plugin nos pasa)
// ═══════════════════════════════════════════════════════════════

/// Alias del buffer estándar VST3 para strings cortos.
///
/// El plugin nos pasa un puntero a un buffer de 128 code units UTF-16.
/// Nosotros escribimos el nombre del host respetando el null terminator.
///
/// Ver `string_convert.rs` para las conversiones seguras.
pub type String128 = [u16; STRING128_LEN];

// ═══════════════════════════════════════════════════════════════
// 🎯 VTABLE
// ═══════════════════════════════════════════════════════════════

/// Vtable de IHostApplication.
///
/// Layout (5 slots total):
///   [0-2]  FUnknown (heredado via `base`)
///   [3]    get_name
///   [4]    create_instance (raramente usado — devolveremos kNotImplemented)
///
/// El plugin va a llamar estos métodos en ORDEN de vtable, sin ver
/// nuestro código Rust. Toda la información necesaria para la llamada
/// se pasa vía parámetros (incluyendo `this` como primer arg).
#[repr(C)]
pub struct IHostApplicationVtable {
    // ── Herencia de FUnknown (slots 0-2) ─────────────────
    pub base: FUnknownVtable,

    // ── IHostApplication (slots 3-4) ─────────────────────

    /// get_name(this, name) → HRESULT
    ///
    /// El plugin quiere saber cómo se llama el host.
    /// Debemos escribir el nombre en el buffer `name` como UTF-16
    /// null-terminated, máximo 127 chars + null.
    ///
    /// Retorno:
    ///   S_OK       → nombre escrito correctamente
    ///   kResultFalse → no queremos dar nombre (raro)
    pub get_name: unsafe extern "system" fn(
        this: *mut c_void,
        name: *mut String128,
    ) -> Hresult,

    /// create_instance(this, cid, iid, obj) → HRESULT
    ///
    /// El plugin nos pide instanciar un objeto interno del framework
    /// VST3 (típicamente IMessage o IAttributeList para pasarse info
    /// entre su component y su controller).
    ///
    /// Para plugins simples devolveremos `kNotImplemented`.
    /// Cuando implementemos plugins avanzados, aquí crearemos objetos
    /// según el iid solicitado.
    ///
    /// Retorno:
    ///   S_OK              → obj tiene puntero al objeto creado
    ///   kNotImplemented  → no soportamos esa creación
    pub create_instance: unsafe extern "system" fn(
        this: *mut c_void,
        cid:  *const Tuid,
        iid:  *const Tuid,
        obj:  *mut *mut c_void,
    ) -> Hresult,
}

/// Objeto IHostApplication — puntero a vtable (mismo patrón que
/// cualquier objeto COM).
///
/// ⚠️ IMPORTANTE: cuando implementemos DawnHost (2.4.c), NO usaremos
/// esta struct directamente. La struct real tendrá campos adicionales
/// después del `vtable` (refcount, etc.) pero cuyo layout comience
/// EXACTAMENTE con `*const IHostApplicationVtable`.
///
/// Aquí queda como referencia canónica del layout mínimo esperado
/// por el plugin.
#[repr(C)]
pub struct IHostApplication {
    pub vtable: *const IHostApplicationVtable,
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ── IID byte layout ──────────────────────────────────────

    #[cfg(target_os = "windows")]
    #[test]
    fn iid_ihost_application_windows_bytes() {
        // {58E595CC-DB2A-4969-8AA9-ADEE49BF31C6} en formato COM_COMPATIBLE
        //
        // Descomposición según el algoritmo de tuid():
        //   l1 = 0x58E595CC → LE: [CC, 95, E5, 58]
        //   l2 = 0xDB2A4969
        //     high (0xDB2A) → LE: [2A, DB]
        //     low  (0x4969) → LE: [69, 49]
        //   l3 = 0x8AA9ADEE → BE: [8A, A9, AD, EE]
        //   l4 = 0x49BF31C6 → BE: [49, BF, 31, C6]
        let expected: Tuid = [
            0xCC, 0x95, 0xE5, 0x58,
            0x2A, 0xDB, 0x69, 0x49,
            0x8A, 0xA9, 0xAD, 0xEE,
            0x49, 0xBF, 0x31, 0xC6,
        ];
        assert_eq!(IID_IHOST_APPLICATION, expected,
            "IID de IHostApplication no coincide con SDK");
    }

    // ── Layout de la vtable ──────────────────────────────────

    #[test]
    fn vtable_slot_count_is_5() {
        // 3 (FUnknown) + 2 (IHostApplication) = 5 punteros a fn
        let expected = std::mem::size_of::<usize>() * 5;
        assert_eq!(std::mem::size_of::<IHostApplicationVtable>(), expected);
    }

    #[test]
    fn ihost_application_is_single_pointer() {
        // Un IHostApplication "puro" es solo *vtable = 1 puntero
        // (nuestro DawnHost tendrá más campos, pero el layout mínimo
        // que el plugin ve es este)
        assert_eq!(
            std::mem::size_of::<IHostApplication>(),
            std::mem::size_of::<usize>()
        );
    }

    // ── String128 tamaño ─────────────────────────────────────

    #[test]
    fn string128_is_256_bytes() {
        // El plugin escribe/lee en un buffer de exactamente 256 bytes.
        // Si esto está mal, el plugin sobrescribe memoria adyacente
        // = crash inmediato.
        assert_eq!(std::mem::size_of::<String128>(), 256);
    }
}