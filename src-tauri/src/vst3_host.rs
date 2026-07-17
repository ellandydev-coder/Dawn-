// src-tauri/src/vst3_host.rs
//
// VST3 Host Bridge — Fase 1
//
// Cargar plugins VST3 dinámicamente vía Windows API.
// Por ahora solo prueba que podemos cargar el DLL y obtener
// un handle válido. Sin instanciar el plugin todavía.
//
// ── ESTADO ACTUAL (Fase 1.3) ──
// ✅ Resolver DLL real dentro del bundle .vst3
// ✅ LoadLibraryW del DLL
// ⬜ GetProcAddress("GetPluginFactory")     [Fase 1.4]
// ⬜ Llamar al factory y listar clases       [Fase 1.5]
//
// ── COMPORTAMIENTO ──
// El bundle VST3 en Windows es una carpeta .vst3/ que contiene:
//   Contents/x86_64-win/<PluginName>.vst3
// Ese archivo interno ES el DLL real.

use std::path::{Path, PathBuf};

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/// Resultado de intentar cargar un plugin VST3.
/// Se serializa al frontend para debug.
#[derive(Debug, serde::Serialize)]
pub struct ProbeResult {
    pub success: bool,
    pub message: String,
    pub bundle_path: String,
    pub dll_path: Option<String>,
    pub dll_handle: Option<String>, // formato hex "0x7ff8a2b40000"
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS — resolver el DLL real dentro del bundle
// ═══════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
const DLL_SEARCH_PATHS: &[&str] = &["Contents/x86_64-win", "Contents/x86-win"];

#[cfg(target_os = "macos")]
const DLL_SEARCH_PATHS: &[&str] = &["Contents/MacOS"];

#[cfg(target_os = "linux")]
const DLL_SEARCH_PATHS: &[&str] = &["Contents/x86_64-linux"];

/// Dado el path al bundle `.vst3`, encuentra el binario real dentro.
fn resolve_dll_path(bundle: &Path) -> Option<PathBuf> {
    // Caso 1: bundle es un archivo directamente
    if bundle.is_file() {
        return Some(bundle.to_path_buf());
    }

    // Caso 2: bundle es una carpeta — buscar dentro
    for sub in DLL_SEARCH_PATHS {
        let dir = bundle.join(sub);
        if !dir.is_dir() {
            continue;
        }

        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path
                        .extension()
                        .and_then(|s| s.to_str())
                        .map(|ext| ext.eq_ignore_ascii_case("vst3"))
                        .unwrap_or(false)
                {
                    return Some(path);
                }
            }
        }
    }

    None
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CARGAR EL DLL (Windows)
// ═══════════════════════════════════════════════════════════════

/// Carga el DLL en memoria y devuelve el handle como puntero.
///
/// Devuelve `Ok(handle)` con el HMODULE convertido a usize,
/// o `Err(mensaje)` con el error de Windows.
///
/// ⚠️  Este handle se DEBE liberar con FreeLibrary cuando ya
/// no lo necesitemos. Por ahora lo cargamos y liberamos en el
/// mismo probe — para la Fase 2 tendremos que mantenerlo vivo.
#[cfg(target_os = "windows")]
fn load_dll(dll_path: &Path) -> Result<usize, String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::FreeLibrary;
    use windows::Win32::System::LibraryLoader::LoadLibraryW;

    // Convertir el path a UTF-16 null-terminated (formato WinAPI)
    let wide: Vec<u16> = dll_path
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    // Cargar el DLL
    let hmodule = unsafe { LoadLibraryW(PCWSTR(wide.as_ptr())) };

    match hmodule {
        Ok(handle) if !handle.is_invalid() => {
            let ptr = handle.0 as usize;

            // Por ahora liberamos inmediatamente — solo queríamos probar
            // que se puede cargar. En Fase 2 mantendremos el handle vivo.
            unsafe {
                let _ = FreeLibrary(handle);
            }

            Ok(ptr)
        }
        Ok(_) => Err("LoadLibraryW devolvió handle inválido".to_string()),
        Err(e) => Err(format!("LoadLibraryW falló: {}", e)),
    }
}

/// Stub para plataformas no-Windows.
#[cfg(not(target_os = "windows"))]
fn load_dll(_dll_path: &Path) -> Result<usize, String> {
    Err("Load DLL solo implementado en Windows por ahora".to_string())
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO TAURI — probe_plugin
// ═══════════════════════════════════════════════════════════════

/// Prueba a cargar un plugin VST3 y devuelve info de debug.
#[tauri::command]
pub fn vst3_probe_plugin(bundle_path: String) -> ProbeResult {
    log::info!("[vst3_host] Probe iniciado: {}", bundle_path);

    let bundle = Path::new(&bundle_path);

    // ─── Validar que el bundle existe ────────────────────────
    if !bundle.exists() {
        return ProbeResult {
            success: false,
            message: format!("Bundle no existe: {}", bundle_path),
            bundle_path,
            dll_path: None,
            dll_handle: None,
        };
    }

    // ─── Resolver el DLL real dentro del bundle ──────────────
    let dll_path = match resolve_dll_path(bundle) {
        Some(p) => p,
        None => {
            return ProbeResult {
                success: false,
                message: format!(
                    "No se encontró el binario .vst3 dentro del bundle. \
                     Buscado en: {:?}",
                    DLL_SEARCH_PATHS
                ),
                bundle_path,
                dll_path: None,
                dll_handle: None,
            };
        }
    };

    let dll_path_str = dll_path.to_string_lossy().to_string();
    log::info!("[vst3_host] DLL resuelto: {}", dll_path_str);

    // ─── Cargar el DLL ────────────────────────────────────────
    match load_dll(&dll_path) {
        Ok(handle_ptr) => {
            let handle_hex = format!("0x{:016x}", handle_ptr);
            log::info!(
                "[vst3_host] ✅ DLL cargado: {} → {}",
                dll_path.file_name().unwrap_or_default().to_string_lossy(),
                handle_hex
            );

            ProbeResult {
                success: true,
                message: format!("DLL cargado correctamente (Fase 1.3 OK)"),
                bundle_path,
                dll_path: Some(dll_path_str),
                dll_handle: Some(handle_hex),
            }
        }
        Err(e) => {
            log::error!("[vst3_host] ❌ Load falló: {}", e);
            ProbeResult {
                success: false,
                message: format!("Error cargando DLL: {}", e),
                bundle_path,
                dll_path: Some(dll_path_str),
                dll_handle: None,
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_dll_returns_none_for_missing_bundle() {
        let path = PathBuf::from("C:\\ruta\\que\\no\\existe.vst3");
        let result = resolve_dll_path(&path);
        assert!(result.is_none());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn can_load_kernel32() {
        // Test sanity: cargar un DLL del sistema que sabemos existe.
        // Si esto falla, tenemos un problema serio con el crate windows.
        let path = PathBuf::from("C:\\Windows\\System32\\kernel32.dll");
        assert!(path.exists(), "kernel32.dll debe existir en Windows");

        let result = load_dll(&path);
        assert!(
            result.is_ok(),
            "Debería poder cargar kernel32.dll. Error: {:?}",
            result
        );

        let handle = result.unwrap();
        assert!(handle > 0, "El handle debe ser un puntero válido");
    }
}