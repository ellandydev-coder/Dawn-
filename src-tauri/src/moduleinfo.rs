// src-tauri/src/moduleinfo.rs
//
// Parser de moduleinfo.json para bundles VST3.
//
// El formato real del JSON (VST3 SDK 3.7.4+) usa:
// - "Factory Info" → { "Vendor": "...", "URL": "..." }
// - "Classes" → [{ "Category": "...", "Sub Categories": [...] }]
//
// Nota: el JSON de VST3 SDK permite trailing commas, lo cual
// no es JSON estándar. Usamos un pre-procesamiento para limpiarlas.

use serde::Deserialize;
use std::fs;
use std::path::Path;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS — estructura real del moduleinfo.json
// ═══════════════════════════════════════════════════════════════

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct ModuleInfo {
    #[serde(rename = "Name", default)]
    pub name: String,

    #[serde(rename = "Version", default)]
    pub version: String,

    #[serde(rename = "Factory Info", default)]
    pub factory_info: Option<FactoryInfo>,

    #[serde(rename = "Classes", default)]
    pub classes: Vec<PluginClass>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct FactoryInfo {
    #[serde(rename = "Vendor", default)]
    pub vendor: String,

    #[serde(rename = "URL", default)]
    pub url: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct PluginClass {
    #[serde(rename = "Name", default)]
    pub name: String,

    #[serde(rename = "Category", default)]
    pub category: String,

    #[serde(rename = "Sub Categories", default)]
    pub sub_categories: Vec<String>,

    #[serde(rename = "Vendor", default)]
    pub vendor: String,

    #[serde(rename = "Version", default)]
    pub version: String,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 RESULTADO PARSEADO
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone)]
pub struct ParsedModuleInfo {
    pub vendor: String,
    pub version: String,
    pub category: String,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 PARSER
// ═══════════════════════════════════════════════════════════════

const MODULEINFO_PATHS: &[&str] = &[
    "Contents/Resources/moduleinfo.json",
    "Contents/x86_64-win/moduleinfo.json",
    "Contents/x86_64-linux/moduleinfo.json",
    "Contents/MacOS/moduleinfo.json",
    "Contents/moduleinfo.json",
];

/// Elimina trailing commas del JSON (VST3 SDK las incluye pero
/// no son JSON estándar).
///
/// Ej: `["a", "b",]` → `["a", "b"]`
///     `{"x": 1,}` → `{"x": 1}`
fn strip_trailing_commas(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    let mut escape_next = false;

    while let Some(ch) = chars.next() {
        if escape_next {
            result.push(ch);
            escape_next = false;
            continue;
        }

        if ch == '\\' && in_string {
            result.push(ch);
            escape_next = true;
            continue;
        }

        if ch == '"' {
            in_string = !in_string;
            result.push(ch);
            continue;
        }

        if in_string {
            result.push(ch);
            continue;
        }

        // Fuera de strings: detectar comma seguida de ] o }
        if ch == ',' {
            // Mirar adelante saltando whitespace
            let mut ahead = chars.clone();
            let mut next_non_ws = None;
            while let Some(&c) = ahead.peek() {
                if c.is_whitespace() {
                    ahead.next();
                } else {
                    next_non_ws = Some(c);
                    break;
                }
            }

            if next_non_ws == Some(']') || next_non_ws == Some('}') {
                // Trailing comma — omitirla
                continue;
            }
        }

        result.push(ch);
    }

    result
}

/// Intenta parsear moduleinfo.json desde un bundle VST3.
pub fn parse_moduleinfo(bundle_path: &Path) -> Option<ParsedModuleInfo> {
    if !bundle_path.is_dir() {
        return None;
    }

    let json_path = MODULEINFO_PATHS
        .iter()
        .map(|rel| bundle_path.join(rel))
        .find(|p| p.exists())?;

    let raw_content = fs::read_to_string(&json_path).ok()?;
    let clean_content = strip_trailing_commas(&raw_content);
    let info: ModuleInfo = serde_json::from_str(&clean_content).ok()?;

    // Category primero, antes de mover/clonar campos
    let category = extract_category(&info);

    // Vendor: Factory Info > primer Class con vendor > fallback
    let vendor = info
        .factory_info
        .as_ref()
        .map(|fi| fi.vendor.clone())
        .filter(|v| !v.is_empty())
        .or_else(|| {
            info.classes
                .iter()
                .find(|c| !c.vendor.is_empty())
                .map(|c| c.vendor.clone())
        })
        .unwrap_or_else(|| "Unknown".to_string());

    // Version: root > primer Class > fallback
    let version = if !info.version.is_empty() {
        info.version.clone()
    } else {
        info.classes
            .iter()
            .find(|c| !c.version.is_empty())
            .map(|c| c.version.clone())
            .unwrap_or_else(|| "0.0.0".to_string())
    };

    Some(ParsedModuleInfo {
        vendor,
        version,
        category,
    })
}

/// Extrae la categoría de la primera clase de audio del plugin.
fn extract_category(info: &ModuleInfo) -> String {
    let audio_class = info
        .classes
        .iter()
        .find(|c| c.category == "Audio Module Class");

    let class = audio_class.or_else(|| info.classes.first());

    if let Some(class) = class {
        if !class.sub_categories.is_empty() {
            for sub in class.sub_categories.iter().rev() {
                let normalized = normalize_category(sub);
                if normalized != "other" {
                    return normalized;
                }
            }
            if let Some(last) = class.sub_categories.last() {
                return normalize_category(last);
            }
        }
    }

    "other".to_string()
}

/// Normaliza una categoría del VST3 SDK a nuestro set estándar.
fn normalize_category(raw: &str) -> String {
    let lower = raw.to_lowercase();
    let trimmed = lower.trim();

    match trimmed {
        "dynamics" | "compressor" | "limiter" | "gate" | "expander" => "dynamics".to_string(),
        "eq" | "equalizer" => "eq".to_string(),
        "filter" => "filter".to_string(),
        "reverb" | "room" | "hall" | "plate" => "reverb".to_string(),
        "delay" | "echo" => "delay".to_string(),
        "modulation" | "chorus" | "flanger" | "phaser" | "tremolo" | "vibrato" => {
            "modulation".to_string()
        }
        "distortion" | "saturation" | "overdrive" | "fuzz" | "bitcrusher" => {
            "distortion".to_string()
        }
        "analyzer" | "meter" | "scope" | "spectrum" => "analyzer".to_string(),
        "pitch shift" | "pitch" | "harmony" | "vocal" => "pitch".to_string(),
        "instrument" | "synth" | "sampler" | "drum" => "instrument".to_string(),
        "generator" | "oscillator" | "tone" => "generator".to_string(),
        "spatial" | "surround" | "panner" | "stereo" => "spatial".to_string(),
        "fx" | "audio module class" | "tools" | "network" | "component controller class" => {
            "other".to_string()
        }
        _ => "other".to_string(),
    }
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_dynamics_variants() {
        assert_eq!(normalize_category("Dynamics"), "dynamics");
        assert_eq!(normalize_category("Compressor"), "dynamics");
        assert_eq!(normalize_category("LIMITER"), "dynamics");
    }

    #[test]
    fn normalize_eq() {
        assert_eq!(normalize_category("EQ"), "eq");
        assert_eq!(normalize_category("Equalizer"), "eq");
    }

    #[test]
    fn normalize_pitch() {
        assert_eq!(normalize_category("Pitch Shift"), "pitch");
        assert_eq!(normalize_category("Pitch"), "pitch");
    }

    #[test]
    fn normalize_unknown_to_other() {
        assert_eq!(normalize_category("SomethingWeird"), "other");
        assert_eq!(normalize_category(""), "other");
    }

    #[test]
    fn normalize_generic_sdk_categories() {
        assert_eq!(normalize_category("Fx"), "other");
        assert_eq!(normalize_category("Tools"), "other");
        assert_eq!(normalize_category("Network"), "other");
        assert_eq!(normalize_category("Audio Module Class"), "other");
    }

    #[test]
    fn strip_trailing_commas_arrays() {
        let input = r#"["a", "b",]"#;
        let output = strip_trailing_commas(input);
        assert_eq!(output, r#"["a", "b"]"#);
    }

    #[test]
    fn strip_trailing_commas_objects() {
        let input = r#"{"x": 1, "y": 2,}"#;
        let output = strip_trailing_commas(input);
        assert_eq!(output, r#"{"x": 1, "y": 2}"#);
    }

    #[test]
    fn strip_trailing_commas_nested() {
        let input = r#"{"a": [1, 2,], "b": {"c": 3,},}"#;
        let output = strip_trailing_commas(input);
        assert_eq!(output, r#"{"a": [1, 2], "b": {"c": 3}}"#);
    }

    #[test]
    fn strip_preserves_commas_in_strings() {
        let input = r#"{"a": "hello, world,", "b": 1,}"#;
        let output = strip_trailing_commas(input);
        assert_eq!(output, r#"{"a": "hello, world,", "b": 1}"#);
    }

    #[test]
    fn extract_category_auxfeed_style() {
        let info = ModuleInfo {
            name: "Auxfeed".into(),
            version: "1.0.11".into(),
            factory_info: Some(FactoryInfo {
                vendor: "Payette Forward".into(),
                url: "https://auxfeed.com".into(),
            }),
            classes: vec![
                PluginClass {
                    name: "Auxfeed".into(),
                    category: "Audio Module Class".into(),
                    sub_categories: vec![
                        "Fx".into(),
                        "Analyzer".into(),
                        "Tools".into(),
                        "Network".into(),
                    ],
                    vendor: "Payette Forward".into(),
                    version: "1.0.11".into(),
                },
                PluginClass {
                    name: "Auxfeed".into(),
                    category: "Component Controller Class".into(),
                    sub_categories: vec![
                        "Fx".into(),
                        "Analyzer".into(),
                        "Tools".into(),
                        "Network".into(),
                    ],
                    vendor: "Payette Forward".into(),
                    version: "1.0.11".into(),
                },
            ],
        };

        assert_eq!(extract_category(&info), "analyzer");
    }

    #[test]
    fn extract_category_dynamics_subcats() {
        let info = ModuleInfo {
            name: "Test Comp".into(),
            version: "1.0".into(),
            factory_info: None,
            classes: vec![PluginClass {
                name: "Test Comp".into(),
                category: "Audio Module Class".into(),
                sub_categories: vec![
                    "Fx".into(),
                    "Dynamics".into(),
                    "Compressor".into(),
                ],
                vendor: "Test".into(),
                version: "1.0".into(),
            }],
        };

        assert_eq!(extract_category(&info), "dynamics");
    }

    #[test]
    fn parse_real_auxfeed_json() {
        let json = r#"{
  "Name": "Auxfeed",
  "Version": "1.0.11",
  "Factory Info": {
    "Vendor": "Payette Forward",
    "URL": "https://auxfeed.com",
    "E-Mail": "contact@auxfeed.com",
    "Flags": {
      "Unicode": true,
      "Classes Discardable": false,
      "Component Non Discardable": false,
    },
  },
  "Classes": [
    {
      "CID": "ABCDEF019182FAEB5079467750665374",
      "Category": "Audio Module Class",
      "Name": "Auxfeed",
      "Vendor": "Payette Forward",
      "Version": "1.0.11",
      "SDKVersion": "VST 3.8.0",
      "Sub Categories": [
        "Fx",
        "Analyzer",
        "Tools",
        "Network",
      ],
      "Class Flags": 0,
      "Cardinality": 2147483647,
      "Snapshots": [
      ],
    },
  ],
}"#;

        let clean = strip_trailing_commas(json);
        let info: ModuleInfo = serde_json::from_str(&clean).expect("parse failed");

        assert_eq!(info.name, "Auxfeed");
        assert_eq!(info.version, "1.0.11");
        assert_eq!(
            info.factory_info.as_ref().unwrap().vendor,
            "Payette Forward"
        );
        assert_eq!(info.classes.len(), 1);
        assert_eq!(info.classes[0].sub_categories.len(), 4);
    }
}