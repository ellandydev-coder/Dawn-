// src-tauri/src/vst3/dll.rs

use std::path::{Path, PathBuf};
use super::types::Vst3ClassInfo;

#[cfg(target_os = "windows")]
pub const DLL_SEARCH_PATHS: &[&str] = &["Contents/x86_64-win", "Contents/x86-win"];

#[cfg(target_os = "macos")]
pub const DLL_SEARCH_PATHS: &[&str] = &["Contents/MacOS"];

#[cfg(target_os = "linux")]
pub const DLL_SEARCH_PATHS: &[&str] = &["Contents/x86_64-linux"];

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
pub const DLL_SEARCH_PATHS: &[&str] = &[];

pub fn resolve_dll_path(bundle: &Path) -> Option<PathBuf> {
    if bundle.is_file() {
        return Some(bundle.to_path_buf());
    }

    for sub in DLL_SEARCH_PATHS {
        let dir = bundle.join(sub);
        if !dir.is_dir() {
            continue;
        }

        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path
                        .extension()
                        .and_then(|s| s.to_str())
                        .map(|ext| ext.eq_ignore_ascii_case("vst3"))
                        .unwrap_or(false)
                {
                    return Some(path);
                }
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
pub struct LoadedFactory {
    pub hmodule: usize,
    pub factory_ptr: usize,
    pub classes: Vec<Vst3ClassInfo>,
}

#[cfg(target_os = "windows")]
type GetPluginFactoryFn = unsafe extern "C" fn() -> *mut core::ffi::c_void;

#[cfg(target_os = "windows")]
pub fn load_factory(dll_path: &Path) -> Result<LoadedFactory, String> {
    use windows::core::{PCSTR, PCWSTR};
    use windows::Win32::Foundation::FreeLibrary;
    use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};

    let wide: Vec<u16> = dll_path
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    let hmodule = unsafe { LoadLibraryW(PCWSTR(wide.as_ptr())) }
        .map_err(|e| format!("LoadLibraryW falló: {}", e))?;

    if hmodule.is_invalid() {
        return Err("LoadLibraryW devolvió handle inválido".into());
    }

    let handle_ptr = hmodule.0 as usize;
    let proc_addr = unsafe { GetProcAddress(hmodule, PCSTR(b"GetPluginFactory\0".as_ptr())) };

    let proc_addr = match proc_addr {
        Some(addr) => addr,
        None => {
            unsafe { let _ = FreeLibrary(hmodule); }
            return Err("Símbolo 'GetPluginFactory' no encontrado".into());
        }
    };

    let get_factory: GetPluginFactoryFn = unsafe { std::mem::transmute(proc_addr) };
    let factory_raw = unsafe { get_factory() };

    if factory_raw.is_null() {
        unsafe { let _ = FreeLibrary(hmodule); }
        return Err("GetPluginFactory() devolvió NULL".into());
    }

    let classes = unsafe { iterate_factory_classes(factory_raw) };

    Ok(LoadedFactory {
        hmodule: handle_ptr,
        factory_ptr: factory_raw as usize,
        classes,
    })
}

#[cfg(target_os = "windows")]
pub fn free_hmodule(hmodule: usize) {
    use windows::Win32::Foundation::{FreeLibrary, HMODULE};
    if hmodule == 0 { return; }
    unsafe {
        let _ = FreeLibrary(HMODULE(hmodule as *mut _));
    }
}

#[cfg(target_os = "windows")]
pub unsafe fn iterate_factory_classes(factory_raw: *mut core::ffi::c_void) -> Vec<Vst3ClassInfo> {
    use crate::vst3_com::ifactory::{IPluginFactory, PClassInfo};

    let mut classes = Vec::new();
    let factory = factory_raw as *mut IPluginFactory;
    let vtable = (*factory).vtable;
    if vtable.is_null() {
        return classes;
    }

    let count = ((*vtable).count_classes)(factory_raw);
    if count <= 0 || count > 128 {
        return classes;
    }

    for i in 0..count {
        let mut info = PClassInfo::zeroed();
        let hr = ((*vtable).get_class_info)(factory_raw, i, &mut info as *mut PClassInfo);
        if hr != 0 { continue; }
        classes.push(Vst3ClassInfo {
            cid: info.cid_str(),
            cardinality: info.cardinality,
            category: info.category_str(),
            name: info.name_str(),
        });
    }
    classes
}