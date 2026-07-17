// src-tauri/src/vst3_host.rs
//
// VST3 Host Bridge
//
// ── ESTADO ACTUAL (Sub-paso 2.5.c) ──
// ✅ Resolver DLL real dentro del bundle .vst3
// ✅ LoadLibraryW del DLL
// ✅ GetPluginFactory() → puntero
// ✅ Layout COM en vst3_com/
// ✅ probe (efímero) + load/unload (persistente)
// ✅ Drop de LoadedPlugin libera todo en orden correcto
// ✅ createInstance vía COM vtable
// ✅ Registro de instancias en LoadedPlugin.instances
// ✅ Comandos: vst3_create_instance / release / list
// ✅ ComponentInstance::teardown() ordenado             ← 2.5.b
// ✅ InstanceInfo expone initialized + plugin_base_ptr ← 2.5.b
// ✅ Comandos initialize / terminate con DawnHost       ← 2.5.c
// ⬜ Ventana nativa del plugin (HWND)                   [Fase 3]

use std::path::{Path, PathBuf};
use tauri::State;

use crate::vst3_registry::{
    make_instance_id, make_plugin_key,
    ComponentInstance, InstanceId, InstanceInfo,
    LoadedPlugin, PluginKey, Vst3Registry,
};

#[cfg(target_os = "windows")]
use crate::vst3_com::ifactory::{self, IPluginFactory, PClassInfo};

#[cfg(target_os = "windows")]
use crate::vst3_com::icomponent::IID_ICOMPONENT;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS PÚBLICOS (serializables al frontend)
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, serde::Serialize)]
pub struct Vst3ClassInfo {
    pub cid: String,
    pub cardinality: i32,
    pub category: String,
    pub name: String,
}

#[derive(Debug, serde::Serialize)]
pub struct ProbeResult {
    pub success: bool,
    pub message: String,
    pub bundle_path: String,
    pub dll_path: Option<String>,
    pub dll_handle: Option<String>,
    pub factory_ptr: Option<String>,
    pub classes: Vec<Vst3ClassInfo>,
}

#[derive(Debug, serde::Serialize)]
pub struct LoadResult {
    pub success: bool,
    pub message: String,
    pub bundle_path: String,
    pub dll_path: Option<String>,
    pub plugin_key: Option<PluginKey>,
    pub factory_ptr: Option<String>,
    pub classes: Vec<Vst3ClassInfo>,
}

/// Resultado de vst3_create_instance (Paso 2.3).
#[derive(Debug, serde::Serialize)]
pub struct CreateInstanceResult {
    pub success: bool,
    pub message: String,
    /// ID para operaciones futuras (initialize, release, etc). Null si falló.
    pub instance_id: Option<InstanceId>,
    /// Puntero al IComponent (hex, para debug). Null si falló.
    pub component_ptr: Option<String>,
    /// CID de la clase instanciada
    pub class_cid: String,
}

/// Resultado de vst3_initialize_instance (Sub-paso 2.5.c).
#[derive(Debug, serde::Serialize)]
pub struct InitializeResult {
    pub success: bool,
    pub message: String,
    /// HRESULT del initialize() del plugin (0 = S_OK)
    pub hresult: i32,
    /// Puntero al IPluginBase obtenido via queryInterface (hex).
    /// Null si initialize falló.
    pub plugin_base_ptr: Option<String>,
    /// Puntero al DawnHost que le pasamos (hex, para debug)
    pub host_context_ptr: Option<String>,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS — resolver el DLL real dentro del bundle
// ═══════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
const DLL_SEARCH_PATHS: &[&str] = &["Contents/x86_64-win", "Contents/x86-win"];

#[cfg(target_os = "macos")]
const DLL_SEARCH_PATHS: &[&str] = &["Contents/MacOS"];

#[cfg(target_os = "linux")]
const DLL_SEARCH_PATHS: &[&str] = &["Contents/x86_64-linux"];

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
const DLL_SEARCH_PATHS: &[&str] = &[];

fn resolve_dll_path(bundle: &Path) -> Option<PathBuf> {
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
                    && path.extension().and_then(|s| s.to_str())
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

// ═══════════════════════════════════════════════════════════════
// 🎯 LOW-LEVEL — cargar DLL y obtener factory (Windows)
// ═══════════════════════════════════════════════════════════════

type GetPluginFactoryFn = unsafe extern "C" fn() -> *mut core::ffi::c_void;

#[cfg(target_os = "windows")]
struct LoadedFactory {
    hmodule:     usize,
    factory_ptr: usize,
    classes:     Vec<Vst3ClassInfo>,
}

/// Carga el DLL, obtiene el factory, itera clases.
/// El HMODULE NO se libera — el caller es responsable.
#[cfg(target_os = "windows")]
fn load_factory(dll_path: &Path) -> Result<LoadedFactory, String> {
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
        return Err("LoadLibraryW devolvió handle inválido".to_string());
    }

    let handle_ptr = hmodule.0 as usize;

    let symbol_name = b"GetPluginFactory\0";
    let proc_addr = unsafe { GetProcAddress(hmodule, PCSTR(symbol_name.as_ptr())) };

    let proc_addr = match proc_addr {
        Some(addr) => addr,
        None => {
            unsafe { let _ = FreeLibrary(hmodule); }
            return Err(
                "Símbolo 'GetPluginFactory' no encontrado. ¿Es un VST3 válido?".to_string()
            );
        }
    };

    let get_factory: GetPluginFactoryFn = unsafe { std::mem::transmute(proc_addr) };
    let factory_raw = unsafe { get_factory() };

    if factory_raw.is_null() {
        unsafe { let _ = FreeLibrary(hmodule); }
        return Err("GetPluginFactory() devolvió NULL".to_string());
    }

    let factory_addr = factory_raw as usize;
    let classes = unsafe { iterate_factory_classes(factory_raw) };

    Ok(LoadedFactory {
        hmodule:     handle_ptr,
        factory_ptr: factory_addr,
        classes,
    })
}

/// Libera un HMODULE sin pasar por LoadedPlugin.
/// Solo se usa en probe (efímero) y cuando load_factory falla mid-way.
#[cfg(target_os = "windows")]
fn free_hmodule(hmodule: usize) {
    use windows::Win32::Foundation::{FreeLibrary, HMODULE};
    if hmodule == 0 {
        return;
    }
    unsafe {
        let hmod = HMODULE(hmodule as *mut _);
        let _ = FreeLibrary(hmod);
    }
}

#[cfg(target_os = "windows")]
unsafe fn iterate_factory_classes(
    factory_raw: *mut core::ffi::c_void,
) -> Vec<Vst3ClassInfo> {
    let mut classes = Vec::new();
    let factory = factory_raw as *mut IPluginFactory;

    let vtable = (*factory).vtable;
    if vtable.is_null() {
        log::error!("[vst3_host] vtable es NULL — plugin corrupto");
        return classes;
    }

    let count = ((*vtable).count_classes)(factory_raw);
    log::info!("[vst3_host] Factory tiene {} clase(s)", count);

    if count <= 0 || count > 128 {
        log::warn!("[vst3_host] count_classes devolvió {} — saltando", count);
        return classes;
    }

    for i in 0..count {
        let mut info = PClassInfo::zeroed();
        let hr = ((*vtable).get_class_info)(factory_raw, i, &mut info as *mut PClassInfo);

        if hr != 0 {
            log::warn!(
                "[vst3_host] getClassInfo({}) devolvió HRESULT=0x{:08X}",
                i, hr as u32
            );
            continue;
        }

        let class = Vst3ClassInfo {
            cid:         info.cid_str(),
            cardinality: info.cardinality,
            category:    info.category_str(),
            name:        info.name_str(),
        };

        log::info!(
            "[vst3_host]   clase[{}]: {:?} / {:?} / CID={}",
            i, class.category, class.name, class.cid
        );

        classes.push(class);
    }

    classes
}

// ═══════════════════════════════════════════════════════════════
// 🎯 PROBE (Fase 1.5)
// ═══════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
fn probe_vst3(dll_path: &Path) -> Result<(usize, usize, Vec<Vst3ClassInfo>), String> {
    let loaded = load_factory(dll_path)?;
    // Probe: liberamos DLL sin persistir. En probe NO hay que hacer
    // release del factory porque el DLL se va con todo dentro.
    free_hmodule(loaded.hmodule);
    Ok((loaded.hmodule, loaded.factory_ptr, loaded.classes))
}

#[cfg(not(target_os = "windows"))]
fn probe_vst3(_dll_path: &Path) -> Result<(usize, usize, Vec<Vst3ClassInfo>), String> {
    Err("Probe VST3 solo implementado en Windows por ahora".to_string())
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO — vst3_probe_plugin
// ═══════════════════════════════════════════════════════════════

#[tauri::command]
pub fn vst3_probe_plugin(bundle_path: String) -> ProbeResult {
    log::info!("[vst3_host] Probe iniciado: {}", bundle_path);

    let bundle = Path::new(&bundle_path);

    if !bundle.exists() {
        return ProbeResult {
            success: false,
            message: format!("Bundle no existe: {}", bundle_path),
            bundle_path, dll_path: None, dll_handle: None,
            factory_ptr: None, classes: vec![],
        };
    }

    let dll_path = match resolve_dll_path(bundle) {
        Some(p) => p,
        None => return ProbeResult {
            success: false,
            message: format!("No se encontró .vst3. Buscado en: {:?}", DLL_SEARCH_PATHS),
            bundle_path, dll_path: None, dll_handle: None,
            factory_ptr: None, classes: vec![],
        },
    };

    let dll_path_str = dll_path.to_string_lossy().to_string();

    match probe_vst3(&dll_path) {
        Ok((handle, factory, classes)) => ProbeResult {
            success:     true,
            message:     format!("OK — {} clase(s) encontrada(s)", classes.len()),
            bundle_path,
            dll_path:    Some(dll_path_str),
            dll_handle:  Some(format!("0x{:016x}", handle)),
            factory_ptr: Some(format!("0x{:016x}", factory)),
            classes,
        },
        Err(e) => {
            log::error!("[vst3_host] ❌ {}", e);
            ProbeResult {
                success: false, message: format!("Error: {}", e),
                bundle_path, dll_path: Some(dll_path_str),
                dll_handle: None, factory_ptr: None, classes: vec![],
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO — vst3_load_plugin
// ═══════════════════════════════════════════════════════════════

#[tauri::command]
pub fn vst3_load_plugin(
    bundle_path: String,
    registry: State<'_, Vst3Registry>,
) -> LoadResult {
    log::info!("[vst3_host] Load iniciado: {}", bundle_path);

    let bundle = Path::new(&bundle_path);

    if !bundle.exists() {
        return LoadResult {
            success: false, message: format!("Bundle no existe: {}", bundle_path),
            bundle_path, dll_path: None, plugin_key: None,
            factory_ptr: None, classes: vec![],
        };
    }

    let dll_path = match resolve_dll_path(bundle) {
        Some(p) => p,
        None => return LoadResult {
            success: false,
            message: format!("No se encontró .vst3. Buscado en: {:?}", DLL_SEARCH_PATHS),
            bundle_path, dll_path: None, plugin_key: None,
            factory_ptr: None, classes: vec![],
        },
    };

    let dll_path_str = dll_path.to_string_lossy().to_string();
    let plugin_key   = make_plugin_key(&bundle_path);

    #[cfg(target_os = "windows")]
    {
        if registry.contains(&plugin_key) {
            log::info!("[vst3_host] Plugin ya cargado: {}", plugin_key);
            return LoadResult {
                success: true, message: "Plugin ya estaba cargado".to_string(),
                bundle_path, dll_path: Some(dll_path_str),
                plugin_key: Some(plugin_key), factory_ptr: None, classes: vec![],
            };
        }

        match load_factory(&dll_path) {
            Ok(loaded) => {
                let factory_hex = format!("0x{:016x}", loaded.factory_ptr);
                let classes     = loaded.classes.clone();

                let plugin = LoadedPlugin::new(
                    PathBuf::from(&bundle_path),
                    dll_path.clone(),
                    loaded.hmodule,
                    loaded.factory_ptr,
                );

                // Al insertar, si había uno viejo Rust lo drop
                // automáticamente (Drop libera instancias + factory + DLL).
                registry.insert(plugin_key.clone(), plugin);

                log::info!(
                    "[vst3_host] ✅ Load OK: {} ({} clases, registry size={})",
                    dll_path.file_name().unwrap_or_default().to_string_lossy(),
                    classes.len(),
                    registry.len(),
                );

                LoadResult {
                    success: true,
                    message: format!("Plugin cargado — {} clase(s)", classes.len()),
                    bundle_path,
                    dll_path: Some(dll_path_str),
                    plugin_key: Some(plugin_key),
                    factory_ptr: Some(factory_hex),
                    classes,
                }
            }
            Err(e) => {
                log::error!("[vst3_host] ❌ Load falló: {}", e);
                LoadResult {
                    success: false, message: format!("Error: {}", e),
                    bundle_path, dll_path: Some(dll_path_str),
                    plugin_key: None, factory_ptr: None, classes: vec![],
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = registry;
        LoadResult {
            success: false,
            message: "Load VST3 solo implementado en Windows por ahora".to_string(),
            bundle_path, dll_path: Some(dll_path_str),
            plugin_key: None, factory_ptr: None, classes: vec![],
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO — vst3_unload_plugin
// ═══════════════════════════════════════════════════════════════

/// Descarga un plugin del registry.
///
/// Cuando `take()` devuelve el LoadedPlugin y sale del scope, su
/// Drop se ejecuta automáticamente y libera:
///   1. Todas las instancias (teardown ordenado)
///   2. El factory (release COM)
///   3. El DLL (FreeLibrary)
#[tauri::command]
pub fn vst3_unload_plugin(
    plugin_key: String,
    registry: State<'_, Vst3Registry>,
) -> bool {
    log::info!("[vst3_host] Unload: {}", plugin_key);

    #[cfg(target_os = "windows")]
    {
        match registry.take(&plugin_key) {
            Some(plugin) => {
                let n_instances = plugin.instances.len();
                // El drop de `plugin` se ejecuta aquí al final del scope
                drop(plugin);
                log::info!(
                    "[vst3_host] ✅ Unload OK ({} instances liberadas) — registry size={}",
                    n_instances,
                    registry.len()
                );
                true
            }
            None => {
                log::warn!("[vst3_host] Unload: key no encontrada: {}", plugin_key);
                false
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, registry);
        false
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO — vst3_list_loaded
// ═══════════════════════════════════════════════════════════════

#[tauri::command]
pub fn vst3_list_loaded(registry: State<'_, Vst3Registry>) -> Vec<String> {
    let keys = registry.list_keys();
    log::debug!("[vst3_host] list_loaded: {} plugin(s)", keys.len());
    keys
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO — vst3_create_instance (Paso 2.3)
// ═══════════════════════════════════════════════════════════════

/// Instancia una clase del plugin como IComponent.
///
/// `class_cid` es el CID (32 chars hex) de una clase del factory —
/// típicamente una con category = "Audio Module Class". El frontend
/// lo obtiene de `LoadResult.classes[N].cid`.
///
/// La instancia queda REGISTRADA en el plugin con estado
/// `initialized=false`. Para "arrancarla" hay que llamar
/// `vst3_initialize_instance` (Sub-paso 2.5.c).
///
/// El unload del plugin libera automáticamente todas las instancias.
/// También se puede liberar manualmente con `vst3_release_instance`.
#[tauri::command]
pub fn vst3_create_instance(
    plugin_key: String,
    class_cid:  String,
    registry:   State<'_, Vst3Registry>,
) -> CreateInstanceResult {
    log::info!(
        "[vst3_host] create_instance: plugin={} cid={}",
        plugin_key, class_cid
    );

    #[cfg(target_os = "windows")]
    {
        // ── 1. Parsear el CID (32 hex chars → 16 bytes) ─────
        let cid_bytes = match parse_cid(&class_cid) {
            Some(b) => b,
            None => return CreateInstanceResult {
                success: false,
                message: format!("CID inválido: {} (debe ser 32 hex chars)", class_cid),
                instance_id: None, component_ptr: None, class_cid,
            },
        };

        // ── 2. Buscar el plugin + factory_ptr ───────────────
        let factory_ptr = match registry.with_plugin(&plugin_key, |p| p.factory_ptr) {
            Some(ptr) => ptr,
            None => return CreateInstanceResult {
                success: false,
                message: format!("Plugin no cargado: {}", plugin_key),
                instance_id: None, component_ptr: None, class_cid,
            },
        };

        if factory_ptr == 0 {
            return CreateInstanceResult {
                success: false,
                message: "factory_ptr es NULL".to_string(),
                instance_id: None, component_ptr: None, class_cid,
            };
        }

        // ── 3. Llamar createInstance() ──────────────────────
        //
        // SAFETY: factory_ptr es válido mientras el plugin esté en
        // el registry. cid_bytes es una copia local. IID_ICOMPONENT
        // es una constante estática.
        let component_ptr = unsafe {
            match ifactory::create_instance(
                factory_ptr as *mut _,
                &cid_bytes,
                &IID_ICOMPONENT,
            ) {
                Ok(ptr) => ptr,
                Err(hr) => {
                    log::error!(
                        "[vst3_host] createInstance falló: HRESULT=0x{:08X}",
                        hr as u32
                    );
                    return CreateInstanceResult {
                        success: false,
                        message: format!(
                            "createInstance falló: HRESULT=0x{:08X}. \
                             ¿La clase soporta IComponent?", hr as u32
                        ),
                        instance_id: None, component_ptr: None, class_cid,
                    };
                }
            }
        };

        let component_addr = component_ptr as usize;
        let component_hex  = format!("0x{:016x}", component_addr);

        // ── 4. Registrar la instancia en el plugin ──────────
        // ← 2.5.b: usa ComponentInstance::new() que inicializa
        //   initialized=false y plugin_base_ptr=0 correctamente.
        let instance_id = make_instance_id();

        let register_result = registry.with_plugin_mut(&plugin_key, |p| {
            p.instances.insert(
                instance_id.clone(),
                ComponentInstance::new(component_addr, class_cid.clone()),
            );
            p.instances.len()
        });

        // Si el registry ya no tiene el plugin (unload en paralelo),
        // release el componente huérfano para no leak.
        if register_result.is_none() {
            unsafe {
                use crate::vst3_com::funknown;
                funknown::release(component_ptr);
            }
            return CreateInstanceResult {
                success: false,
                message: "Plugin desaparecido durante createInstance".to_string(),
                instance_id: None, component_ptr: None, class_cid,
            };
        }

        log::info!(
            "[vst3_host] ✅ Instance creada: {} → ptr={}, total instances={}",
            instance_id, component_hex, register_result.unwrap()
        );

        CreateInstanceResult {
            success: true,
            message: "Instancia creada (no inicializada aún)".to_string(),
            instance_id:   Some(instance_id),
            component_ptr: Some(component_hex),
            class_cid,
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, registry);
        CreateInstanceResult {
            success: false,
            message: "createInstance solo implementado en Windows".to_string(),
            instance_id: None, component_ptr: None, class_cid,
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO — vst3_release_instance (Paso 2.3, actualizado 2.5.b)
// ═══════════════════════════════════════════════════════════════

/// Libera una instancia específica del plugin.
///
/// ← 2.5.b: usa `ComponentInstance::teardown()` que hace el ciclo
/// completo en orden correcto:
///   1. Si initialized: llamar terminate()
///   2. Si plugin_base_ptr != 0: release()
///   3. release() del component_ptr
#[tauri::command]
pub fn vst3_release_instance(
    plugin_key:  String,
    instance_id: String,
    registry:    State<'_, Vst3Registry>,
) -> bool {
    log::info!(
        "[vst3_host] release_instance: plugin={} inst={}",
        plugin_key, instance_id
    );

    #[cfg(target_os = "windows")]
    {
        let removed = registry.with_plugin_mut(&plugin_key, |p| {
            p.instances.remove(&instance_id)
        }).flatten();

        match removed {
            Some(mut inst) => {
                unsafe { inst.teardown(); }
                log::info!("[vst3_host] ✅ Instance liberada (teardown completo)");
                true
            }
            None => {
                log::warn!("[vst3_host] release: instancia no encontrada");
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
// 🎯 COMANDO — vst3_list_instances (Paso 2.3, actualizado 2.5.b)
// ═══════════════════════════════════════════════════════════════

/// Lista las instancias vivas de un plugin.
///
/// ← 2.5.b: usa `ComponentInstance::to_info()` que incluye
/// initialized + plugin_base_ptr en el output.
#[tauri::command]
pub fn vst3_list_instances(
    plugin_key: String,
    registry:   State<'_, Vst3Registry>,
) -> Vec<InstanceInfo> {
    #[cfg(target_os = "windows")]
    {
        registry.with_plugin(&plugin_key, |p| {
            p.instances
                .iter()
                .map(|(id, inst)| inst.to_info(id))
                .collect()
        }).unwrap_or_default()
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, registry);
        Vec::new()
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO — vst3_initialize_instance (Sub-paso 2.5.c)
// ═══════════════════════════════════════════════════════════════

/// Inicializa una instancia previamente creada.
///
/// Secuencia:
///   1. Verifica que la instancia existe y NO está ya inicializada
///   2. queryInterface(component, IID_IPLUGIN_BASE) → plugin_base
///   3. Obtiene DawnHost singleton (host context)
///   4. plugin_base->initialize(dawn_host)
///   5. Si S_OK: guarda plugin_base_ptr + marca initialized=true
///   6. Si error: release(plugin_base), no marca initialized
///
/// ⚠️ Este comando invoca CÓDIGO DEL PLUGIN. Un plugin bugueado
/// puede crashear la app. Rust no puede atrapar SEH exceptions
/// sin overhead significativo.
#[tauri::command]
pub fn vst3_initialize_instance(
    plugin_key:  String,
    instance_id: String,
    registry:    State<'_, Vst3Registry>,
) -> InitializeResult {
    log::info!(
        "[vst3_host] initialize_instance: plugin={} inst={}",
        plugin_key, instance_id
    );

    #[cfg(target_os = "windows")]
    {
        use crate::vst3_com::{funknown, iplugin_base};
        use crate::vst3_com::iplugin_base::IID_IPLUGIN_BASE;
        use crate::vst3_host_context::DawnHost;

        // ── 1. Verificar estado actual + obtener component_ptr ────
        let component_ptr = match registry.with_plugin(&plugin_key, |p| {
            p.instances.get(&instance_id).map(|inst| {
                (inst.component_ptr, inst.initialized)
            })
        }).flatten() {
            Some((ptr, already_init)) => {
                if already_init {
                    log::warn!("[vst3_host] initialize: ya estaba inicializada");
                    return InitializeResult {
                        success: false,
                        message: "La instancia ya está inicializada".to_string(),
                        hresult: 0,
                        plugin_base_ptr: None,
                        host_context_ptr: None,
                    };
                }
                if ptr == 0 {
                    return InitializeResult {
                        success: false,
                        message: "component_ptr es NULL".to_string(),
                        hresult: -1,
                        plugin_base_ptr: None,
                        host_context_ptr: None,
                    };
                }
                ptr
            }
            None => {
                return InitializeResult {
                    success: false,
                    message: format!(
                        "Instancia no encontrada: plugin={} inst={}",
                        plugin_key, instance_id
                    ),
                    hresult: -1,
                    plugin_base_ptr: None,
                    host_context_ptr: None,
                };
            }
        };

        // ── 2. queryInterface(IID_IPLUGIN_BASE) ──────────────────
        //
        // Le pedimos al componente su "cara" IPluginBase. Esto ya
        // invoca código del plugin (queryInterface está en su vtable).
        // Si el plugin es sano, retorna un puntero con addRef hecho.
        let plugin_base_ptr = unsafe {
            match funknown::query_interface(component_ptr as *mut _, &IID_IPLUGIN_BASE) {
                Ok(ptr) => ptr,
                Err(hr) => {
                    log::error!(
                        "[vst3_host] queryInterface(IPluginBase) falló: HRESULT=0x{:08X}",
                        hr as u32
                    );
                    return InitializeResult {
                        success: false,
                        message: format!(
                            "El componente no expone IPluginBase (HRESULT=0x{:08X}). \
                             Plugin bugueado o incompatible.", hr as u32
                        ),
                        hresult: hr,
                        plugin_base_ptr: None,
                        host_context_ptr: None,
                    };
                }
            }
        };

        let plugin_base_addr = plugin_base_ptr as usize;
        log::info!(
            "[vst3_host]   IPluginBase obtenido: 0x{:016x}",
            plugin_base_addr
        );

        // ── 3. Obtener DawnHost singleton ────────────────────────
        let host_ptr = DawnHost::get_singleton_ptr();
        let host_addr = host_ptr as usize;
        log::info!("[vst3_host]   DawnHost host_context: 0x{:016x}", host_addr);

        // ── 4. INITIALIZE — el momento crítico ───────────────────
        //
        // Aquí el plugin ejecuta código propio y puede llamar
        // métodos de nuestro DawnHost (getName, createInstance...).
        // Si crashea aquí, es en el plugin — no en nuestro código.
        log::info!("[vst3_host]   → llamando initialize()...");
        let hr = unsafe {
            iplugin_base::initialize(plugin_base_ptr, host_ptr)
        };
        log::info!(
            "[vst3_host]   ← initialize() retornó HRESULT=0x{:08X}",
            hr as u32
        );

        // ── 5. Manejar resultado ─────────────────────────────────
        if hr != 0 {
            // Failure: release el plugin_base_ptr (nos hicieron addRef en QI)
            log::error!(
                "[vst3_host] initialize() falló con HRESULT=0x{:08X} — releasing IPluginBase",
                hr as u32
            );
            unsafe {
                funknown::release(plugin_base_ptr);
            }
            return InitializeResult {
                success: false,
                message: format!(
                    "initialize() retornó HRESULT=0x{:08X}. \
                     El plugin rechazó la inicialización.", hr as u32
                ),
                hresult: hr,
                plugin_base_ptr: None,
                host_context_ptr: Some(format!("0x{:016x}", host_addr)),
            };
        }

        // ── 6. Success: guardar plugin_base_ptr + marcar initialized ─
        let stored = registry.with_plugin_mut(&plugin_key, |p| {
            if let Some(inst) = p.instances.get_mut(&instance_id) {
                inst.plugin_base_ptr = plugin_base_addr;
                inst.initialized = true;
                true
            } else {
                false
            }
        }).unwrap_or(false);

        if !stored {
            // Race condition: la instancia desapareció durante initialize.
            // Debemos hacer teardown manual del plugin_base para no leak.
            log::warn!("[vst3_host] Instancia desaparecida durante initialize — teardown manual");
            unsafe {
                let hr_term = iplugin_base::terminate(plugin_base_ptr);
                log::debug!("[vst3_host]   terminate() → HRESULT=0x{:08X}", hr_term as u32);
                funknown::release(plugin_base_ptr);
            }
            return InitializeResult {
                success: false,
                message: "Instancia desapareció durante initialize".to_string(),
                hresult: 0,
                plugin_base_ptr: None,
                host_context_ptr: Some(format!("0x{:016x}", host_addr)),
            };
        }

        log::info!(
            "[vst3_host] ✅ Instance inicializada: {} → plugin_base=0x{:016x}",
            instance_id, plugin_base_addr
        );

        InitializeResult {
            success: true,
            message: "Instancia inicializada correctamente".to_string(),
            hresult: 0,
            plugin_base_ptr:  Some(format!("0x{:016x}", plugin_base_addr)),
            host_context_ptr: Some(format!("0x{:016x}", host_addr)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, instance_id, registry);
        InitializeResult {
            success: false,
            message: "initialize solo implementado en Windows".to_string(),
            hresult: -1,
            plugin_base_ptr: None,
            host_context_ptr: None,
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO — vst3_terminate_instance (Sub-paso 2.5.c)
// ═══════════════════════════════════════════════════════════════

/// Termina una instancia previamente inicializada.
///
/// Es el simétrico de `initialize`:
///   1. Verifica que la instancia existe y ESTÁ inicializada
///   2. Llama plugin_base->terminate()
///   3. release(plugin_base)
///   4. Marca initialized=false, plugin_base_ptr=0
///
/// Después de esto, la instancia sigue viva (component_ptr no cambia)
/// pero en estado "no inicializada". Se puede volver a `initialize`
/// o `release` completamente.
#[tauri::command]
pub fn vst3_terminate_instance(
    plugin_key:  String,
    instance_id: String,
    registry:    State<'_, Vst3Registry>,
) -> bool {
    log::info!(
        "[vst3_host] terminate_instance: plugin={} inst={}",
        plugin_key, instance_id
    );

    #[cfg(target_os = "windows")]
    {
        use crate::vst3_com::{funknown, iplugin_base};

        // Extraer plugin_base_ptr y marcar como no inicializada atómicamente
        let plugin_base_ptr = registry.with_plugin_mut(&plugin_key, |p| {
            let inst = p.instances.get_mut(&instance_id)?;
            if !inst.initialized || inst.plugin_base_ptr == 0 {
                return None;
            }
            let ptr = inst.plugin_base_ptr;
            inst.plugin_base_ptr = 0;
            inst.initialized = false;
            Some(ptr)
        }).flatten();

        match plugin_base_ptr {
            Some(ptr) => {
                unsafe {
                    let hr = iplugin_base::terminate(ptr as *mut _);
                    log::info!("[vst3_host]   terminate() → HRESULT=0x{:08X}", hr as u32);
                    let refcount = funknown::release(ptr as *mut _);
                    log::info!("[vst3_host]   IPluginBase released → refcount={}", refcount);
                }
                log::info!("[vst3_host] ✅ Instance terminada");
                true
            }
            None => {
                log::warn!(
                    "[vst3_host] terminate: instancia no encontrada o no inicializada"
                );
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
// 🎯 HELPER — parsear CID de hex string a [u8; 16]
// ═══════════════════════════════════════════════════════════════

/// Convierte un CID en formato hex (32 chars, uppercase o lowercase)
/// a los 16 bytes que espera la API COM.
///
/// El CID viene del frontend igual que lo generó `PClassInfo::cid_str()`:
/// bytes en orden, cada uno como 2 hex chars uppercase.
///
/// Ejemplo:
///   "01EFCDAB8291EBFA5079467750665374"
///   → [0x01, 0xEF, 0xCD, 0xAB, 0x82, 0x91, 0xEB, 0xFA,
///      0x50, 0x79, 0x46, 0x77, 0x50, 0x66, 0x53, 0x74]
#[cfg(target_os = "windows")]
fn parse_cid(hex: &str) -> Option<[u8; 16]> {
    if hex.len() != 32 {
        return None;
    }

    let mut out = [0u8; 16];
    for i in 0..16 {
        let byte_str = &hex[i * 2..i * 2 + 2];
        out[i] = u8::from_str_radix(byte_str, 16).ok()?;
    }
    Some(out)
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_dll_returns_none_for_missing_bundle() {
        let path = PathBuf::from("C:\\ruta\\que\\no\\existe.vst3");
        assert!(resolve_dll_path(&path).is_none());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn probe_fails_on_non_vst3_dll() {
        let path = PathBuf::from("C:\\Windows\\System32\\kernel32.dll");
        assert!(path.exists());
        let result = probe_vst3(&path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("GetPluginFactory"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn parse_cid_valid() {
        let hex = "01EFCDAB8291EBFA5079467750665374";
        let bytes = parse_cid(hex).unwrap();
        assert_eq!(bytes[0], 0x01);
        assert_eq!(bytes[1], 0xEF);
        assert_eq!(bytes[15], 0x74);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn parse_cid_wrong_length() {
        assert!(parse_cid("01EFCDAB").is_none());
        assert!(parse_cid("").is_none());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn parse_cid_invalid_hex() {
        assert!(parse_cid("ZZEFCDAB8291EBFA5079467750665374").is_none());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn parse_cid_roundtrip_with_pclassinfo() {
        // Verifica que parse_cid es la inversa de PClassInfo::cid_str()
        use crate::vst3_com::ifactory::PClassInfo;

        let mut info = PClassInfo::zeroed();
        for (i, b) in info.cid.iter_mut().enumerate() {
            *b = (i * 17) as u8;
        }
        let hex = info.cid_str();
        let parsed = parse_cid(&hex).unwrap();
        assert_eq!(parsed, info.cid);
    }
}