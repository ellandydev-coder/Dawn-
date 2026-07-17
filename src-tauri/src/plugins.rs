// src-tauri/src/plugins.rs
//
// Escaneo de plugins VST del filesystem.
//
// ── ESTADO ACTUAL (Hito C — Lote 2) ──
// Aplica heurística de metadatos (vendor por carpeta + category por keywords).
// Los plugins ya no son "Unknown/other" genéricos — reciben vendor real
// y categoría según su nombre.
//
// ── COMPORTAMIENTO ──
// • Recorre las rutas dadas recursivamente
// • Cuando encuentra carpeta .vst3, la registra y NO desciende (bundle atómico)
// • Cuando encuentra archivo .vst3, lo registra
// • Filtra "WaveShell*" (case-insensitive)
// • Aplica heurística de metadatos via `metadata::detect_metadata`
// • Si no se pasan rutas, usa las por defecto del OS
//
// ── FORMATO DEL ID (Fase 1.5) ──
// El id tiene formato "vst3:<path_absoluto>"
// Ej: "vst3:C:\Program Files\Common Files\VST3\Auxfeed.vst3"
//
// Esto permite al frontend extraer el bundle path directamente
// del pluginId sin necesidad de buscar en ningún catálogo.
// El FxChainPluginUI lo usa para lanzar vst3_probe_plugin.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::metadata;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedPlugin {
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub category: String,
    pub format: String,
    pub version: String,
    pub path: String,
    pub available: bool,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 RUTAS POR DEFECTO
// ═══════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
fn default_vst3_paths() -> Vec<PathBuf> {
    vec![
        PathBuf::from("C:\\Program Files\\Common Files\\VST3"),
        PathBuf::from("C:\\Program Files\\VSTPlugins"),
        PathBuf::from("C:\\Program Files (x86)\\Common Files\\VST3"),
        PathBuf::from("C:\\Program Files (x86)\\VSTPlugins"),
    ]
}

#[cfg(target_os = "macos")]
fn default_vst3_paths() -> Vec<PathBuf> {
    let mut paths = vec![PathBuf::from("/Library/Audio/Plug-Ins/VST3")];
    if let Some(home) = std::env::var_os("HOME") {
        paths.push(PathBuf::from(home).join("Library/Audio/Plug-Ins/VST3"));
    }
    paths
}

#[cfg(target_os = "linux")]
fn default_vst3_paths() -> Vec<PathBuf> {
    let mut paths = vec![
        PathBuf::from("/usr/lib/vst3"),
        PathBuf::from("/usr/local/lib/vst3"),
    ];
    if let Some(home) = std::env::var_os("HOME") {
        paths.push(PathBuf::from(home).join(".vst3"));
    }
    paths
}

// ═══════════════════════════════════════════════════════════════
// 🎯 FILTROS
// ═══════════════════════════════════════════════════════════════

const SHELL_PREFIXES: &[&str] = &["waveshell"];

fn is_shell_plugin(path: &Path) -> bool {
    let filename = match path.file_stem().and_then(|s| s.to_str()) {
        Some(name) => name.to_lowercase(),
        None => return false,
    };

    SHELL_PREFIXES
        .iter()
        .any(|prefix| filename.starts_with(prefix))
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

fn extract_name(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string()
}

/// Crea un `ScannedPlugin` aplicando heurística de metadatos.
///
/// El `id` tiene formato `"vst3:<path_absoluto>"` para que el
/// frontend pueda extraer el bundle path directamente.
fn build_plugin_entry(path: &Path) -> ScannedPlugin {
    let name     = extract_name(path);
    let meta     = metadata::detect_metadata(path, &name);
    let path_str = path.to_string_lossy().into_owned();

    // ID = "vst3:" + path absoluto
    // El frontend hace: pluginId.slice("vst3:".length) → bundle path
    let id = format!("vst3:{}", path_str);

    ScannedPlugin {
        id,
        name,
        vendor:   meta.vendor,
        category: meta.category,
        format:   "vst3".to_string(),
        version:  meta.version,
        path:     path_str,
        available: true,
    }
}

fn is_vst3_entry(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("vst3"))
        .unwrap_or(false)
}

fn scan_single_path(root: &Path) -> Vec<ScannedPlugin> {
    if !root.exists() {
        return Vec::new();
    }

    let mut found  = Vec::new();
    let mut walker = WalkDir::new(root)
        .max_depth(6)
        .follow_links(false)
        .into_iter();

    while let Some(entry) = walker.next() {
        let entry = match entry {
            Ok(e)  => e,
            Err(_) => continue,
        };

        let path = entry.path();

        if !is_vst3_entry(path) {
            continue;
        }

        if is_shell_plugin(path) {
            log::info!("[plugins] Filtrado (shell): {}", path.display());
            if entry.file_type().is_dir() {
                walker.skip_current_dir();
            }
            continue;
        }

        found.push(build_plugin_entry(path));

        // Bundle → no descender dentro
        if entry.file_type().is_dir() {
            walker.skip_current_dir();
        }
    }

    dedupe_bundles(found)
}

/// Elimina entradas duplicadas cuando un archivo .vst3 está DENTRO
/// de un bundle .vst3 ya registrado.
fn dedupe_bundles(mut plugins: Vec<ScannedPlugin>) -> Vec<ScannedPlugin> {
    plugins.sort_by(|a, b| a.path.cmp(&b.path));

    let mut result: Vec<ScannedPlugin> = Vec::with_capacity(plugins.len());
    for plugin in plugins {
        let is_child_of_bundle = result.iter().any(|existing| {
            plugin.path.starts_with(&existing.path)
                && plugin.path.len() > existing.path.len()
                && plugin
                    .path
                    .as_bytes()
                    .get(existing.path.len())
                    .map(|&b| b == b'/' || b == b'\\')
                    .unwrap_or(false)
        });

        if !is_child_of_bundle {
            result.push(plugin);
        }
    }

    result
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO TAURI
// ═══════════════════════════════════════════════════════════════

#[tauri::command]
pub fn scan_vst_plugins(paths: Vec<String>) -> Vec<ScannedPlugin> {
    let paths_to_scan: Vec<PathBuf> = if paths.is_empty() {
        log::info!("[plugins] Sin rutas configuradas, usando defaults del OS");
        default_vst3_paths()
    } else {
        paths.iter().map(PathBuf::from).collect()
    };

    log::info!(
        "[plugins] Iniciando scan de {} ruta(s)",
        paths_to_scan.len()
    );

    let mut all_found = Vec::new();
    for root in &paths_to_scan {
        let found = scan_single_path(root);
        log::info!(
            "[plugins] {}: {} plugin(s) encontrados",
            root.display(),
            found.len()
        );
        all_found.extend(found);
    }

    log::info!("[plugins] Scan completo: {} plugins totales", all_found.len());
    all_found
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn id_format_contains_vst3_prefix_and_path() {
        // El id debe empezar con "vst3:" seguido del path
        // para que el frontend pueda extraer el bundle path.
        let path = Path::new("C:\\Program Files\\Common Files\\VST3\\Auxfeed.vst3");
        let plugin = build_plugin_entry(path);

        assert!(
            plugin.id.starts_with("vst3:"),
            "El id debe empezar con 'vst3:'. Got: {}",
            plugin.id
        );

        let extracted = &plugin.id["vst3:".len()..];
        assert_eq!(
            extracted,
            plugin.path,
            "El path extraído del id debe coincidir con plugin.path"
        );
    }

    #[test]
    fn id_format_name_matches_filestem() {
        let path = Path::new("C:\\VST3\\MyPlugin.vst3");
        let plugin = build_plugin_entry(path);
        assert_eq!(plugin.name, "MyPlugin");
        assert_eq!(plugin.format, "vst3");
    }

    #[test]
    fn shell_plugin_is_filtered() {
        let path = Path::new("C:\\VST3\\WaveShell1-VST3 14.0_x64.vst3");
        assert!(is_shell_plugin(path));
    }

    #[test]
    fn normal_plugin_is_not_filtered() {
        let path = Path::new("C:\\VST3\\Auxfeed.vst3");
        assert!(!is_shell_plugin(path));
    }

    #[test]
    fn dedupe_removes_child_inside_bundle() {
        let bundle = ScannedPlugin {
            id:        "vst3:C:\\VST3\\Foo.vst3".to_string(),
            name:      "Foo".to_string(),
            vendor:    "X".to_string(),
            category:  "other".to_string(),
            format:    "vst3".to_string(),
            version:   "1.0".to_string(),
            path:      "C:\\VST3\\Foo.vst3".to_string(),
            available: true,
        };
        let child = ScannedPlugin {
            id:        "vst3:C:\\VST3\\Foo.vst3\\Contents\\x86_64-win\\Foo.vst3".to_string(),
            name:      "Foo".to_string(),
            vendor:    "X".to_string(),
            category:  "other".to_string(),
            format:    "vst3".to_string(),
            version:   "1.0".to_string(),
            path:      "C:\\VST3\\Foo.vst3\\Contents\\x86_64-win\\Foo.vst3".to_string(),
            available: true,
        };

        let deduped = dedupe_bundles(vec![bundle, child]);
        assert_eq!(deduped.len(), 1, "El child dentro del bundle debe eliminarse");
    }
}