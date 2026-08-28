// src-tauri/src/lib.rs

mod ffi;
mod moduleinfo;
mod metadata;
mod plugins;
mod vst3;
mod vst3_com;
mod vst3_host_context;

use vst3::Vst3Registry;

#[tauri::command]
fn sumar(a: i32, b: i32) -> i32 { ffi::sumar(a, b) }

#[tauri::command]
fn saludar(nombre: String) -> String { ffi::saludar(&nombre) }

/// Llamado desde el frontend cuando el motor de audio está listo.
/// Cierra la ventana splash y muestra la ventana principal.
#[tauri::command]
async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }

    if let Some(main) = app.get_webview_window("main") {
        main.set_skip_taskbar(false).map_err(|e| e.to_string())?;
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    }

    Ok(())
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
            show_main_window,
            plugins::scan_vst_plugins,
            vst3::vst3_probe_plugin,
            vst3::vst3_load_plugin,
            vst3::vst3_unload_plugin,
            vst3::vst3_list_loaded,
            vst3::vst3_create_instance,
            vst3::vst3_release_instance,
            vst3::vst3_list_instances,
            vst3::vst3_initialize_instance,
            vst3::vst3_terminate_instance,
            vst3::vst3_open_editor,
            vst3::vst3_update_editor_bounds,
            vst3::vst3_close_editor,
            vst3_host_context::vst3_debug_host_context,
            vst3::vst3_activate_processing,
            vst3::vst3_process_block,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}