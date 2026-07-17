// src-tauri/src/metadata.rs
//
// Detección de metadatos de plugins VST3.
// Aplica una cadena de fallbacks:
//
//   Tier 1: moduleinfo.json (VST3 SDK 3.7.4+ bundles)
//   Tier 2: Heurística por carpeta padre + keywords
//   Tier 3: Defaults ("Unknown", "other")
//
// La heurística es intencionalmente CONSERVADORA:
// preferimos "other" antes que una categoría incorrecta.

use std::path::Path;

use crate::moduleinfo;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPO PÚBLICO
// ═══════════════════════════════════════════════════════════════

/// Metadatos derivados de la detección (Tier 1, 2 o 3).
/// Consumido por `plugins.rs` para poblar `ScannedPlugin`.
#[derive(Debug, Clone)]
pub struct PluginMetadata {
    pub vendor: String,
    pub category: String,
    pub version: String,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 VENDOR (Tier 2 — carpeta padre)
// ═══════════════════════════════════════════════════════════════

const ROOT_VST3_FOLDERS: &[&str] = &[
    "vst3",
    "vst",
    "vstplugins",
    "common files",
    "program files",
    "program files (x86)",
    "audio",
    "plug-ins",
    "plugins",
    "library",
    // carpetas internas de bundles VST3: nunca son vendor real
    "contents",
    "resources",
    "x86_64-win",
    "x86_64-linux",
    "macos",
];

pub fn detect_vendor(path: &Path) -> String {
    let parent = match path.parent() {
        Some(p) => p,
        None => return "Unknown".to_string(),
    };

    let parent_name = match parent.file_name().and_then(|s| s.to_str()) {
        Some(name) => name.to_string(),
        None => return "Unknown".to_string(),
    };

    let parent_lower = parent_name.to_lowercase();
    if ROOT_VST3_FOLDERS.contains(&parent_lower.as_str()) {
        return "Unknown".to_string();
    }

    parent_name
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CATEGORY (Tier 2 — keywords en el nombre)
// ═══════════════════════════════════════════════════════════════

struct CategoryRule {
    keywords: &'static [&'static str],
    category: &'static str,
}

const CATEGORY_RULES: &[CategoryRule] = &[
    CategoryRule {
        keywords: &[
            "compressor",
            "comp ",
            "-comp",
            "limiter",
            "gate",
            "expander",
            "denoiser",
            "denoise",
            "noisereducer",
            "noise reducer",
            "noisereduction",
            "noise reduction",
        ],
        category: "dynamics",
    },
    CategoryRule {
        keywords: &["equalizer", "eq ", "-eq", " eq"],
        category: "eq",
    },
    CategoryRule {
        keywords: &["filter"],
        category: "filter",
    },
    CategoryRule {
        keywords: &["reverb", "verb", "room", "hall", "plate", "spring"],
        category: "reverb",
    },
    CategoryRule {
        keywords: &["delay", "echo"],
        category: "delay",
    },
    CategoryRule {
        keywords: &["chorus", "flanger", "phaser", "tremolo", "vibrato"],
        category: "modulation",
    },
    CategoryRule {
        keywords: &[
            "distortion",
            "saturation",
            "drive",
            "fuzz",
            "overdrive",
            "bitcrush",
        ],
        category: "distortion",
    },
    CategoryRule {
        keywords: &["analyzer", "spectrum", "scope", "meter", "vu meter"],
        category: "analyzer",
    },
    CategoryRule {
        keywords: &[
            "auto-tune",
            "autotune",
            "auto-key",
            "autokey",
            "harmony",
            "pitch",
            "vocodist",
            "melodyne",
        ],
        category: "pitch",
    },
];

pub fn detect_category(name: &str) -> String {
    let name_lower = name.to_lowercase();

    for rule in CATEGORY_RULES {
        for keyword in rule.keywords {
            if name_lower.contains(keyword) {
                return rule.category.to_string();
            }
        }
    }

    "other".to_string()
}

// ═══════════════════════════════════════════════════════════════
// 🎯 API PÚBLICA — Detección con fallback
// ═══════════════════════════════════════════════════════════════

/// Detecta los metadatos de un plugin con fallback encadenado:
///
/// 1. **Tier 1**: Si es un bundle .vst3, busca moduleinfo.json
/// 2. **Tier 2**: Heurística (carpeta padre + keywords en nombre)
/// 3. **Tier 3**: Defaults ("Unknown", "other", "0.0.0")
pub fn detect_metadata(path: &Path, name: &str) -> PluginMetadata {
    // ─── Tier 1: moduleinfo.json ───────────────────────────────
    if let Some(info) = moduleinfo::parse_moduleinfo(path) {
        log::debug!(
            "[metadata] Tier 1 (moduleinfo): {} → vendor={}, cat={}, ver={}",
            name,
            info.vendor,
            info.category,
            info.version
        );
        return PluginMetadata {
            vendor: info.vendor,
            category: info.category,
            version: info.version,
        };
    }

    // ─── Tier 2: Heurística ────────────────────────────────────
    let vendor = detect_vendor(path);
    let category = detect_category(name);

    log::debug!(
        "[metadata] Tier 2 (heuristic): {} → vendor={}, cat={}",
        name,
        vendor,
        category
    );

    PluginMetadata {
        vendor,
        category,
        version: "0.0.0".to_string(),
    }
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn vendor_from_subfolder() {
        let path =
            PathBuf::from("C:\\Program Files\\Common Files\\VST3\\Antares\\Auto-Tune Pro.vst3");
        assert_eq!(detect_vendor(&path), "Antares");
    }

    #[test]
    fn vendor_unknown_when_in_root() {
        let path = PathBuf::from("C:\\Program Files\\Common Files\\VST3\\Auxfeed.vst3");
        assert_eq!(detect_vendor(&path), "Unknown");
    }

    #[test]
    fn category_dynamics_wins_over_pitch() {
        assert_eq!(detect_category("Auto-Tune Vocal Compressor"), "dynamics");
    }

    #[test]
    fn category_eq_from_name() {
        assert_eq!(detect_category("Auto-Tune Vocal EQ"), "eq");
        assert_eq!(detect_category("Pro-Q 3"), "other");
    }

    #[test]
    fn category_reverb() {
        assert_eq!(detect_category("Vocal Reverb"), "reverb");
        assert_eq!(detect_category("ValhallaVintageVerb"), "reverb");
    }

    #[test]
    fn category_pitch() {
        assert_eq!(detect_category("Auto-Tune Pro"), "pitch");
        assert_eq!(detect_category("Auto-Key"), "pitch");
        assert_eq!(detect_category("Harmony Engine 4x"), "pitch");
    }

    #[test]
    fn category_saturation() {
        assert_eq!(detect_category("Saturation Knob"), "distortion");
    }

    #[test]
    fn category_denoiser() {
        assert_eq!(detect_category("Bertom_DenoiserClassic"), "dynamics");
        assert_eq!(detect_category("TL-NoiseReducer"), "dynamics");
    }

    #[test]
    fn category_other_when_nothing_matches() {
        assert_eq!(detect_category("AVOX SYBIL"), "other");
        assert_eq!(detect_category("Mic Mod"), "other");
        assert_eq!(detect_category("Auxfeed"), "other");
    }

    #[test]
fn vendor_unknown_when_inside_bundle_internal_folder() {
    let path = PathBuf::from(
        "C:\\Program Files\\Common Files\\VST3\\Auxfeed.vst3\\Contents\\x86_64-win\\Auxfeed.vst3"
    );
    assert_eq!(detect_vendor(&path), "Unknown");
    }
    
}