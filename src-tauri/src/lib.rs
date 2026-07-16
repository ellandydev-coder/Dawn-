mod ffi;
mod plugins;

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
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sumar,
            saludar,
            plugins::scan_vst_plugins
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}