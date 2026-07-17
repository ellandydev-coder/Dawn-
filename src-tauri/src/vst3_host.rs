// src-tauri/src/vst3_host.rs
//
// VST3 Host Bridge
//
// ── ESTADO ACTUAL (Fase 1.4) ──
// ✅ Resolver DLL real dentro del bundle .vst3
// ✅ LoadLibraryW del DLL
// ✅ GetProcAddress("GetPluginFactory")
// ✅ Llamar al factory y obtener puntero
// ⬜ Interpretar el IPluginFactory (vtable, iterar classes)  [Fase 1.5]
//
// ── SOBRE VST3 ──
// Todo plugin VST3 exporta la función C:
//   IPluginFactory* GetPluginFactory();
//
// Es la puerta de entrada al plugin. Devuelve un puntero a un objeto COM
// que implementa IPluginFactory. Con ese objeto podemos:
//   - Preguntar cuántas clases tiene el plugin
//   - Obtener info de cada clase (nombre, categoría, CID)
//   - Instanciar cualquiera de esas clases (Fase 2)

use std::path::{Path, PathBuf};

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, serde::Serialize)]
pub struct ProbeResult {
    pub success: bool,
    pub message: String,
    pub bundle_path: String,
    pub dll_path: Option<String>,
    pub dll_handle: Option<String>,
    /// Puntero al IPluginFactory devuelto por GetPluginFactory()
    pub factory_ptr: Option<String>,
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

fn resolve_dll_path(bundle: &Path) -> Option<PathBuf> {
    if bundle.is_file() {
        return Some(bundle.to_path_buf());
    }

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
// 🎯 CARGAR EL DLL + LLAMAR GetPluginFactory (Windows)
// ═══════════════════════════════════════════════════════════════

/// Firma de la función `GetPluginFactory` exportada por todo VST3.
///
/// En C:
///     typedef IPluginFactory* (*GetFactoryProc)();
///
/// En Rust:
///     extern "C" fn() -> *mut c_void
///
/// Devuelve puntero a IPluginFactory (o null si algo va mal).
type GetPluginFactoryFn = unsafe extern "C" fn() -> *mut core::ffi::c_void;

/// Resultado interno del probe.
#[derive(Debug)]
struct ProbeInfo {
    dll_handle: usize,
    factory_ptr: usize,
}

/// Carga el DLL, obtiene GetPluginFactory, la llama, y devuelve
/// tanto el handle del DLL como el puntero al factory.
///
/// ⚠️ Libera el DLL al final. Para persistir el plugin en memoria
/// será necesario mantener el HMODULE vivo (Fase 2).
#[cfg(target_os = "windows")]
fn probe_vst3(dll_path: &Path) -> Result<ProbeInfo, String> {
    use windows::core::{PCSTR, PCWSTR};
    use windows::Win32::Foundation::FreeLibrary;
    use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};

    // ─── 1. Cargar el DLL ─────────────────────────────────────
    let wide: Vec<u16> = dll_path
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    let hmodule = unsafe { LoadLibraryW(PCWSTR(wide.as_ptr())) }
        .map_err(|e| format!("LoadLibraryW falló: {}", e))?;

    if hmodule.is_invalid() {
        return Err("LoadLibraryW devolvió handle inválido".to_string());
    }

    let handle_ptr = hmodule.0 as usize;

    // ─── 2. Buscar el símbolo "GetPluginFactory" ──────────────
    // GetProcAddress usa strings ANSI (null-terminated ASCII)
    let symbol_name = b"GetPluginFactory\0";
    let proc_addr = unsafe { GetProcAddress(hmodule, PCSTR(symbol_name.as_ptr())) };

    let proc_addr = match proc_addr {
        Some(addr) => addr,
        None => {
            unsafe {
                let _ = FreeLibrary(hmodule);
            }
            return Err(
                "Símbolo 'GetPluginFactory' no encontrado en el DLL. \
                 ¿Es un VST3 válido?"
                    .to_string(),
            );
        }
    };

    // ─── 3. Convertir el puntero en una función y llamarla ────
    //
    // `proc_addr` es un puntero a función crudo. Lo transmutamos
    // al tipo de función esperado y lo invocamos.
    //
    // SAFETY: confiamos en que el DLL es un VST3 real y que
    // GetPluginFactory tiene la firma esperada. Si no lo es,
    // esto puede crashear.
    let get_factory: GetPluginFactoryFn = unsafe { std::mem::transmute(proc_addr) };

    let factory_ptr = unsafe { get_factory() };

    if factory_ptr.is_null() {
        unsafe {
            let _ = FreeLibrary(hmodule);
        }
        return Err(
            "GetPluginFactory() devolvió NULL. El plugin falló al inicializar su factory."
                .to_string(),
        );
    }

    let factory_addr = factory_ptr as usize;

    // ─── 4. Liberar el DLL (por ahora) ────────────────────────
    //
    // ⚠️ IMPORTANTE: al liberar el DLL, el factory_ptr queda
    // "colgando" (dangling). Solo lo guardamos como número para
    // debug. NO lo uses después de FreeLibrary.
    //
    // En Fase 2 NO liberaremos el DLL — lo mantendremos vivo
    // en un HashMap para poder usar el factory después.
    unsafe {
        let _ = FreeLibrary(hmodule);
    }

    Ok(ProbeInfo {
        dll_handle: handle_ptr,
        factory_ptr: factory_addr,
    })
}

#[cfg(not(target_os = "windows"))]
fn probe_vst3(_dll_path: &Path) -> Result<ProbeInfo, String> {
    Err("Probe VST3 solo implementado en Windows por ahora".to_string())
}

// Stub para poder tener el tipo en no-windows (los tests siguen compilando)
#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
#[derive(Debug)]
struct ProbeInfo {
    dll_handle: usize,
    factory_ptr: usize,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO TAURI — vst3_probe_plugin
// ═══════════════════════════════════════════════════════════════

/// Prueba a cargar un plugin VST3 y obtener su plugin factory.
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
            factory_ptr: None,
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
                factory_ptr: None,
            };
        }
    };

    let dll_path_str = dll_path.to_string_lossy().to_string();
    log::info!("[vst3_host] DLL resuelto: {}", dll_path_str);

    // ─── Cargar + obtener factory ────────────────────────────
    match probe_vst3(&dll_path) {
        Ok(info) => {
            let handle_hex = format!("0x{:016x}", info.dll_handle);
            let factory_hex = format!("0x{:016x}", info.factory_ptr);

            log::info!(
                "[vst3_host] ✅ {} → DLL={}, Factory={}",
                dll_path.file_name().unwrap_or_default().to_string_lossy(),
                handle_hex,
                factory_hex
            );

            ProbeResult {
                success: true,
                message: "DLL + Factory obtenidos (Fase 1.4 OK)".to_string(),
                bundle_path,
                dll_path: Some(dll_path_str),
                dll_handle: Some(handle_hex),
                factory_ptr: Some(factory_hex),
            }
        }
        Err(e) => {
            log::error!("[vst3_host] ❌ Probe falló: {}", e);
            ProbeResult {
                success: false,
                message: format!("Error: {}", e),
                bundle_path,
                dll_path: Some(dll_path_str),
                dll_handle: None,
                factory_ptr: None,
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
    fn probe_fails_on_kernel32_not_a_vst3() {
        // kernel32.dll no exporta "GetPluginFactory" — debe fallar
        // pero SIN crashear. Este test verifica el error handling.
        let path = PathBuf::from("C:\\Windows\\System32\\kernel32.dll");
        assert!(path.exists());

        let result = probe_vst3(&path);
        assert!(result.is_err(), "kernel32 no es VST3, debe fallar");

        let err = result.unwrap_err();
        assert!(
            err.contains("GetPluginFactory"),
            "El error debe mencionar GetPluginFactory. Got: {}",
            err
        );
    }
}