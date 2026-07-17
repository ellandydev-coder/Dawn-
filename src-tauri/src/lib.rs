mod ffi;
mod moduleinfo;
mod metadata;
mod plugins;
mod vst3_com;
mod vst3_host;
mod vst3_host_context;   // ← NUEVO
mod vst3_registry;

use vst3_registry::Vst3Registry;

#[tauri::command]
fn sumar(a: i32, b: i32) -> i32 {
    ffi::sumar(a, b)
}

#[tauri::command]
fn saludar(nombre: String) -> String {
    ffi::saludar(&nombre)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Vst3Registry::new())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sumar,
            saludar,
            plugins::scan_vst_plugins,
            vst3_host::vst3_probe_plugin,
            vst3_host::vst3_load_plugin,
            vst3_host::vst3_unload_plugin,
            vst3_host::vst3_list_loaded,
            vst3_host::vst3_create_instance,
            vst3_host::vst3_release_instance,
            vst3_host::vst3_list_instances,
            // ─── DEBUG Fase 2.4 (temporal) ────────────────────
            vst3_host_context::vst3_debug_host_context,   // ← NUEVO
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}