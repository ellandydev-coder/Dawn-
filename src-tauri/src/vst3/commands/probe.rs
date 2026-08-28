// src-tauri/src/vst3/commands/probe.rs

use std::path::Path;
use super::super::types::ProbeResult;
use super::super::dll::{resolve_dll_path, DLL_SEARCH_PATHS};

#[cfg(target_os = "windows")]
use super::super::dll::{load_factory, free_hmodule};

#[tauri::command]
pub fn vst3_probe_plugin(bundle_path: String) -> ProbeResult {
    let bundle = Path::new(&bundle_path);

    if !bundle.exists() {
        return ProbeResult {
            success: false,
            message: format!("Bundle no existe: {}", bundle_path),
            bundle_path, dll_path: None, dll_handle: None,
            factory_ptr: None, classes: vec![],
        };
    }

    let dll_path = match resolve_dll_path(bundle) {
        Some(p) => p,
        None => return ProbeResult {
            success: false,
            message: format!("No se encontró .vst3. Buscado en: {:?}", DLL_SEARCH_PATHS),
            bundle_path, dll_path: None, dll_handle: None,
            factory_ptr: None, classes: vec![],
        },
    };

    let dll_path_str = dll_path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        match load_factory(&dll_path) {
            Ok(loaded) => {
                let res = ProbeResult {
                    success: true,
                    message: format!("OK — {} clase(s) encontrada(s)", loaded.classes.len()),
                    bundle_path,
                    dll_path: Some(dll_path_str),
                    dll_handle: Some(format!("0x{:016x}", loaded.hmodule)),
                    factory_ptr: Some(format!("0x{:016x}", loaded.factory_ptr)),
                    classes: loaded.classes,
                };
                free_hmodule(loaded.hmodule);
                res
            }
            Err(e) => ProbeResult {
                success: false, message: format!("Error: {}", e),
                bundle_path, dll_path: Some(dll_path_str),
                dll_handle: None, factory_ptr: None, classes: vec![],
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        ProbeResult {
            success: false, message: "Probe solo implementado en Windows".into(),
            bundle_path, dll_path: Some(dll_path_str), dll_handle: None, factory_ptr: None, classes: vec![],
        }
    }
}