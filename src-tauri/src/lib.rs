mod ffi;
mod moduleinfo;
mod metadata;
mod plugins;
mod vst3_com;
mod vst3_editor;
mod vst3_host;
mod vst3_host_context;
mod vst3_registry;

use vst3_registry::Vst3Registry;

#[tauri::command]
fn sumar(a: i32, b: i32) -> i32 { ffi::sumar(a, b) }

#[tauri::command]
fn saludar(nombre: String) -> String { ffi::saludar(&nombre) }

/// Llamado desde el frontend cuando el motor de audio está listo.
/// Cierra la ventana splash y muestra la ventana principal.
#[tauri::command]
async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    // Cerrar splash
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }

    // Mostrar main + ponerla en la barra de tareas
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
            vst3_host::vst3_probe_plugin,
            vst3_host::vst3_load_plugin,
            vst3_host::vst3_unload_plugin,
            vst3_host::vst3_list_loaded,
            vst3_host::vst3_create_instance,
            vst3_host::vst3_release_instance,
            vst3_host::vst3_list_instances,
            vst3_host::vst3_initialize_instance,
            vst3_host::vst3_terminate_instance,
            vst3_editor::vst3_open_editor,
            vst3_editor::vst3_close_editor,
            vst3_host_context::vst3_debug_host_context,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}