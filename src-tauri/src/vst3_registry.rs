// src-tauri/src/vst3_registry.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 VST3 Registry — Plugins cargados + instancias vivas
// ═══════════════════════════════════════════════════════════════
//
// ── ESTADO ACTUAL (Sub-paso 3.2) ──
// ✅ Cargar plugin y mantenerlo vivo
// ✅ Listar plugins cargados
// ✅ Descargar plugin (libera DLL + instancias en orden correcto)
// ✅ Instanciar componentes
// ✅ Release automático de todas las instancias en Drop
// ✅ Estado initialized + plugin_base_ptr por instancia
// ✅ Teardown correcto
// ✅ EditorInstance: controller + view + hwnd               ← 3.2

#![allow(dead_code)]

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub type PluginKey  = String;
pub type InstanceId = String;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS PÚBLICOS
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, serde::Serialize)]
pub struct InstanceInfo {
    pub instance_id:     InstanceId,
    pub class_cid:       String,
    pub component_ptr:   String,
    pub initialized:     bool,
    pub plugin_base_ptr: String,
    pub has_editor:      bool,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 EDITOR INSTANCE
// ═══════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
pub struct EditorInstance {
    pub controller_ptr: usize,
    pub view_ptr:       usize,
    pub hwnd:           usize,
    pub width:          i32,
    pub height:         i32,
}

#[cfg(target_os = "windows")]
impl EditorInstance {
    pub unsafe fn teardown(&mut self) {
        use crate::vst3_com::funknown;
        use crate::vst3_com::iplug_view;
        use crate::vst3_com::iplugin_base;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::DestroyWindow;

        // 1. Desconectar la vista de la ventana
        if self.view_ptr != 0 {
            iplug_view::removed(self.view_ptr as *mut _);
        }

        // 2. Release del IPlugView
        if self.view_ptr != 0 {
            let rc = funknown::release(self.view_ptr as *mut _);
            log::debug!(
                "[EditorInstance::teardown] view released → refcount={}", rc
            );
            self.view_ptr = 0;
        }

        // 3. Destruir la ventana Win32
        if self.hwnd != 0 {
            let _ = DestroyWindow(HWND(self.hwnd as *mut _));
            log::debug!("[EditorInstance::teardown] HWND destruido");
            self.hwnd = 0;
        }

        // 4. Terminate + release del controller
        if self.controller_ptr != 0 {
            let hr = iplugin_base::terminate(self.controller_ptr as *mut _);
            log::debug!(
                "[EditorInstance::teardown] controller terminate → HRESULT=0x{:08X}",
                hr as u32
            );
            let rc = funknown::release(self.controller_ptr as *mut _);
            log::debug!(
                "[EditorInstance::teardown] controller released → refcount={}", rc
            );
            self.controller_ptr = 0;
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMPONENT INSTANCE
// ═══════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
pub struct ComponentInstance {
    pub component_ptr:   usize,
    pub class_cid:       String,
    pub initialized:     bool,
    pub plugin_base_ptr: usize,
    pub editor:          Option<EditorInstance>,
}

#[cfg(target_os = "windows")]
impl ComponentInstance {
    pub fn new(component_ptr: usize, class_cid: String) -> Self {
        Self {
            component_ptr,
            class_cid,
            initialized:     false,
            plugin_base_ptr: 0,
            editor:          None,
        }
    }

    pub fn to_info(&self, instance_id: &str) -> InstanceInfo {
        InstanceInfo {
            instance_id:     instance_id.to_string(),
            class_cid:       self.class_cid.clone(),
            component_ptr:   format!("0x{:016x}", self.component_ptr),
            initialized:     self.initialized,
            plugin_base_ptr: format!("0x{:016x}", self.plugin_base_ptr),
            has_editor:      self.editor.is_some(),
        }
    }

    pub unsafe fn teardown(&mut self) {
        use crate::vst3_com::funknown;
        use crate::vst3_com::iplugin_base;

        // Primero cerrar el editor si está abierto
        if let Some(mut ed) = self.editor.take() {
            ed.teardown();
        }

        if self.initialized && self.plugin_base_ptr != 0 {
            let hr = iplugin_base::terminate(self.plugin_base_ptr as *mut _);
            log::debug!(
                "[ComponentInstance::teardown] terminate() → HRESULT=0x{:08X}",
                hr as u32
            );
            self.initialized = false;
        }

        if self.plugin_base_ptr != 0 {
            let refs = funknown::release(self.plugin_base_ptr as *mut _);
            log::debug!(
                "[ComponentInstance::teardown] plugin_base released → refcount={}",
                refs
            );
            self.plugin_base_ptr = 0;
        }

        if self.component_ptr != 0 {
            let refs = funknown::release(self.component_ptr as *mut _);
            log::debug!(
                "[ComponentInstance::teardown] component released → refcount={}",
                refs
            );
            self.component_ptr = 0;
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 LOADED PLUGIN
// ═══════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
pub struct LoadedPlugin {
    pub bundle_path: PathBuf,
    pub dll_path:    PathBuf,
    pub hmodule:     usize,
    pub factory_ptr: usize,
    pub instances:   HashMap<InstanceId, ComponentInstance>,
}

#[cfg(target_os = "windows")]
impl LoadedPlugin {
    pub fn new(
        bundle_path: PathBuf,
        dll_path:    PathBuf,
        hmodule:     usize,
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
        use windows::Win32::Foundation::FreeLibrary;
        use windows::Win32::Foundation::HMODULE;

        log::info!(
            "[LoadedPlugin::drop] Liberando: {} instancias, factory=0x{:x}",
            self.instances.len(), self.factory_ptr
        );

        for (id, mut inst) in self.instances.drain() {
            log::debug!("[LoadedPlugin::drop] tearing down instance {}", id);
            unsafe { inst.teardown(); }
        }

        if self.factory_ptr != 0 {
            unsafe {
                let rc = funknown::release(self.factory_ptr as *mut _);
                log::debug!(
                    "[LoadedPlugin::drop] factory released → refcount={}", rc
                );
            }
            self.factory_ptr = 0;
        }

        if self.hmodule != 0 {
            unsafe {
                let hmod = HMODULE(self.hmodule as *mut _);
                let _ = FreeLibrary(hmod);
                log::debug!("[LoadedPlugin::drop] DLL freed");
            }
            self.hmodule = 0;
        }
    }
}

#[cfg(target_os = "windows")]
unsafe impl Send for LoadedPlugin {}

// ═══════════════════════════════════════════════════════════════
// 🎯 REGISTRY
// ═══════════════════════════════════════════════════════════════

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
    pub fn contains(&self, key: &str) -> bool {
        self.plugins.lock().unwrap().contains_key(key)
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
    where F: FnOnce(&LoadedPlugin) -> R {
        self.plugins.lock().unwrap().get(key).map(f)
    }

    #[cfg(target_os = "windows")]
    pub fn with_plugin_mut<F, R>(&self, key: &str, f: F) -> Option<R>
    where F: FnOnce(&mut LoadedPlugin) -> R {
        self.plugins.lock().unwrap().get_mut(key).map(f)
    }

    #[cfg(not(target_os = "windows"))]
    pub fn list_keys(&self) -> Vec<PluginKey> { vec![] }

    #[cfg(not(target_os = "windows"))]
    pub fn len(&self) -> usize { 0 }
}

impl Default for Vst3Registry {
    fn default() -> Self { Self::new() }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_starts_empty() {
        let reg = Vst3Registry::new();
        assert_eq!(reg.len(), 0);
        assert!(reg.list_keys().is_empty());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn make_key_uses_path() {
        let key = make_plugin_key("C:\\VST3\\Auxfeed.vst3");
        assert_eq!(key, "C:\\VST3\\Auxfeed.vst3");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn instance_id_has_correct_format() {
        let id = make_instance_id();
        assert!(id.starts_with("inst_"), "Got: {}", id);
        assert_eq!(id.len(), 21);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn two_instance_ids_are_different() {
        let id1 = make_instance_id();
        let id2 = make_instance_id();
        assert_ne!(id1, id2);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn component_instance_starts_uninitialized() {
        let inst = ComponentInstance::new(0xDEADBEEF, "FAKECID".to_string());
        assert!(!inst.initialized);
        assert_eq!(inst.plugin_base_ptr, 0);
        assert!(inst.editor.is_none());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn to_info_has_editor_false_by_default() {
        let inst = ComponentInstance::new(0xAAAA, "CID".to_string());
        let info = inst.to_info("inst_test");
        assert!(!info.has_editor);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn to_info_serializes_all_fields() {
        let mut inst = ComponentInstance::new(0xAAAA, "CIDXYZ".to_string());
        inst.initialized     = true;
        inst.plugin_base_ptr = 0xBBBB;

        let info = inst.to_info("inst_test");
        assert_eq!(info.instance_id,     "inst_test");
        assert_eq!(info.class_cid,       "CIDXYZ");
        assert_eq!(info.component_ptr,   "0x000000000000aaaa");
        assert!(info.initialized);
        assert_eq!(info.plugin_base_ptr, "0x000000000000bbbb");
        assert!(!info.has_editor);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn teardown_with_zero_ptrs_is_no_op() {
        let mut inst = ComponentInstance::new(0, "".to_string());
        unsafe { inst.teardown(); }
        assert_eq!(inst.component_ptr,   0);
        assert_eq!(inst.plugin_base_ptr, 0);
        assert!(!inst.initialized);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn insert_and_take_work_with_null_ptrs() {
        let reg = Vst3Registry::new();
        let key = make_plugin_key("C:\\test\\fake.vst3");
        let plugin = LoadedPlugin::new(
            PathBuf::from("C:\\test\\fake.vst3"),
            PathBuf::from("C:\\test\\fake.vst3"),
            0, 0,
        );
        reg.insert(key.clone(), plugin);
        assert_eq!(reg.len(), 1);
        let taken = reg.take(&key);
        assert!(taken.is_some());
        assert_eq!(reg.len(), 0);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn with_plugin_mut_allows_editing_instances() {
        let reg = Vst3Registry::new();
        let key = make_plugin_key("C:\\test\\fake.vst3");
        let plugin = LoadedPlugin::new(
            PathBuf::from("C:\\test\\fake.vst3"),
            PathBuf::from("C:\\test\\fake.vst3"),
            0, 0,
        );
        reg.insert(key.clone(), plugin);

        let result = reg.with_plugin_mut(&key, |p| {
            p.instances.insert(
                "inst_test".to_string(),
                ComponentInstance::new(0, "FAKE".to_string()),
            );
            p.instances.len()
        });
        assert_eq!(result, Some(1));
        reg.take(&key);
    }
}