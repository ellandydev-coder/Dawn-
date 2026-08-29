// src-tauri/src/vst3/editor/win32.rs

#[cfg(target_os = "windows")]
pub fn create_popup_plugin_window(
    parent_hwnd: usize,
    client_x: i32,
    client_y: i32,
    w: i32,
    h: i32,
) -> Result<usize, String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{HWND, LRESULT, WPARAM, LPARAM, POINT};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::Win32::Graphics::Gdi::ClientToScreen;

    let mut pt = POINT { x: client_x, y: client_y };
    unsafe { let _ = ClientToScreen(HWND(parent_hwnd as *mut _), &mut pt); }

    const CHILD_CLASS_NAME: &str = "DawnEmbeddedPluginContainer";
    let class_name: Vec<u16> = CHILD_CLASS_NAME.encode_utf16().chain(std::iter::once(0)).collect();
    let hinstance = unsafe { GetModuleHandleW(PCWSTR::null()).map_err(|e| e.to_string())? };

    unsafe extern "system" fn container_wnd_proc(h: HWND, m: u32, w: WPARAM, l: LPARAM) -> LRESULT {
        DefWindowProcW(h, m, w, l)
    }

    let wc = WNDCLASSEXW {
        cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
        style: CS_HREDRAW | CS_VREDRAW | CS_OWNDC,
        lpfnWndProc: Some(container_wnd_proc),
        hInstance: hinstance.into(),
        lpszClassName: PCWSTR(class_name.as_ptr()),
        ..Default::default()
    };

    unsafe { let _ = RegisterClassExW(&wc); }

    let hwnd = unsafe {
        CreateWindowExW(
            WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TOPMOST,
            PCWSTR(class_name.as_ptr()),
            PCWSTR::null(),
            WS_POPUP | WS_VISIBLE | WS_CLIPCHILDREN | WS_CLIPSIBLINGS,
            pt.x, pt.y, w, h,
            HWND(parent_hwnd as *mut _),
            None,
            hinstance,
            None,
        ).map_err(|e| e.to_string())?
    };

    unsafe {
        let _ = SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            pt.x, pt.y, w, h,
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
    }

    Ok(hwnd.0 as usize)
}

#[cfg(target_os = "windows")]
pub unsafe fn show_window(hwnd: usize) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_SHOW};
    let _ = ShowWindow(HWND(hwnd as *mut _), SW_SHOW);
}

#[cfg(target_os = "windows")]
pub unsafe fn destroy_window(hwnd: usize) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::DestroyWindow;
    let _ = DestroyWindow(HWND(hwnd as *mut _));
}