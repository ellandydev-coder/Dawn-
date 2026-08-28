// src-tauri/src/vst3/commands/load.rs

use std::path::{Path, PathBuf};
use tauri::State;
use super::super::types::LoadResult;
use super::super::registry::{make_plugin_key, LoadedPlugin, Vst3Registry};
use super::super::dll::{resolve_dll_path, DLL_SEARCH_PATHS};

#[cfg(target_os = "windows")]
use super::super::dll::{load_factory, iterate_factory_classes};

#[tauri::command]
pub fn vst3_load_plugin(
    bundle_path: String,
    registry: State<'_, Vst3Registry>,
) -> LoadResult {
    let bundle = Path::new(&bundle_path);

    if !bundle.exists() {
        return LoadResult {
            success: false, message: format!("Bundle no existe: {}", bundle_path),
            bundle_path, dll_path: None, plugin_key: None, factory_ptr: None, classes: vec![],
        };
    }

    let dll_path = match resolve_dll_path(bundle) {
        Some(p) => p,
        None => return LoadResult {
            success: false,
            message: format!("No se encontró .vst3. Buscado en: {:?}", DLL_SEARCH_PATHS),
            bundle_path, dll_path: None, plugin_key: None, factory_ptr: None, classes: vec![],
        },
    };

    let dll_path_str = dll_path.to_string_lossy().to_string();
    let plugin_key = make_plugin_key(&bundle_path);

    #[cfg(target_os = "windows")]
    {
        if let Some((factory_ptr, classes)) = registry.with_plugin(&plugin_key, |p| {
            let ptr = p.factory_ptr;
            let cls = if ptr != 0 {
                unsafe { iterate_factory_classes(ptr as *mut _) }
            } else {
                Vec::new()
            };
            (ptr, cls)
        }) {
            return LoadResult {
                success: true,
                message: format!("Plugin ya cargado — {} clase(s)", classes.len()),
                bundle_path,
                dll_path: Some(dll_path_str),
                plugin_key: Some(plugin_key),
                factory_ptr: if factory_ptr != 0 { Some(format!("0x{:016x}", factory_ptr)) } else { None },
                classes,
            };
        }

        match load_factory(&dll_path) {
            Ok(loaded) => {
                let factory_hex = format!("0x{:016x}", loaded.factory_ptr);
                let classes = loaded.classes.clone();

                let plugin = LoadedPlugin::new(
                    PathBuf::from(&bundle_path),
                    dll_path.clone(),
                    loaded.hmodule,
                    loaded.factory_ptr,
                );

                registry.insert(plugin_key.clone(), plugin);

                LoadResult {
                    success: true,
                    message: format!("Plugin cargado — {} clase(s)", classes.len()),
                    bundle_path,
                    dll_path: Some(dll_path_str),
                    plugin_key: Some(plugin_key),
                    factory_ptr: Some(factory_hex),
                    classes,
                }
            }
            Err(e) => LoadResult {
                success: false, message: format!("Error: {}", e),
                bundle_path, dll_path: Some(dll_path_str), plugin_key: None, factory_ptr: None, classes: vec![],
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = registry;
        LoadResult {
            success: false, message: "Load solo implementado en Windows".into(),
            bundle_path, dll_path: Some(dll_path_str), plugin_key: None, factory_ptr: None, classes: vec![],
        }
    }
}

#[tauri::command]
pub fn vst3_unload_plugin(
    plugin_key: String,
    registry: State<'_, Vst3Registry>,
) -> bool {
    #[cfg(target_os = "windows")]
    {
        match registry.take(&plugin_key) {
            Some(plugin) => {
                drop(plugin);
                true
            }
            None => false,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, registry);
        false
    }
}

#[tauri::command]
pub fn vst3_list_loaded(registry: State<'_, Vst3Registry>) -> Vec<String> {
    registry.list_keys()
}