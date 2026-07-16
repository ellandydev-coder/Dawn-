// src-tauri/src/plugins.rs
//
// Escaneo de plugins VST del filesystem.
//
// ── ESTADO ACTUAL (Hito B — Walking Skeleton) ──
// Devuelve solo `name` (filename) + `path`. El resto de campos
// son placeholders. Para metadatos reales (vendor, category,
// version) ver Hito C — parsing VST3 SDK.
//
// ── COMPORTAMIENTO ──
// • Recorre las rutas dadas recursivamente
// • Filtra archivos y carpetas con extensión .vst3
// • Si no se pasan rutas, usa las por defecto de Windows
// • Ignora rutas inexistentes silenciosamente (no aborta el scan)

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/// Plugin descubierto por el scanner.
/// Espejo del tipo `ScannedPlugin` en TypeScript.
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
// 🎯 RUTAS POR DEFECTO (Windows)
// ═══════════════════════════════════════════════════════════════

/// Rutas típicas donde Windows guarda VST3 según el estándar.
/// Se usan cuando el usuario NO ha configurado `pluginPaths`.
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
    let mut paths = vec![
        PathBuf::from("/Library/Audio/Plug-Ins/VST3"),
    ];
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
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

/// Convierte un nombre de plugin a un slug apto para id.
/// "SSL E-Channel.vst3" → "ssl-e-channel"
fn slugify(name: &str) -> String {
    name.to_lowercase()
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

/// Extrae el nombre limpio del plugin desde su path.
/// "C:\\Plugins\\Serum.vst3" → "Serum"
fn extract_name(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string()
}

/// Crea un `ScannedPlugin` a partir de un path .vst3.
fn build_plugin_entry(path: &Path) -> ScannedPlugin {
    let name = extract_name(path);
    let slug = slugify(&name);
    let path_str = path.to_string_lossy().into_owned();

    ScannedPlugin {
        id: format!("vst3.unknown.{}", slug),
        name,
        vendor: "Unknown".to_string(),
        category: "utility".to_string(),
        format: "vst3".to_string(),
        version: "0.0.0".to_string(),
        path: path_str,
        available: true,
    }
}

/// ¿La entrada del filesystem es un plugin VST3?
/// Puede ser archivo .vst3 (single-file) o carpeta .vst3 (bundle).
fn is_vst3_entry(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("vst3"))
        .unwrap_or(false)
}

/// Escanea una sola ruta y devuelve los VST3 encontrados.
/// Si la ruta no existe, devuelve array vacío (no es error).
fn scan_single_path(root: &Path) -> Vec<ScannedPlugin> {
    if !root.exists() {
        return Vec::new();
    }

    let mut found = Vec::new();

    // Recorrido recursivo con límite de profundidad razonable
    // para evitar loops infinitos en filesystems raros
    for entry in WalkDir::new(root)
        .max_depth(6)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
    {
        let path = entry.path();
        if is_vst3_entry(path) {
            found.push(build_plugin_entry(path));

            // Si es una carpeta .vst3 (bundle), no descendemos más
            // dentro de ella — el bundle es una unidad atómica
            if path.is_dir() {
                // WalkDir no permite skip_current_dir aquí en este scope,
                // así que confiamos en max_depth para acotar
            }
        }
    }

    found
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO TAURI
// ═══════════════════════════════════════════════════════════════

/// Escanea rutas del filesystem buscando plugins VST3.
///
/// # Argumentos
/// - `paths`: Lista de rutas absolutas a escanear. Si está vacía,
///   se usan las rutas por defecto del sistema operativo.
///
/// # Retorna
/// Lista de plugins encontrados. Ids duplicados son posibles si
/// hay dos archivos con el mismo filename en carpetas distintas —
/// la deduplicación se hace en TypeScript.
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