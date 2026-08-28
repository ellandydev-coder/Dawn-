// src-tauri/src/vst3/editor/position.rs

use super::super::registry::Vst3Registry;

#[cfg(target_os = "windows")]
pub unsafe fn update_editor_position(
    parent_hwnd: usize,
    registry: &Vst3Registry,
    plugin_key: &str,
    instance_id: &str,
    client_x: i32,
    client_y: i32,
    width: i32,
    height: i32,
) -> bool {
    use windows::Win32::Foundation::{HWND, POINT};
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, HWND_TOP, SWP_NOACTIVATE, SWP_SHOWWINDOW};
    use windows::Win32::Graphics::Gdi::ClientToScreen;
    use crate::vst3_com::iplug_view;

    let mut pt = POINT { x: client_x, y: client_y };
    let _ = ClientToScreen(HWND(parent_hwnd as *mut _), &mut pt);

    registry.with_plugin(plugin_key, |p| {
        if let Some(inst) = p.instances.get(instance_id) {
            if let Some(ref ed) = inst.editor {
                let _ = SetWindowPos(
                    HWND(ed.hwnd as *mut _),
                    HWND_TOP,
                    pt.x, pt.y, width, height,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
                if ed.view_ptr != 0 {
                    let mut rect = iplug_view::ViewRect::new(width, height);
                    iplug_view::on_size(ed.view_ptr as *mut _, &mut rect);
                }
                return true;
            }
        }
        false
    }).unwrap_or(false)
}