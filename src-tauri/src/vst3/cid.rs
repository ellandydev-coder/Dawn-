// src-tauri/src/vst3/cid.rs

#[cfg(target_os = "windows")]
pub fn parse_cid(hex: &str) -> Option<[u8; 16]> {
    if hex.len() != 32 {
        return None;
    }

    let mut out = [0u8; 16];
    for i in 0..16 {
        let byte_str = &hex[i * 2..i * 2 + 2];
        out[i] = u8::from_str_radix(byte_str, 16).ok()?;
    }
    Some(out)
}