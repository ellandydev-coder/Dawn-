// src-tauri/src/vst3/registry.rs

#![allow(dead_code)]

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub type PluginKey = String;
pub type InstanceId = String;

#[derive(Debug, Clone, serde::Serialize)]
pub struct InstanceInfo {
    pub instance_id: InstanceId,
    pub class_cid: String,
    pub component_ptr: String,
    pub initialized: bool,
    pub plugin_base_ptr: String,
    pub has_editor: bool,
    pub has_processor: bool,
    pub processing_active: bool,
}

#[cfg(target_os = "windows")]
pub struct EditorInstance {
    pub controller_ptr: usize,
    pub view_ptr: usize,
    pub hwnd: usize,
    pub width: i32,
    pub height: i32,
}

#[cfg(target_os = "windows")]
impl EditorInstance {
    pub unsafe fn teardown(&mut self) {
        use crate::vst3_com::funknown;
        use crate::vst3_com::iplug_view;
        use crate::vst3_com::iplugin_base;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::DestroyWindow;

        if self.view_ptr != 0 {
            iplug_view::removed(self.view_ptr as *mut _);
            funknown::release(self.view_ptr as *mut _);
            self.view_ptr = 0;
        }

        if self.hwnd != 0 {
            let _ = DestroyWindow(HWND(self.hwnd as *mut _));
            self.hwnd = 0;
        }

        if self.controller_ptr != 0 {
            let _ = iplugin_base::terminate(self.controller_ptr as *mut _);
            funknown::release(self.controller_ptr as *mut _);
            self.controller_ptr = 0;
        }
    }
}

#[cfg(target_os = "windows")]
pub struct ComponentInstance {
    pub component_ptr: usize,
    pub class_cid: String,
    pub initialized: bool,
    pub plugin_base_ptr: usize,
    pub editor: Option<EditorInstance>,
    /// IAudioProcessor (QI desde component)
    pub processor_ptr: usize,
    pub processing_active: bool,
    pub sample_rate: f64,
    pub max_block_size: i32,
}

#[cfg(target_os = "windows")]
impl ComponentInstance {
    pub fn new(component_ptr: usize, class_cid: String) -> Self {
        Self {
            component_ptr,
            class_cid,
            initialized: false,
            plugin_base_ptr: 0,
            editor: None,
            processor_ptr: 0,
            processing_active: false,
            sample_rate: 0.0,
            max_block_size: 0,
        }
    }

    pub fn to_info(&self, instance_id: &str) -> InstanceInfo {
        InstanceInfo {
            instance_id: instance_id.to_string(),
            class_cid: self.class_cid.clone(),
            component_ptr: format!("0x{:016x}", self.component_ptr),
            initialized: self.initialized,
            plugin_base_ptr: format!("0x{:016x}", self.plugin_base_ptr),
            has_editor: self.editor.is_some(),
            has_processor: self.processor_ptr != 0,
            processing_active: self.processing_active,
        }
    }

    pub unsafe fn teardown(&mut self) {
        use crate::vst3_com::funknown;
        use crate::vst3_com::iaudio_processor;
        use crate::vst3_com::iplugin_base;

        // 1) Editor GUI
        if let Some(mut ed) = self.editor.take() {
            ed.teardown();
        }

        // 2) Audio processor (antes de terminate del component)
        if self.processor_ptr != 0 {
            if self.processing_active {
                let _ = iaudio_processor::set_processing(self.processor_ptr as *mut _, false);
                self.processing_active = false;
            }
            funknown::release(self.processor_ptr as *mut _);
            self.processor_ptr = 0;
            self.sample_rate = 0.0;
            self.max_block_size = 0;
        }

        // 3) Plugin base terminate + release
        if self.initialized && self.plugin_base_ptr != 0 {
            let _ = iplugin_base::terminate(self.plugin_base_ptr as *mut _);
            self.initialized = false;
        }

        if self.plugin_base_ptr != 0 {
            funknown::release(self.plugin_base_ptr as *mut _);
            self.plugin_base_ptr = 0;
        }

        if self.component_ptr != 0 {
            funknown::release(self.component_ptr as *mut _);
            self.component_ptr = 0;
        }
    }
}

#[cfg(target_os = "windows")]
pub struct LoadedPlugin {
    pub bundle_path: PathBuf,
    pub dll_path: PathBuf,
    pub hmodule: usize,
    pub factory_ptr: usize,
    pub instances: HashMap<InstanceId, ComponentInstance>,
}

#[cfg(target_os = "windows")]
impl LoadedPlugin {
    pub fn new(
        bundle_path: PathBuf,
        dll_path: PathBuf,
        hmodule: usize,
        factory_ptr: usize,
    ) -> Self {
        Self {
            bundle_path,
            dll_path,
            hmodule,
            factory_ptr,
            instances: HashMap::new(),
        }
    }
}

#[cfg(target_os = "windows")]
impl Drop for LoadedPlugin {
    fn drop(&mut self) {
        use crate::vst3_com::funknown;
        use windows::Win32::Foundation::{FreeLibrary, HMODULE};

        for (_, mut inst) in self.instances.drain() {
            unsafe {
                inst.teardown();
            }
        }

        if self.factory_ptr != 0 {
            unsafe {
                funknown::release(self.factory_ptr as *mut _);
            }
            self.factory_ptr = 0;
        }

        if self.hmodule != 0 {
            unsafe {
                let _ = FreeLibrary(HMODULE(self.hmodule as *mut _));
            }
            self.hmodule = 0;
        }
    }
}

#[cfg(target_os = "windows")]
unsafe impl Send for LoadedPlugin {}

pub struct Vst3Registry {
    #[cfg(target_os = "windows")]
    plugins: Mutex<HashMap<PluginKey, LoadedPlugin>>,

    #[cfg(not(target_os = "windows"))]
    _phantom: std::marker::PhantomData<()>,
}

impl Vst3Registry {
    pub fn new() -> Self {
        Self {
            #[cfg(target_os = "windows")]
            plugins: Mutex::new(HashMap::new()),
            #[cfg(not(target_os = "windows"))]
            _phantom: std::marker::PhantomData,
        }
    }

    #[cfg(target_os = "windows")]
    pub fn insert(&self, key: PluginKey, plugin: LoadedPlugin) -> Option<LoadedPlugin> {
        self.plugins.lock().unwrap().insert(key, plugin)
    }

    #[cfg(target_os = "windows")]
    pub fn take(&self, key: &str) -> Option<LoadedPlugin> {
        self.plugins.lock().unwrap().remove(key)
    }

    #[cfg(target_os = "windows")]
    pub fn list_keys(&self) -> Vec<PluginKey> {
        self.plugins.lock().unwrap().keys().cloned().collect()
    }

    #[cfg(target_os = "windows")]
    pub fn len(&self) -> usize {
        self.plugins.lock().unwrap().len()
    }

    #[cfg(target_os = "windows")]
    pub fn with_plugin<F, R>(&self, key: &str, f: F) -> Option<R>
    where
        F: FnOnce(&LoadedPlugin) -> R,
    {
        self.plugins.lock().unwrap().get(key).map(f)
    }

    #[cfg(target_os = "windows")]
    pub fn with_plugin_mut<F, R>(&self, key: &str, f: F) -> Option<R>
    where
        F: FnOnce(&mut LoadedPlugin) -> R,
    {
        self.plugins.lock().unwrap().get_mut(key).map(f)
    }

    #[cfg(not(target_os = "windows"))]
    pub fn list_keys(&self) -> Vec<PluginKey> {
        vec![]
    }

    #[cfg(not(target_os = "windows"))]
    pub fn len(&self) -> usize {
        0
    }
}

impl Default for Vst3Registry {
    fn default() -> Self {
        Self::new()
    }
}

pub fn make_plugin_key(bundle_path: &str) -> PluginKey {
    bundle_path.to_string()
}

#[cfg(target_os = "windows")]
pub fn make_instance_id() -> InstanceId {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let stack_addr = &ts as *const _ as u64;
    format!("inst_{:08x}{:08x}", ts as u32, stack_addr as u32)
}