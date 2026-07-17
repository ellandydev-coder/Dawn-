// src-tauri/src/vst3_registry.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 VST3 Registry — Cache de plugins cargados + instancias vivas
// ═══════════════════════════════════════════════════════════════
//
// ── PROPÓSITO ──
// Un plugin VST3 vive en un DLL. Para usarlo:
//   1. LoadLibrary → HMODULE
//   2. GetPluginFactory → IPluginFactory
//   3. createInstance → IComponent (uno o más)
//
// El HMODULE y el factory DEBEN permanecer vivos MIENTRAS HAYA
// cualquier IComponent instanciado. Si liberamos el DLL con instancias
// vivas, sus vtables apuntan a memoria descargada → CRASH.
//
// ── ESTADO ACTUAL (Paso 2.3) ──
// ✅ Cargar plugin y mantenerlo vivo
// ✅ Listar plugins cargados
// ✅ Descargar plugin (libera DLL + instancias en orden correcto)
// ✅ Instanciar componentes (HashMap<instance_id, ComponentInstance>)
// ✅ Release automático de todas las instancias en Drop
// ⬜ Ciclo de vida COM (initialize/terminate)        [Paso 2.5]
//
// ── ORDEN DE TEARDOWN (CRÍTICO) ──
//
// Cuando un LoadedPlugin se drop:
//   1. Para cada ComponentInstance: release() del ptr COM
//   2. release() del factory
//   3. FreeLibrary(HMODULE)
//
// Este orden es sagrado. Si invertimos 3 con 1 o 2, crash garantizado.
// Por eso implementamos Drop manual — no confiamos en el orden de
// campos que Rust usa por defecto.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS PÚBLICOS
// ═══════════════════════════════════════════════════════════════

/// Handle opaco a un plugin cargado.
pub type PluginKey = String;

/// Handle opaco a una instancia de componente.
pub type InstanceId = String;

/// Info serializable de una instancia (para el frontend).
#[derive(Debug, Clone, serde::Serialize)]
pub struct InstanceInfo {
    pub instance_id: InstanceId,
    /// CID de la clase de la que se instanció
    pub class_cid: String,
    /// Puntero al IComponent (hex, para debug)
    pub component_ptr: String,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS INTERNOS (no serializable — contiene punteros crudos)
// ═══════════════════════════════════════════════════════════════

/// Una instancia viva de IComponent.
///
/// El puntero es propiedad del plugin — nosotros solo tenemos una
/// "referencia" (que ya tiene addRef hecho). Al hacer release, el
/// plugin decide si destruir el objeto o no (según su refcount).
#[cfg(target_os = "windows")]
pub struct ComponentInstance {
    /// Puntero al IComponent devuelto por createInstance.
    /// Se guarda como usize para que Rust no intente drop naïve.
    pub component_ptr: usize,

    /// CID de la clase de la que vino (para debug y para poder
    /// crear su controller asociado en el futuro).
    pub class_cid: String,
}

#[cfg(target_os = "windows")]
impl ComponentInstance {
    fn to_info(&self, instance_id: &str) -> InstanceInfo {
        InstanceInfo {
            instance_id:   instance_id.to_string(),
            class_cid:     self.class_cid.clone(),
            component_ptr: format!("0x{:016x}", self.component_ptr),
        }
    }
}

/// Un plugin VST3 cargado en memoria.
///
/// ⚠️ IMPORTANTE: la implementación de Drop es MANUAL para garantizar
/// el orden correcto de liberación (instancias → factory → DLL).
#[cfg(target_os = "windows")]
pub struct LoadedPlugin {
    pub bundle_path: PathBuf,
    pub dll_path:    PathBuf,

    /// HMODULE devuelto por LoadLibraryW. Se libera en Drop.
    pub hmodule: usize,

    /// Puntero a IPluginFactory. Se libera (release) en Drop.
    pub factory_ptr: usize,

    /// Instancias vivas creadas desde este plugin.
    /// Se liberan (release) en Drop antes de tocar factory/hmodule.
    pub instances: HashMap<InstanceId, ComponentInstance>,
}

#[cfg(target_os = "windows")]
impl LoadedPlugin {
    /// Crea un LoadedPlugin sin instancias.
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

// ═══════════════════════════════════════════════════════════════
// 🎯 DROP MANUAL — orden crítico
// ═══════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
impl Drop for LoadedPlugin {
    fn drop(&mut self) {
        use crate::vst3_com::funknown;
        use windows::Win32::Foundation::{FreeLibrary, HMODULE};

        log::info!(
            "[LoadedPlugin::drop] Liberando plugin: {} instancias, factory=0x{:x}, dll=0x{:x}",
            self.instances.len(), self.factory_ptr, self.hmodule
        );

        // ── 1. RELEASE de todas las instancias ────────────
        // Vaciamos el HashMap capturando los valores. `drain` nos
        // devuelve un iterador que consume el HashMap sin dejarlo
        // en estado intermedio.
        for (id, inst) in self.instances.drain() {
            if inst.component_ptr != 0 {
                unsafe {
                    let refcount = funknown::release(inst.component_ptr as *mut _);
                    log::debug!(
                        "[LoadedPlugin::drop]   instance {} released → refcount={}",
                        id, refcount
                    );
                }
            }
        }

        // ── 2. RELEASE del factory ────────────────────────
        if self.factory_ptr != 0 {
            unsafe {
                let refcount = funknown::release(self.factory_ptr as *mut _);
                log::debug!(
                    "[LoadedPlugin::drop]   factory released → refcount={}",
                    refcount
                );
            }
            self.factory_ptr = 0;
        }

        // ── 3. FreeLibrary del DLL ────────────────────────
        // AHORA es seguro liberar el DLL porque no queda nadie
        // apuntando a memoria dentro de él.
        if self.hmodule != 0 {
            unsafe {
                let hmod = HMODULE(self.hmodule as *mut _);
                let _ = FreeLibrary(hmod);
                log::debug!("[LoadedPlugin::drop]   DLL 0x{:x} freed", self.hmodule);
            }
            self.hmodule = 0;
        }
    }
}

// SAFETY: los HMODULE y punteros COM se pueden mover entre threads
// siempre que serialicemos el acceso. El Mutex del registry se
// encarga de eso. Solo tocamos estos campos con lock del registry.
#[cfg(target_os = "windows")]
unsafe impl Send for LoadedPlugin {}

// ═══════════════════════════════════════════════════════════════
// 🎯 REGISTRY GLOBAL
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

    // ───────────────────────────────────────────────────────────
    // 🎯 OPERACIONES (Windows)
    // ───────────────────────────────────────────────────────────

    /// Registra un plugin ya cargado.
    /// Si la key ya existía, el LoadedPlugin anterior se drop
    /// automáticamente (libera sus instancias + factory + DLL).
    #[cfg(target_os = "windows")]
    pub fn insert(&self, key: PluginKey, plugin: LoadedPlugin) -> Option<LoadedPlugin> {
        let mut map = self.plugins.lock().expect("Vst3Registry mutex poisoned");
        map.insert(key, plugin)
    }

    /// Devuelve true si hay un plugin cargado con esa key.
    #[cfg(target_os = "windows")]
    pub fn contains(&self, key: &str) -> bool {
        let map = self.plugins.lock().expect("Vst3Registry mutex poisoned");
        map.contains_key(key)
    }

    /// Extrae un plugin del registry.
    /// El caller recibe ownership — cuando se drop, libera todo.
    #[cfg(target_os = "windows")]
    pub fn take(&self, key: &str) -> Option<LoadedPlugin> {
        let mut map = self.plugins.lock().expect("Vst3Registry mutex poisoned");
        map.remove(key)
    }

    /// Lista las keys de todos los plugins cargados.
    #[cfg(target_os = "windows")]
    pub fn list_keys(&self) -> Vec<PluginKey> {
        let map = self.plugins.lock().expect("Vst3Registry mutex poisoned");
        map.keys().cloned().collect()
    }

    /// Número de plugins cargados.
    #[cfg(target_os = "windows")]
    pub fn len(&self) -> usize {
        let map = self.plugins.lock().expect("Vst3Registry mutex poisoned");
        map.len()
    }

    /// Ejecuta una operación con acceso mutable al plugin identificado
    /// por `key`. Devuelve `None` si no existe.
    ///
    /// Diseño: en vez de exponer el Mutex al exterior, ofrecemos este
    /// helper que hace lock + lookup + ejecución de closure en un
    /// solo lugar. Evita deadlocks accidentales.
    #[cfg(target_os = "windows")]
    pub fn with_plugin_mut<F, R>(&self, key: &str, f: F) -> Option<R>
    where
        F: FnOnce(&mut LoadedPlugin) -> R,
    {
        let mut map = self.plugins.lock().expect("Vst3Registry mutex poisoned");
        map.get_mut(key).map(f)
    }

    /// Igual que `with_plugin_mut` pero solo lectura.
    #[cfg(target_os = "windows")]
    pub fn with_plugin<F, R>(&self, key: &str, f: F) -> Option<R>
    where
        F: FnOnce(&LoadedPlugin) -> R,
    {
        let map = self.plugins.lock().expect("Vst3Registry mutex poisoned");
        map.get(key).map(f)
    }

    // ───────────────────────────────────────────────────────────
    // 🎯 STUBS (no-Windows)
    // ───────────────────────────────────────────────────────────

    #[cfg(not(target_os = "windows"))]
    #[allow(dead_code)]
    pub fn list_keys(&self) -> Vec<PluginKey> { Vec::new() }

    #[cfg(not(target_os = "windows"))]
    #[allow(dead_code)]
    pub fn len(&self) -> usize { 0 }
}

impl Default for Vst3Registry {
    fn default() -> Self { Self::new() }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

/// Genera una key única para un bundle path.
pub fn make_plugin_key(bundle_path: &str) -> PluginKey {
    bundle_path.to_string()
}

/// Genera un instance_id opaco (nanoid corto).
/// No usamos crate externo — bastan 8 bytes hex random.
#[cfg(target_os = "windows")]
pub fn make_instance_id() -> InstanceId {
    use std::time::{SystemTime, UNIX_EPOCH};

    // Combinamos timestamp + puntero de la stack para pseudo-uniqueness.
    // No necesitamos crypto-random — solo evitar colisiones dentro de
    // la misma sesión de la app.
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
        // "inst_" + 16 hex chars = 21 chars
        assert_eq!(id.len(), 21);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn two_instance_ids_are_different() {
        let id1 = make_instance_id();
        let id2 = make_instance_id();
        // Muy raro que colisionen (timestamp diferente en nanos)
        assert_ne!(id1, id2);
    }

    // ── Tests de LoadedPlugin usando punteros fake ────────────
    //
    // Estos tests usan factory_ptr=0 y hmodule=0 para que el Drop
    // no intente ejecutar código real. Solo validamos el ciclo del
    // registry sin tocar COM.

    #[cfg(target_os = "windows")]
    #[test]
    fn insert_and_take_work_with_null_ptrs() {
        let reg = Vst3Registry::new();
        let key = make_plugin_key("C:\\test\\fake.vst3");

        // hmodule=0 y factory_ptr=0 → Drop es no-op (checks internos)
        let plugin = LoadedPlugin::new(
            PathBuf::from("C:\\test\\fake.vst3"),
            PathBuf::from("C:\\test\\fake.vst3"),
            0, // hmodule
            0, // factory_ptr
        );

        assert_eq!(reg.len(), 0);
        assert!(reg.insert(key.clone(), plugin).is_none());
        assert_eq!(reg.len(), 1);
        assert!(reg.contains(&key));

        let taken = reg.take(&key);
        assert!(taken.is_some());
        assert_eq!(reg.len(), 0);
        // taken se drop aquí — Drop es no-op porque ptrs son 0
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

        // Añadir una instancia fake (component_ptr=0 → Drop no-op)
        let result = reg.with_plugin_mut(&key, |p| {
            let inst_id = "inst_test".to_string();
            p.instances.insert(inst_id.clone(), ComponentInstance {
                component_ptr: 0,
                class_cid: "FAKE".to_string(),
            });
            p.instances.len()
        });
        assert_eq!(result, Some(1));

        // Leer las instancias
        let count = reg.with_plugin(&key, |p| p.instances.len());
        assert_eq!(count, Some(1));

        // Cleanup: quitar del registry para que Drop no toque nada real
        reg.take(&key);
    }
}