// src-tauri/src/vst3/commands/editor.rs

use tauri::{AppHandle, Manager, State};
use super::super::types::OpenEditorResult;
use super::super::registry::{EditorInstance, Vst3Registry};
use super::super::editor::{create_popup_plugin_window, create_controller_from_factory, update_editor_position, destroy_window, show_window};

#[tauri::command]
pub fn vst3_open_editor(
    app:         AppHandle,
    plugin_key:  String,
    instance_id: String,
    x:           Option<i32>,
    y:           Option<i32>,
    width:       Option<i32>,
    height:      Option<i32>,
    _registry:   State<'_, Vst3Registry>,
) -> OpenEditorResult {
    let pos_x = x.unwrap_or(0);
    let pos_y = y.unwrap_or(0);
    let pos_w = width.unwrap_or(800);
    let pos_h = height.unwrap_or(600);

    #[cfg(target_os = "windows")]
    {
        use std::sync::mpsc::channel;
        use crate::vst3_com::{funknown, iedit_controller, iplug_view};
        use crate::vst3_com::iedit_controller::IID_IEDIT_CONTROLLER;
        use crate::vst3_host_context::{DawnHost, DawnComponentHandler, DawnPlugFrame};

        let main_window = match app.get_webview_window("main") {
            Some(w) => w,
            None => return OpenEditorResult {
                success: false, message: "Ventana principal 'main' no encontrada".into(),
                hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
            }
        };

        let parent_hwnd = match main_window.hwnd() {
            Ok(h) => h.0 as usize,
            Err(e) => return OpenEditorResult {
                success: false, message: format!("HWND main error: {}", e),
                hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
            }
        };

        let app_handle = app.clone();
        let plugin_key_clone = plugin_key.clone();
        let instance_id_clone = instance_id.clone();

        let (tx, rx) = channel::<OpenEditorResult>();

        let dispatch_result = app.run_on_main_thread(move || {
            let registry = app_handle.state::<Vst3Registry>();
            let mut final_w = pos_w;
            let mut final_h = pos_h;

            let (component_ptr, factory_ptr) = match registry.with_plugin(&plugin_key_clone, |p| {
                p.instances.get(&instance_id_clone).map(|inst| {
                    (inst.component_ptr, inst.initialized, inst.editor.is_some(), p.factory_ptr)
                })
            }).flatten() {
                Some((ptr, initialized, has_editor, factory)) => {
                    if !initialized {
                        let _ = tx.send(OpenEditorResult {
                            success: false, message: "Instancia no inicializada".into(),
                            hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
                        });
                        return;
                    }
                    if has_editor {
                        unsafe {
                            update_editor_position(
                                parent_hwnd, registry.inner(),
                                &plugin_key_clone, &instance_id_clone,
                                pos_x, pos_y, final_w, final_h,
                            );
                        }
                        let _ = tx.send(OpenEditorResult {
                            success: true, message: "Editor ya abierto, reposicionado".into(),
                            hwnd: None, width: final_w, height: final_h,
                            controller_ptr: None, view_ptr: None,
                        });
                        return;
                    }
                    if ptr == 0 {
                        let _ = tx.send(OpenEditorResult {
                            success: false, message: "component_ptr es NULL".into(),
                            hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
                        });
                        return;
                    }
                    (ptr, factory)
                }
                None => {
                    let _ = tx.send(OpenEditorResult {
                        success: false,
                        message: format!("Instancia no encontrada: {}", instance_id_clone),
                        hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
                    });
                    return;
                }
            };

            let host_ptr = DawnHost::get_singleton_ptr();

            // 1. Obtener IEditController
            let controller_ptr = unsafe {
                match funknown::query_interface(component_ptr as *mut _, &IID_IEDIT_CONTROLLER) {
                    Ok(ptr) => ptr,
                    Err(_) => match create_controller_from_factory(factory_ptr, host_ptr) {
                        Ok(ptr) => ptr,
                        Err(e) => {
                            let _ = tx.send(OpenEditorResult {
                                success: false, message: format!("IEditController error: {}", e),
                                hwnd: None, width: 0, height: 0,
                                controller_ptr: None, view_ptr: None,
                            });
                            return;
                        }
                    }
                }
            };

            // 2. Asignar Component Handler OBLIGATORIO para plugins VST3
            let handler_ptr = DawnComponentHandler::get_singleton_ptr();
            unsafe {
                let _ = iedit_controller::set_component_handler(controller_ptr, handler_ptr);
            }

            // 3. Conectar peers ÚNICAMENTE si son objetos separados (Split Component)
            if (component_ptr as *mut core::ffi::c_void) != controller_ptr {
                unsafe {
                    use crate::vst3_com::iconnection_point;
                    let _ = iconnection_point::connect_peers(component_ptr as *mut _, controller_ptr);
                }
            }

            // 4. Crear IPlugView
            let view_ptr = unsafe {
                match iedit_controller::create_view(controller_ptr) {
                    Ok(ptr) => ptr,
                    Err(hr) => {
                        funknown::release(controller_ptr);
                        let _ = tx.send(OpenEditorResult {
                            success: false,
                            message: format!("createView error: 0x{:08X}", hr as u32),
                            hwnd: None, width: 0, height: 0,
                            controller_ptr: None, view_ptr: None,
                        });
                        return;
                    }
                }
            };

            // 5. Asignar IPlugFrame a la vista
            let frame_ptr = DawnPlugFrame::get_singleton_ptr();
            unsafe {
                let _ = iplug_view::set_frame(view_ptr, frame_ptr);
            }

            // 6. Consultar dimensiones preferidas por el plugin
            unsafe {
                let mut requested_rect = crate::vst3_com::iplug_view::ViewRect::new(0, 0);
                if iplug_view::get_size(view_ptr, &mut requested_rect) == 0 {
                    let req_w = requested_rect.right - requested_rect.left;
                    let req_h = requested_rect.bottom - requested_rect.top;
                    if req_w > 0 && req_h > 0 {
                        final_w = req_w;
                        final_h = req_h;
                    }
                }
            }

            // 7. Crear ventana contenedora Win32 en el Main Thread
            let child_hwnd = match create_popup_plugin_window(parent_hwnd, pos_x, pos_y, final_w, final_h) {
                Ok(h) => h,
                Err(e) => {
                    unsafe {
                        funknown::release(view_ptr);
                        funknown::release(controller_ptr);
                    }
                    let _ = tx.send(OpenEditorResult {
                        success: false, message: format!("HWND error: {}", e),
                        hwnd: None, width: 0, height: 0,
                        controller_ptr: None, view_ptr: None,
                    });
                    return;
                }
            };

            // 8. Adjuntar vista del plugin al HWND nativo
            let hr_attach = unsafe { iplug_view::attached(view_ptr, child_hwnd as *mut _) };
            if hr_attach != 0 {
                unsafe {
                    funknown::release(view_ptr);
                    funknown::release(controller_ptr);
                    destroy_window(child_hwnd);
                }
                let _ = tx.send(OpenEditorResult {
                    success: false,
                    message: format!("attached error: 0x{:08X}", hr_attach as u32),
                    hwnd: None, width: 0, height: 0,
                    controller_ptr: None, view_ptr: None,
                });
                return;
            }

            // 9. Notificar tamaño y mostrar ventana
            unsafe {
                let mut rect = crate::vst3_com::iplug_view::ViewRect::new(final_w, final_h);
                let _ = iplug_view::on_size(view_ptr, &mut rect);
                show_window(child_hwnd);
            }

            let editor = EditorInstance {
                controller_ptr: controller_ptr as usize,
                view_ptr:       view_ptr as usize,
                hwnd:           child_hwnd,
                width:          final_w,
                height:         final_h,
            };

            registry.with_plugin_mut(&plugin_key_clone, |p| {
                if let Some(inst) = p.instances.get_mut(&instance_id_clone) {
                    inst.editor = Some(editor);
                }
            });

            let _ = tx.send(OpenEditorResult {
                success:        true,
                message:        format!("Editor abierto (0x{:016x})", child_hwnd),
                hwnd:           Some(format!("0x{:016x}", child_hwnd)),
                width:          final_w,
                height:         final_h,
                controller_ptr: Some(format!("0x{:016x}", controller_ptr as usize)),
                view_ptr:       Some(format!("0x{:016x}", view_ptr as usize)),
            });
        });

        if let Err(e) = dispatch_result {
            return OpenEditorResult {
                success: false,
                message: format!("No se pudo despachar al main thread: {}", e),
                hwnd: None, width: 0, height: 0,
                controller_ptr: None, view_ptr: None,
            };
        }

        match rx.recv() {
            Ok(result) => result,
            Err(_) => OpenEditorResult {
                success: false,
                message: "Canal de comunicación con main thread cerrado".into(),
                hwnd: None, width: 0, height: 0,
                controller_ptr: None, view_ptr: None,
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, plugin_key, instance_id, x, y, width, height, _registry);
        OpenEditorResult {
            success: false, message: "Plataforma no soportada".into(),
            hwnd: None, width: 0, height: 0, controller_ptr: None, view_ptr: None,
        }
    }
}

#[tauri::command]
pub fn vst3_update_editor_bounds(
    app:         AppHandle,
    plugin_key:  String,
    instance_id: String,
    x:           i32,
    y:           i32,
    width:       i32,
    height:      i32,
    registry:    State<'_, Vst3Registry>,
) -> bool {
    #[cfg(target_os = "windows")]
    {
        let parent_hwnd = match app.get_webview_window("main") {
            Some(w) => w.hwnd().map(|h| h.0 as usize).unwrap_or(0),
            None => 0,
        };
        if parent_hwnd == 0 { return false; }
        unsafe { update_editor_position(parent_hwnd, &registry, &plugin_key, &instance_id, x, y, width, height) }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, plugin_key, instance_id, x, y, width, height, registry);
        false
    }
}

#[tauri::command]
pub fn vst3_close_editor(
    app:         AppHandle,
    plugin_key:  String,
    instance_id: String,
    registry:    State<'_, Vst3Registry>,
) -> bool {
    #[cfg(target_os = "windows")]
    {
        let editor = registry.with_plugin_mut(&plugin_key, |p| {
            p.instances.get_mut(&instance_id)?.editor.take()
        }).flatten();

        match editor {
            Some(mut ed) => {
                let (tx, rx) = std::sync::mpsc::channel::<()>();
                let dispatch = app.run_on_main_thread(move || {
                    unsafe { ed.teardown(); }
                    let _ = tx.send(());
                });
                if dispatch.is_ok() {
                    let _ = rx.recv();
                } else {
                    unsafe { ed.teardown(); }
                }
                true
            }
            None => false,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, plugin_key, instance_id, registry);
        false
    }
}
