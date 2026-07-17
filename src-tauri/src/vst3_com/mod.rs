// src-tauri/src/vst3_com/mod.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 VST3 COM — Módulo de tipos e interfaces COM
// ═══════════════════════════════════════════════════════════════
//
// ── PROPÓSITO ──
// Todo el layout binario de VST3 vive aquí:
//   • Tipos primitivos (Tuid, HRESULT, calling conventions)
//   • Helpers de construcción de IIDs con byte-swap Windows
//   • Vtables de cada interfaz (FUnknown, IPluginFactory, IComponent...)
//   • Wrappers "seguros" tipo ComPtr que encapsulan unsafe
//
// ── SUB-MÓDULOS ──
//   funknown    → FUnknown (base de todas las interfaces COM)
//   ifactory    → IPluginFactory (entrada al DLL)
//   icomponent  → IComponent (instancia de un plugin)
//
// A medida que añadamos soporte para más interfaces (IAudioProcessor,
// IEditController, IHostApplication, IPlugView...) creamos un nuevo
// sub-módulo por cada una y lo declaramos aquí abajo.

pub mod funknown;
pub mod ifactory;
pub mod icomponent;
pub mod string_convert;  // ← NUEVO
pub mod ihost;              // ← NUEVO
// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS PRIMITIVOS
// ═══════════════════════════════════════════════════════════════

/// VST3 usa TUID (16 bytes) como identificador de interfaz/clase.
/// Equivalente a GUID/IID de COM clásico.
pub type Tuid = [u8; 16];

/// HRESULT es el tipo de retorno estándar de COM.
///   0        = S_OK
///   1        = S_FALSE (no es error, valor informativo)
///   negativo = error
pub type Hresult = i32;

/// S_OK — operación exitosa.
pub const S_OK: Hresult = 0;

/// S_FALSE — operación exitosa pero con resultado "negativo lógico".
/// Ej: getState() cuando no hay estado que devolver.
#[allow(dead_code)]
pub const S_FALSE: Hresult = 1;

/// Puntero opaco a un objeto COM.
pub type ComPtr = *mut core::ffi::c_void;

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPER — Construir TUID con byte-swap para Windows
// ═══════════════════════════════════════════════════════════════
//
// VST3 tiene un twist propio con los IIDs. El SDK define una macro:
//
//   #define DECLARE_CLASS_IID(name, l1, l2, l3, l4) \
//       const TUID name##_iid = INLINE_UID(l1, l2, l3, l4);
//
// En Windows (`COM_COMPATIBLE`), INLINE_UID reordena los bytes:
//
//   Ej: DECLARE_CLASS_IID(IComponent, 0xE831FF31, 0xF2D54301, 0x928EBBEE, 0x25697802)
//
//   Windows layout (byte-swapped):
//     [0x31, 0xFF, 0x31, 0xE8,   ← primer u32 en little-endian
//      0x01, 0x43, 0xD5, 0xF2,   ← siguientes dos u16 byte-swapped
//      0x92, 0x8E, 0xBB, 0xEE,   ← resto tal cual
//      0x25, 0x69, 0x78, 0x02]
//
//   Non-Windows layout (raw):
//     [0xE8, 0x31, 0xFF, 0x31, 0xF2, 0xD5, 0x43, 0x01,
//      0x92, 0x8E, 0xBB, 0xEE, 0x25, 0x69, 0x78, 0x02]
//
// Este helper hace la conversión correcta según el target OS.
// Los tests en cada módulo verifican contra bytes conocidos.

/// Construye un TUID a partir de los 4 uint32 que aparecen en las
/// declaraciones del SDK VST3.
///
/// Uso:
///   const IID_ICOMPONENT: Tuid = tuid(0xE831FF31, 0xF2D54301, 0x928EBBEE, 0x25697802);
#[cfg(target_os = "windows")]
pub const fn tuid(l1: u32, l2: u32, l3: u32, l4: u32) -> Tuid {
    // Windows COM layout: primer u32 en little-endian,
    // luego dos u16 byte-swapped, resto tal cual.
    [
        // l1 → bytes 3..0 (little-endian del primer u32)
        ((l1 & 0x000000FF) >>  0) as u8,
        ((l1 & 0x0000FF00) >>  8) as u8,
        ((l1 & 0x00FF0000) >> 16) as u8,
        ((l1 & 0xFF000000) >> 24) as u8,
        // l2 dividido en dos u16 byte-swapped
        //   l2 high half (bits 16..31) como u16 LE
        ((l2 & 0x00FF0000) >> 16) as u8,
        ((l2 & 0xFF000000) >> 24) as u8,
        //   l2 low half (bits 0..15) como u16 LE
        ((l2 & 0x000000FF) >>  0) as u8,
        ((l2 & 0x0000FF00) >>  8) as u8,
        // l3, l4: raw bytes big-endian
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

/// Versión non-Windows: layout raw big-endian de los 4 u32.
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

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS — verificar byte-order del helper tuid()
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // Bytes conocidos calculados según el SDK VST3 oficial de Steinberg.
    // Referencia: pluginterfaces/base/funknown.h y ivstcomponent.h
    //
    // Layout Windows COM_COMPATIBLE del GUID {E831FF31-F2D5-4301-928E-BBEE25697802}:
    //   bytes 0-3:  little-endian de 0xE831FF31 → [31, FF, 31, E8]
    //   bytes 4-5:  little-endian de 0xF2D5     → [D5, F2]
    //   bytes 6-7:  little-endian de 0x4301     → [01, 43]
    //   bytes 8-15: raw big-endian del resto    → [92, 8E, BB, EE, 25, 69, 78, 02]

    #[cfg(target_os = "windows")]
    #[test]
    fn tuid_windows_icomponent_layout() {
        // DECLARE_CLASS_IID(IComponent, 0xE831FF31, 0xF2D54301, 0x928EBBEE, 0x25697802)
        let iid = tuid(0xE831FF31, 0xF2D54301, 0x928EBBEE, 0x25697802);

        let expected: Tuid = [
            0x31, 0xFF, 0x31, 0xE8,  // l1 LE
            0xD5, 0xF2, 0x01, 0x43,  // l2 = high_LE + low_LE
            0x92, 0x8E, 0xBB, 0xEE,  // l3 big-endian
            0x25, 0x69, 0x78, 0x02,  // l4 big-endian
        ];

        assert_eq!(iid, expected, "IID de IComponent no coincide con SDK");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn tuid_windows_funknown_layout() {
        // DECLARE_CLASS_IID(FUnknown, 0x00000000, 0x00000000, 0xC0000000, 0x00000046)
        let iid = tuid(0x00000000, 0x00000000, 0xC0000000, 0x00000046);

        let expected: Tuid = [
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0xC0, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x46,
        ];

        assert_eq!(iid, expected);
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn tuid_non_windows_raw_layout() {
        let iid = tuid(0xE831FF31, 0xF2D54301, 0x928EBBEE, 0x25697802);
        let expected: Tuid = [
            0xE8, 0x31, 0xFF, 0x31,
            0xF2, 0xD5, 0x43, 0x01,
            0x92, 0x8E, 0xBB, 0xEE,
            0x25, 0x69, 0x78, 0x02,
        ];
        assert_eq!(iid, expected);
    }
}