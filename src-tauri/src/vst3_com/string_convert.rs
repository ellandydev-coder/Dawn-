// src-tauri/src/vst3_com/string_convert.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 String conversions — UTF-8 ↔ UTF-16 para VST3
// ═══════════════════════════════════════════════════════════════
//
// ── POR QUÉ ESTE MÓDULO ──
// VST3 usa `char16` en todas sus APIs de strings. Es UTF-16 LE,
// 2 bytes por code unit, cross-platform. Rust maneja UTF-8 nativamente,
// así que necesitamos conversiones bidireccionales.
//
// ── TIPOS VST3 ──
//   char16     = u16 (una unidad UTF-16)
//   String128  = [char16; 128]  = [u16; 128] = 256 bytes con null
//
// ── DECISIONES DE DISEÑO ──
//
// 1) NO usamos crates externos (widestring, encoding_rs).
//    Rust std::String::encode_utf16() ya hace exactamente lo que
//    necesitamos, y para VST3 no necesitamos casos edge complejos.
//
// 2) La escritura a buffer del plugin es DEFENSIVA:
//    • Trunca strings largos silenciosamente (mejor cortar que crashear)
//    • Siempre garantiza null terminator
//    • Ignora surrogate pairs mal formados (String de Rust no los tiene)
//
// 3) `str_to_string128` es la única función que expondremos activamente
//    en Fase 2.4. Las demás son helpers para tests y usos futuros.

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

/// Tamaño de String128 según VST3: 128 code units UTF-16 = 256 bytes.
/// Incluye el null terminator, así que el máximo texto real son 127 chars.
pub const STRING128_LEN: usize = 128;

// ═══════════════════════════════════════════════════════════════
// 🎯 UTF-8 → UTF-16 (escribiendo en buffer del plugin)
// ═══════════════════════════════════════════════════════════════

/// Escribe un string Rust en un buffer VST3 String128 (128 u16).
///
/// Comportamiento:
/// - Convierte de UTF-8 a UTF-16 little-endian
/// - Trunca a 127 chars si es más largo (el 128º queda para el null)
/// - Rellena con ceros el resto del buffer
/// - Siempre termina con null (garantía absoluta)
///
/// Retorna el número de code units UTF-16 escritas (SIN contar el null).
///
/// # Ejemplo
///
/// ```text
/// let mut buffer = [0u16; 128];
/// let n = str_to_string128("DAWN", &mut buffer);
/// // n == 4
/// // buffer[0] == b'D' as u16
/// // buffer[4] == 0  (null terminator)
/// `
pub fn str_to_string128(src: &str, dst: &mut [u16; STRING128_LEN]) -> usize {
    // Primero limpiar todo el buffer — garantiza null terminator
    // aunque el string sea más corto.
    for u in dst.iter_mut() {
        *u = 0;
    }

    // Codificar UTF-8 → UTF-16 y copiar hasta 127 unidades.
    // El límite 127 (no 128) asegura que dst[127] siempre queda en 0
    // como null terminator, incluso si el input tiene exactamente
    // 127 code units.
    let max_units = STRING128_LEN - 1;
    let mut count = 0;

    for u16_unit in src.encode_utf16() {
        if count >= max_units {
            break;
        }
        dst[count] = u16_unit;
        count += 1;
    }

    count
}

/// Versión genérica: escribe en cualquier slice u16 (no solo String128).
/// Útil para buffers de otros tamaños en interfaces futuras.
///
/// Como `str_to_string128` pero con longitud dinámica.
/// Retorna el número de u16 escritas (sin contar null).
#[allow(dead_code)]
pub fn str_to_u16_buffer(src: &str, dst: &mut [u16]) -> usize {
    if dst.is_empty() {
        return 0;
    }

    for u in dst.iter_mut() {
        *u = 0;
    }

    let max_units = dst.len() - 1;
    let mut count = 0;

    for u16_unit in src.encode_utf16() {
        if count >= max_units {
            break;
        }
        dst[count] = u16_unit;
        count += 1;
    }

    count
}

// ═══════════════════════════════════════════════════════════════
// 🎯 UTF-16 → UTF-8 (leyendo strings del plugin)
// ═══════════════════════════════════════════════════════════════

/// Lee un string terminado en null de un slice UTF-16.
///
/// Se detiene en el primer 0 encontrado (null terminator estilo C).
/// Si no hay null, lee todo el slice.
///
/// Descarta code units inválidas (surrogate pairs mal formados) usando
/// `String::from_utf16_lossy` — nunca falla, pero puede meter U+FFFD.
#[allow(dead_code)]
pub fn u16_buffer_to_str(src: &[u16]) -> String {
    let end = src.iter().position(|&u| u == 0).unwrap_or(src.len());
    String::from_utf16_lossy(&src[..end])
}

/// Lee un String128 completo y lo convierte a String Rust.
/// Wrapper alrededor de u16_buffer_to_str para el tipo específico.
#[allow(dead_code)]
pub fn string128_to_str(src: &[u16; STRING128_LEN]) -> String {
    u16_buffer_to_str(src)
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ── str_to_string128: casos básicos ──────────────────────

    #[test]
    fn writes_ascii_string_correctly() {
        let mut buf = [0u16; 128];
        let n = str_to_string128("DAWN", &mut buf);

        assert_eq!(n, 4);
        assert_eq!(buf[0], b'D' as u16);
        assert_eq!(buf[1], b'A' as u16);
        assert_eq!(buf[2], b'W' as u16);
        assert_eq!(buf[3], b'N' as u16);
        assert_eq!(buf[4], 0, "debe haber null terminator");
    }

    #[test]
    fn writes_with_null_terminator_even_when_prefilled() {
        // El buffer viene con basura — la función debe limpiarlo
        let mut buf = [0xFFFFu16; 128];
        let n = str_to_string128("Hi", &mut buf);

        assert_eq!(n, 2);
        assert_eq!(buf[0], b'H' as u16);
        assert_eq!(buf[1], b'i' as u16);
        assert_eq!(buf[2], 0);
        assert_eq!(buf[127], 0, "el buffer entero debe estar limpio");
    }

    #[test]
    fn empty_string_writes_zero_units() {
        let mut buf = [0xFFu16; 128];
        let n = str_to_string128("", &mut buf);

        assert_eq!(n, 0);
        assert_eq!(buf[0], 0);
    }

    // ── str_to_string128: truncación ─────────────────────────

    #[test]
    fn truncates_long_string_to_127_units() {
        // 200 chars ASCII → debe truncarse a 127
        let long = "A".repeat(200);
        let mut buf = [0u16; 128];
        let n = str_to_string128(&long, &mut buf);

        assert_eq!(n, 127, "debe truncar a 127 (dejar hueco para null)");
        assert_eq!(buf[0], b'A' as u16);
        assert_eq!(buf[126], b'A' as u16);
        assert_eq!(buf[127], 0, "el último slot debe ser null");
    }

    #[test]
    fn exactly_127_chars_fits_perfectly() {
        let exact = "B".repeat(127);
        let mut buf = [0u16; 128];
        let n = str_to_string128(&exact, &mut buf);

        assert_eq!(n, 127);
        assert_eq!(buf[126], b'B' as u16);
        assert_eq!(buf[127], 0);
    }

    #[test]
    fn exactly_128_chars_still_truncates_to_127() {
        // El char 128 debe descartarse para dejar hueco al null
        let boundary = "C".repeat(128);
        let mut buf = [0u16; 128];
        let n = str_to_string128(&boundary, &mut buf);

        assert_eq!(n, 127);
        assert_eq!(buf[127], 0);
    }

    // ── str_to_string128: UTF-16 con caracteres multi-byte ──

    #[test]
    fn handles_utf16_bmp_characters() {
        // Caracteres del BMP (Basic Multilingual Plane) → 1 u16 cada uno
        let s = "café";  // 'é' = U+00E9 → 1 u16
        let mut buf = [0u16; 128];
        let n = str_to_string128(s, &mut buf);

        assert_eq!(n, 4);
        assert_eq!(buf[0], b'c' as u16);
        assert_eq!(buf[1], b'a' as u16);
        assert_eq!(buf[2], b'f' as u16);
        assert_eq!(buf[3], 0x00E9);
        assert_eq!(buf[4], 0);
    }

    #[test]
    fn handles_utf16_surrogate_pairs() {
        // Emoji fuera del BMP → 2 u16 (surrogate pair)
        // "🎛" = U+1F39B → surrogate pair D83C DF9B
        let s = "🎛";
        let mut buf = [0u16; 128];
        let n = str_to_string128(s, &mut buf);

        assert_eq!(n, 2, "surrogate pair ocupa 2 u16");
        assert_eq!(buf[0], 0xD83C);
        assert_eq!(buf[1], 0xDF9B);
        assert_eq!(buf[2], 0);
    }

    // ── str_to_string128: caso típico de nuestro host ────────

    #[test]
    fn writes_dawn_host_name() {
        // Simula el caso real: escribir el nombre del host
        let mut buf = [0u16; 128];
        let n = str_to_string128("DAWN v0.1.0", &mut buf);

        assert_eq!(n, 11);
        assert_eq!(buf[0],  b'D' as u16);
        assert_eq!(buf[4],  b' ' as u16);
        assert_eq!(buf[5],  b'v' as u16);
        assert_eq!(buf[10], b'0' as u16);
        assert_eq!(buf[11], 0);
    }

    // ── str_to_u16_buffer: mismo comportamiento con slice ────

    #[test]
    fn generic_buffer_respects_size() {
        let mut small = [0u16; 5];
        let n = str_to_u16_buffer("Hello, World", &mut small);

        assert_eq!(n, 4, "en buffer de 5, escribimos 4 + null");
        assert_eq!(small[0], b'H' as u16);
        assert_eq!(small[3], b'l' as u16);
        assert_eq!(small[4], 0);
    }

    #[test]
    fn generic_buffer_zero_size_returns_zero() {
        let mut empty: [u16; 0] = [];
        let n = str_to_u16_buffer("anything", &mut empty);
        assert_eq!(n, 0);
    }

    // ── u16_buffer_to_str: leer strings del plugin ───────────

    #[test]
    fn reads_null_terminated_string() {
        let buf: [u16; 6] = [b'H' as u16, b'i' as u16, 0, 0xFFFF, 0xAAAA, 0xBBBB];
        assert_eq!(u16_buffer_to_str(&buf), "Hi");
    }

    #[test]
    fn reads_full_buffer_when_no_null() {
        let buf: [u16; 3] = [b'A' as u16, b'B' as u16, b'C' as u16];
        assert_eq!(u16_buffer_to_str(&buf), "ABC");
    }

    #[test]
    fn reads_empty_buffer() {
        let buf: [u16; 0] = [];
        assert_eq!(u16_buffer_to_str(&buf), "");
    }

    #[test]
    fn reads_empty_when_null_at_start() {
        let buf: [u16; 5] = [0, b'X' as u16, b'X' as u16, b'X' as u16, b'X' as u16];
        assert_eq!(u16_buffer_to_str(&buf), "");
    }

    // ── Roundtrip: write + read debe ser identidad ───────────

    #[test]
    fn roundtrip_ascii() {
        let original = "Hello DAWN 123";
        let mut buf = [0u16; 128];
        str_to_string128(original, &mut buf);
        assert_eq!(string128_to_str(&buf), original);
    }

    #[test]
    fn roundtrip_utf16_bmp() {
        let original = "Café ñoño 東京";
        let mut buf = [0u16; 128];
        str_to_string128(original, &mut buf);
        assert_eq!(string128_to_str(&buf), original);
    }

    #[test]
    fn roundtrip_with_emoji_surrogate_pairs() {
        let original = "DAWN 🎛️ 🎚️";
        let mut buf = [0u16; 128];
        str_to_string128(original, &mut buf);
        assert_eq!(string128_to_str(&buf), original);
    }

    // ── Layout / tamaño ──────────────────────────────────────

    #[test]
    fn string128_size_is_256_bytes() {
        // Verificación crítica: el buffer que enviamos al plugin
        // debe ser EXACTAMENTE 256 bytes o el plugin lee/escribe fuera.
        assert_eq!(std::mem::size_of::<[u16; STRING128_LEN]>(), 256);
    }
}