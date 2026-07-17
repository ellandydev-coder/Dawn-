// src-tauri/src/vst3_editor.rs
#![allow(dead_code)]

use tauri::State;
use crate::vst3_registry::{EditorInstance, Vst3Registry};

#[derive(Debug, serde::Serialize)]
pub struct OpenEditorResult {
    pub success:        bool,
    pub message:        String,
    pub hwnd:           Option<String>,
    pub width:          i32,
    pub height:         i32,
    pub controller_ptr: Option<String>,
    pub view_ptr:       Option<String>,
}

#[tauri::command]
pub fn vst3_open_editor(
    plugin_key:  String,
    instance_id: String,
    registry:    State<'_, Vst3Registry>,
) -> OpenEditorResult {
    log::info!(
        "[vst3_editor] open_editor: plugin={} inst={}",
        plugin_key, instance_id
    );

    #[cfg(target_os = "windows")]
    {
        use crate::vst3_com::{funknown, iedit_controller, iplug_view};
        use crate::vst3_com::iedit_controller::IID_IEDIT_CONTROLLER;
        use crate::vst3_host_context::DawnHost;

        // ── 1. Verificar instancia + obtener factory_ptr ─────────
        let (component_ptr, factory_ptr) = match registry.with_plugin(&plugin_key, |p| {
            p.instances.get(&instance_id).map(|inst| {
                (inst.component_ptr, inst.initialized, inst.editor.is_some(), p.factory_ptr)
            })
        }).flatten() {
            Some((ptr, initialized, has_editor, factory)) => {
                log::info!(
                    "[vst3_editor]   component_ptr=0x{:016x} factory_ptr=0x{:016x}",
                    ptr, factory
                );
                if !initialized {
                    return OpenEditorResult {
                        success: false,
                        message: "La instancia no está inicializada.".to_string(),
                        hwnd: None, width: 0, height: 0,
                        controller_ptr: None, view_ptr: None,
                    };
                }
                if has_editor {
                    return OpenEditorResult {
                        success: false,
                        message: "El editor ya está abierto.".to_string(),
                        hwnd: None, width: 0, height: 0,
                        controller_ptr: None, view_ptr: None,
                    };
                }
                if ptr == 0 {
                    return OpenEditorResult {
                        success: false,
                        message: "component_ptr es NULL".to_string(),
                        hwnd: None, width: 0, height: 0,
                        controller_ptr: None, view_ptr: None,
                    };
                }
                (ptr, factory)
            }
            None => return OpenEditorResult {
                success: false,
                message: format!("Instancia no encontrada: {}", instance_id),
                hwnd: None, width: 0, height: 0,
                controller_ptr: None, view_ptr: None,
            },
        };

        let host_ptr = DawnHost::get_singleton_ptr();

        // ── 2. Obtener IEditController ───────────────────────────
        let controller_ptr = unsafe {
            match funknown::query_interface(
                component_ptr as *mut _,
                &IID_IEDIT_CONTROLLER,
            ) {
                Ok(ptr) => {
                    log::info!(
                        "[vst3_editor]   IEditController via QI: 0x{:016x}",
                        ptr as usize
                    );
                    ptr
                }
                Err(hr) => {
                    log::info!(
                        "[vst3_editor]   QI(IEditController) → hr=0x{:08X} \
                         — intentando instancia separada...",
                        hr as u32
                    );
                    match create_controller_from_factory(factory_ptr, host_ptr) {
                        Ok(ptr) => ptr,
                        Err(e) => {
                            return OpenEditorResult {
                                success: false,
                                message: format!(
                                    "No se pudo obtener IEditController: {}", e
                                ),
                                hwnd: None, width: 0, height: 0,
                                controller_ptr: None, view_ptr: None,
                            };
                        }
                    }
                }
            }
        };

        log::info!(
            "[vst3_editor]   IEditController listo: 0x{:016x}",
            controller_ptr as usize
        );

        // ── 3. Conectar component ↔ controller (IConnectionPoint) ─
        // Necesario para que createView funcione en plugins con
        // arquitectura separada (Auxfeed, etc).
        unsafe {
            use crate::vst3_com::iconnection_point;
            if let Err(e) = iconnection_point::connect_peers(
                component_ptr as *mut _,
                controller_ptr,
            ) {
                log::warn!(
                    "[vst3_editor] connect_peers falló: {} (continuando...)", e
                );
            }
        }

        // ── 4. createView("editor") ──────────────────────────────
        let view_ptr = unsafe {
            match iedit_controller::create_view(controller_ptr) {
                Ok(ptr) => ptr,
                Err(hr) => {
                    funknown::release(controller_ptr);
                    return OpenEditorResult {
                        success: false,
                        message: format!(
                            "createView('editor') falló (hr=0x{:08X}).", hr as u32
                        ),
                        hwnd: None, width: 0, height: 0,
                        controller_ptr: None, view_ptr: None,
                    };
                }
            }
        };

        log::info!(
            "[vst3_editor]   IPlugView: 0x{:016x}",
            view_ptr as usize
        );

        // ── 5. isPlatformTypeSupported("HWND") ───────────────────
        let supported = unsafe { iplug_view::is_platform_supported(view_ptr) };
        if !supported {
            unsafe {
                funknown::release(view_ptr);
                funknown::release(controller_ptr);
            }
            return OpenEditorResult {
                success: false,
                message: "El plugin no soporta ventana HWND.".to_string(),
                hwnd: None, width: 0, height: 0,
                controller_ptr: None, view_ptr: None,
            };
        }

        // ── 6. Crear ventana Win32 ───────────────────────────────
        let hwnd = match create_plugin_window() {
            Ok(h) => h,
            Err(e) => {
                unsafe {
                    funknown::release(view_ptr);
                    funknown::release(controller_ptr);
                }
                return OpenEditorResult {
                    success: false,
                    message: format!("CreateWindowExW falló: {}", e),
                    hwnd: None, width: 0, height: 0,
                    controller_ptr: None, view_ptr: None,
                };
            }
        };

        log::info!("[vst3_editor]   HWND: 0x{:016x}", hwnd);

        // ── 7. view->attached(hwnd) ──────────────────────────────
        let hr_attach = unsafe {
            iplug_view::attached(view_ptr, hwnd as *mut _)
        };

        if hr_attach != 0 {
            unsafe {
                funknown::release(view_ptr);
                funknown::release(controller_ptr);
                destroy_window(hwnd);
            }
            return OpenEditorResult {
                success: false,
                message: format!(
                    "view->attached() falló: HRESULT=0x{:08X}", hr_attach as u32
                ),
                hwnd: None, width: 0, height: 0,
                controller_ptr: None, view_ptr: None,
            };
        }

        // ── 8. getSize() + resize ────────────────────────────────
        let (width, height) = unsafe {
            match iplug_view::get_size(view_ptr) {
                Ok(rect) if rect.width() > 0 && rect.height() > 0 => {
                    (rect.width(), rect.height())
                }
                _ => (800, 600),
            }
        };

        log::info!("[vst3_editor]   Tamaño: {}x{}", width, height);

        unsafe { resize_window(hwnd, width, height); }

        unsafe {
            let mut rect = crate::vst3_com::iplug_view::ViewRect::new(width, height);
            iplug_view::on_size(view_ptr, &mut rect);
        }

        unsafe { show_window(hwnd); }

        // ── 9. Guardar EditorInstance ────────────────────────────
        let editor = EditorInstance {
            controller_ptr: controller_ptr as usize,
            view_ptr:       view_ptr as usize,
            hwnd,
            width,
            height,
        };

        registry.with_plugin_mut(&plugin_key, |p| {
            if let Some(inst) = p.instances.get_mut(&instance_id) {
                inst.editor = Some(editor);
            }
        });

        log::info!(
            "[vst3_editor] ✅ Editor abierto: {}x{} HWND=0x{:016x}",
            width, height, hwnd
        );

        OpenEditorResult {
            success:        true,
            message:        format!("Editor abierto ({}x{})", width, height),
            hwnd:           Some(format!("0x{:016x}", hwnd)),
            width,
            height,
            controller_ptr: Some(format!("0x{:016x}", controller_ptr as usize)),
            view_ptr:       Some(format!("0x{:016x}", view_ptr as usize)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, instance_id, registry);
        OpenEditorResult {
            success: false,
            message: "Editor solo implementado en Windows".to_string(),
            hwnd: None, width: 0, height: 0,
            controller_ptr: None, view_ptr: None,
        }
    }
}

#[tauri::command]
pub fn vst3_close_editor(
    plugin_key:  String,
    instance_id: String,
    registry:    State<'_, Vst3Registry>,
) -> bool {
    log::info!(
        "[vst3_editor] close_editor: plugin={} inst={}",
        plugin_key, instance_id
    );

    #[cfg(target_os = "windows")]
    {
        let editor = registry.with_plugin_mut(&plugin_key, |p| {
            p.instances.get_mut(&instance_id)?.editor.take()
        }).flatten();

        match editor {
            Some(mut ed) => {
                unsafe { ed.teardown(); }
                log::info!("[vst3_editor] ✅ Editor cerrado");
                true
            }
            None => {
                log::warn!("[vst3_editor] close: no hay editor abierto");
                false
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, instance_id, registry);
        false
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPER — instanciar controller separado desde el factory
// ═══════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
unsafe fn create_controller_from_factory(
    factory_ptr: usize,
    host_ptr:    *mut core::ffi::c_void,
) -> Result<*mut core::ffi::c_void, String> {
    use crate::vst3_com::ifactory::{IPluginFactory, PClassInfo};
    use crate::vst3_com::iedit_controller::IID_IEDIT_CONTROLLER;
    use crate::vst3_com::iplugin_base;
    use crate::vst3_com::funknown;

    const IID_FUNKNOWN: crate::vst3_com::Tuid = [
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46,
    ];

    log::info!(
        "[vst3_editor] create_controller_from_factory: factory_ptr=0x{:016x}",
        factory_ptr
    );

    if factory_ptr == 0 {
        return Err("factory_ptr es NULL".to_string());
    }

    let factory = factory_ptr as *mut IPluginFactory;
    let vtable  = (*factory).vtable;
    if vtable.is_null() {
        return Err("factory vtable es NULL".to_string());
    }

    let count = ((*vtable).count_classes)(factory_ptr as *mut _);
    log::info!("[vst3_editor]   count_classes={}", count);

    if count <= 0 || count > 128 {
        return Err(format!("count_classes devolvió {} — inválido", count));
    }

    for i in 0..count {
        let mut info = PClassInfo::zeroed();
        let hr = ((*vtable).get_class_info)(factory_ptr as *mut _, i, &mut info);

        log::info!(
            "[vst3_editor]   clase[{}]: hr=0x{:08X} category='{}' name='{}'",
            i, hr as u32, info.category_str(), info.name_str()
        );

        if hr != 0 { continue; }

        let category = info.category_str();
        if !category.contains("Controller") {
            continue;
        }

        let cid = info.cid;
        log::info!(
            "[vst3_editor]   → Instanciando CID={} con IID_FUNKNOWN",
            info.cid_str()
        );

        let raw_ptr = match crate::vst3_com::ifactory::create_instance(
            factory_ptr as *mut _,
            &cid,
            &IID_FUNKNOWN,
        ) {
            Ok(ptr) => {
                log::info!(
                    "[vst3_editor]   createInstance(FUnknown) OK → 0x{:016x}",
                    ptr as usize
                );
                ptr
            }
            Err(hr) => {
                log::warn!(
                    "[vst3_editor]   createInstance(FUnknown) falló hr=0x{:08X}",
                    hr as u32
                );
                continue;
            }
        };

        let controller_ptr = match funknown::query_interface(raw_ptr, &IID_IEDIT_CONTROLLER) {
            Ok(ptr) => {
                log::info!(
                    "[vst3_editor]   QI(IEditController) OK → 0x{:016x}",
                    ptr as usize
                );
                funknown::release(raw_ptr);
                ptr
            }
            Err(hr) => {
                log::warn!(
                    "[vst3_editor]   QI(IEditController) falló hr=0x{:08X}",
                    hr as u32
                );
                funknown::release(raw_ptr);
                continue;
            }
        };

        let hr_init = iplugin_base::initialize(controller_ptr, host_ptr);
        log::info!(
            "[vst3_editor]   initialize → hr=0x{:08X}",
            hr_init as u32
        );

        log::info!(
            "[vst3_editor]   ✅ Controller listo: 0x{:016x}",
            controller_ptr as usize
        );

        return Ok(controller_ptr);
    }

    Err(format!(
        "No se encontró ninguna clase Controller ({} clases inspeccionadas)",
        count
    ))
}

// ═══════════════════════════════════════════════════════════════
// 🎯 WIN32 HELPERS
// ═══════════════════════════════════════════════════════════════

const WINDOW_CLASS_NAME: &str = "DawnPluginWindow";

#[cfg(target_os = "windows")]
fn create_plugin_window() -> Result<usize, String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Foundation::LRESULT;
    use windows::Win32::Foundation::WPARAM;
    use windows::Win32::Foundation::LPARAM;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::CreateWindowExW;
    use windows::Win32::UI::WindowsAndMessaging::RegisterClassExW;
    use windows::Win32::UI::WindowsAndMessaging::WNDCLASSEXW;
    use windows::Win32::UI::WindowsAndMessaging::CS_HREDRAW;
    use windows::Win32::UI::WindowsAndMessaging::CS_VREDRAW;
    use windows::Win32::UI::WindowsAndMessaging::CW_USEDEFAULT;
    use windows::Win32::UI::WindowsAndMessaging::WS_OVERLAPPEDWINDOW;
    use windows::Win32::UI::WindowsAndMessaging::WS_EX_APPWINDOW;

    let class_name: Vec<u16> = WINDOW_CLASS_NAME
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    let window_title: Vec<u16> = "Plugin Editor"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    let hinstance = unsafe {
        GetModuleHandleW(PCWSTR::null())
            .map_err(|e| format!("GetModuleHandleW: {}", e))?
    };

    unsafe extern "system" fn def_wnd_proc(
        hwnd:   HWND,
        msg:    u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        use windows::Win32::UI::WindowsAndMessaging::DefWindowProcW;
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    let wc = WNDCLASSEXW {
        cbSize:        std::mem::size_of::<WNDCLASSEXW>() as u32,
        style:         CS_HREDRAW | CS_VREDRAW,
        lpfnWndProc:   Some(def_wnd_proc),
        hInstance:     hinstance.into(),
        lpszClassName: PCWSTR(class_name.as_ptr()),
        ..Default::default()
    };

    unsafe { let _ = RegisterClassExW(&wc); }

    let hwnd = unsafe {
        CreateWindowExW(
            WS_EX_APPWINDOW,
            PCWSTR(class_name.as_ptr()),
            PCWSTR(window_title.as_ptr()),
            WS_OVERLAPPEDWINDOW,
            CW_USEDEFAULT, CW_USEDEFAULT,
            800, 600,
            HWND::default(),
            None,
            hinstance,
            None,
        ).map_err(|e| format!("CreateWindowExW: {}", e))?
    };

    if hwnd.is_invalid() {
        return Err("CreateWindowExW devolvió HWND inválido".to_string());
    }

    Ok(hwnd.0 as usize)
}

#[cfg(target_os = "windows")]
unsafe fn resize_window(hwnd: usize, width: i32, height: i32) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::AdjustWindowRectEx;
    use windows::Win32::UI::WindowsAndMessaging::SetWindowPos;
    use windows::Win32::UI::WindowsAndMessaging::HWND_TOP;
    use windows::Win32::UI::WindowsAndMessaging::SET_WINDOW_POS_FLAGS;
    use windows::Win32::UI::WindowsAndMessaging::WS_OVERLAPPEDWINDOW;
    use windows::Win32::UI::WindowsAndMessaging::WS_EX_APPWINDOW;

    const SWP_NOMOVE:       SET_WINDOW_POS_FLAGS = SET_WINDOW_POS_FLAGS(0x0002);
    const SWP_NOZORDER:     SET_WINDOW_POS_FLAGS = SET_WINDOW_POS_FLAGS(0x0004);
    const SWP_FRAMECHANGED: SET_WINDOW_POS_FLAGS = SET_WINDOW_POS_FLAGS(0x0020);

    let mut rect = RECT {
        left: 0, top: 0, right: width, bottom: height,
    };

    let _ = AdjustWindowRectEx(
        &mut rect,
        WS_OVERLAPPEDWINDOW,
        false,
        WS_EX_APPWINDOW,
    );

    let total_w = rect.right  - rect.left;
    let total_h = rect.bottom - rect.top;

    let _ = SetWindowPos(
        HWND(hwnd as *mut _),
        HWND_TOP,
        0, 0,
        total_w, total_h,
        SWP_NOMOVE | SWP_NOZORDER | SWP_FRAMECHANGED,
    );

    log::debug!(
        "[vst3_editor] resize_window: client={}x{} total={}x{}",
        width, height, total_w, total_h
    );
}

#[cfg(target_os = "windows")]
unsafe fn show_window(hwnd: usize) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::ShowWindow;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOW;
    let _ = ShowWindow(HWND(hwnd as *mut _), SW_SHOW);
}

#[cfg(target_os = "windows")]
unsafe fn destroy_window(hwnd: usize) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::DestroyWindow;
    let _ = DestroyWindow(HWND(hwnd as *mut _));
}