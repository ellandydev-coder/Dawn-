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

/// Convierte un texto a un slug apto para id.
fn slugify(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c
            } else if c == '.' || c == ' ' || c == '_' {
                '-'
            } else {
                c
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn extract_name(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string()
}

/// Crea un `ScannedPlugin` aplicando heurística de metadatos.
fn build_plugin_entry(path: &Path) -> ScannedPlugin {
    let name = extract_name(path);
    let meta = metadata::detect_metadata(path, &name);

    let path_str = path.to_string_lossy().into_owned();

    let vendor_slug = slugify(&meta.vendor);
    let name_slug = slugify(&name);
    let id = format!("vst3.{}.{}", vendor_slug, name_slug);

    ScannedPlugin {
        id,
        name,
        vendor: meta.vendor,
        category: meta.category,
        format: "vst3".to_string(),
        version: meta.version,  // ← CAMBIO: era "0.0.0", ahora usa meta.version
        path: path_str,
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

    let mut found = Vec::new();
    let mut walker = WalkDir::new(root)
        .max_depth(6)
        .follow_links(false)
        .into_iter();

    while let Some(entry) = walker.next() {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();

        if !is_vst3_entry(path) {
            continue;
        }

        if is_shell_plugin(path) {
            log::info!("[plugins] Filtrado (shell): {}", path.display());

            // Si es bundle/carpeta shell, no descender dentro
            if entry.file_type().is_dir() {
                walker.skip_current_dir();
            }

            continue;
        }

        found.push(build_plugin_entry(path));

        // Si encontramos una carpeta .vst3 (bundle), la registramos
        // y NO descendemos dentro.
        if entry.file_type().is_dir() {
            walker.skip_current_dir();
        }
    }

    // Lo dejamos como red de seguridad extra.
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