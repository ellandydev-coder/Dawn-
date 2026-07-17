// src-tauri/src/vst3_host.rs
//
// VST3 Host Bridge
//
// ── ESTADO ACTUAL (Fase 1.5) ──
// ✅ Resolver DLL real dentro del bundle .vst3
// ✅ LoadLibraryW del DLL
// ✅ GetProcAddress("GetPluginFactory")
// ✅ Llamar al factory y obtener puntero
// ✅ Interpretar IPluginFactory via vtable COM
// ✅ countClasses() + getClassInfo(i) → lista de clases
// ⬜ Instanciar el plugin (createInstance)            [Fase 2]
//
// ── SOBRE VST3 / COM ──
// VST3 usa COM al estilo Windows. Un objeto COM es:
//
//   struct IPluginFactory {
//       vtable: *const IPluginFactoryVtable,  // primer campo SIEMPRE
//   }
//
//   struct IPluginFactoryVtable {
//       // IUnknown (heredado)
//       query_interface: fn(*mut IPluginFactory, *const TUID, *mut *mut c_void) -> i32,
//       add_ref:         fn(*mut IPluginFactory) -> u32,
//       release:         fn(*mut IPluginFactory) -> u32,
//       // IPluginFactory
//       get_factory_info: fn(*mut IPluginFactory, *mut PFactoryInfo) -> i32,
//       count_classes:    fn(*mut IPluginFactory) -> i32,
//       get_class_info:   fn(*mut IPluginFactory, i32, *mut PClassInfo) -> i32,
//   }
//
// En Rust no hay herencia de structs, así que definimos la vtable
// con todos los slots en orden. Los índices son FIJOS por el ABI COM.

use std::path::{Path, PathBuf};

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS PÚBLICOS (serializables al frontend)
// ═══════════════════════════════════════════════════════════════

/// Info de una clase individual dentro del plugin factory.
/// Corresponde al PClassInfo del SDK VST3.
#[derive(Debug, Clone, serde::Serialize)]
pub struct Vst3ClassInfo {
    /// Component ID — 16 bytes formateados como hex string
    /// Ej: "12345678901234567890123456789012"
    pub cid: String,
    /// Cardinality (cuántas instancias permite, normalmente 0x7FFFFFFF)
    pub cardinality: i32,
    /// Categoría: "Audio Module Class", "Component Controller Class", etc.
    pub category: String,
    /// Nombre legible del plugin/componente
    pub name: String,
}

/// Resultado completo del probe con iteración de clases.
#[derive(Debug, serde::Serialize)]
pub struct ProbeResult {
    pub success: bool,
    pub message: String,
    pub bundle_path: String,
    pub dll_path: Option<String>,
    pub dll_handle: Option<String>,
    /// Puntero al IPluginFactory (solo para debug — ya no es válido
    /// porque liberamos el DLL al final del probe)
    pub factory_ptr: Option<String>,
    /// Lista de clases encontradas en el factory
    pub classes: Vec<Vst3ClassInfo>,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 LAYOUT COM — IPluginFactory vtable
// ═══════════════════════════════════════════════════════════════
//
// SOLO en Windows compilamos el código COM real.
// En otros OS, stub que devuelve error.

#[cfg(target_os = "windows")]
mod com {
    use std::os::raw::c_void;

    // ── TUID ─────────────────────────────────────────────────
    // VST3 usa TUIDs (128 bits) como identificadores de clase.
    // Equivalente a GUID/IID en COM clásico.
    pub type Tuid = [u8; 16];

    // ── PClassInfo ────────────────────────────────────────────
    // Estructura que el SDK define así en pluginbase.h:
    //
    //   struct PClassInfo {
    //       TUID   cid;            // 16 bytes
    //       int32  cardinality;    // 4 bytes
    //       char   category[32];  // 32 bytes, null-terminated ASCII
    //       char   name[64];      // 64 bytes, null-terminated ASCII
    //   };                        // total: 116 bytes
    //
    // IMPORTANTE: sin padding extra (la alineación natural es correcta).
    // Usamos repr(C) para garantizar que Rust no reordena ni añade padding.
    #[repr(C)]
    pub struct PClassInfo {
        pub cid:         Tuid,        // 16 bytes
        pub cardinality: i32,         // 4 bytes
        pub category:    [u8; 32],   // 32 bytes
        pub name:        [u8; 64],   // 64 bytes
    }

    impl PClassInfo {
        /// Crea una instancia zeroed lista para ser rellenada por el plugin.
        pub fn zeroed() -> Self {
            // SAFETY: todos los campos son tipos primitivos (enteros/bytes),
            // zero es un valor válido para todos ellos.
            unsafe { std::mem::zeroed() }
        }

        /// Convierte el campo `category` de bytes C a String Rust.
        pub fn category_str(&self) -> String {
            let end = self.category.iter().position(|&b| b == 0)
                .unwrap_or(self.category.len());
            String::from_utf8_lossy(&self.category[..end]).to_string()
        }

        /// Convierte el campo `name` de bytes C a String Rust.
        pub fn name_str(&self) -> String {
            let end = self.name.iter().position(|&b| b == 0)
                .unwrap_or(self.name.len());
            String::from_utf8_lossy(&self.name[..end]).to_string()
        }

        /// Formatea el CID como string hex de 32 chars.
        pub fn cid_str(&self) -> String {
            self.cid.iter()
                .map(|b| format!("{:02X}", b))
                .collect()
        }
    }

    // ── Vtable de IPluginFactory ──────────────────────────────
    //
    // El orden de los campos ES el orden de los punteros en la vtable.
    // Índice 0 = primer puntero, índice 5 = sexto puntero.
    //
    // Usamos repr(C) para que Rust los ponga en orden de declaración
    // sin reordenar.
    //
    // Los tipos fn(...) en extern "system" usan la calling convention
    // de Windows (stdcall en 32-bit, equivale a C en 64-bit x86_64).
    // VST3 en Windows usa __stdcall históricamente, pero en x86_64
    // solo hay una calling convention (Microsoft x64 ABI), así que
    // "system" y "C" son equivalentes en 64-bit.
    #[repr(C)]
    pub struct IPluginFactoryVtable {
        // ── IUnknown (slots 0, 1, 2) ─────────────────────────
        pub query_interface: unsafe extern "system" fn(
            this: *mut c_void,
            iid:  *const Tuid,
            obj:  *mut *mut c_void,
        ) -> i32,

        pub add_ref: unsafe extern "system" fn(
            this: *mut c_void,
        ) -> u32,

        pub release: unsafe extern "system" fn(
            this: *mut c_void,
        ) -> u32,

        // ── IPluginFactory (slots 3, 4, 5) ───────────────────
        pub get_factory_info: unsafe extern "system" fn(
            this: *mut c_void,
            info: *mut c_void,   // *mut PFactoryInfo — no la necesitamos ahora
        ) -> i32,

        pub count_classes: unsafe extern "system" fn(
            this: *mut c_void,
        ) -> i32,

        pub get_class_info: unsafe extern "system" fn(
            this:  *mut c_void,
            index: i32,
            info:  *mut PClassInfo,
        ) -> i32,
    }

    // ── El objeto IPluginFactory ──────────────────────────────
    //
    // En COM, el primer campo de cualquier objeto ES el puntero a vtable.
    // Nada más importa para nosotros en esta fase.
    #[repr(C)]
    pub struct IPluginFactory {
        pub vtable: *const IPluginFactoryVtable,
    }
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

// Fallback para tests en plataformas no-Windows
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

// ═══════════════════════════════════════════════════════════════
// 🎯 PROBE PRINCIPAL — carga DLL + itera clases (Windows)
// ═══════════════════════════════════════════════════════════════

type GetPluginFactoryFn = unsafe extern "C" fn() -> *mut core::ffi::c_void;

#[cfg(target_os = "windows")]
fn probe_vst3(dll_path: &Path) -> Result<(usize, usize, Vec<Vst3ClassInfo>), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::FreeLibrary;
    use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};
    use windows::core::PCSTR;

    // ─── 1. Cargar el DLL ─────────────────────────────────────
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

    // ─── 2. Buscar GetPluginFactory ───────────────────────────
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

    // ─── 3. Llamar GetPluginFactory() ─────────────────────────
    //
    // SAFETY: confiamos en que el DLL tiene la firma correcta.
    // Si el plugin está corrupto o es falso, esto puede crashear.
    let get_factory: GetPluginFactoryFn = unsafe { std::mem::transmute(proc_addr) };
    let factory_raw = unsafe { get_factory() };

    if factory_raw.is_null() {
        unsafe { let _ = FreeLibrary(hmodule); }
        return Err("GetPluginFactory() devolvió NULL".to_string());
    }

    let factory_addr = factory_raw as usize;

    // ─── 4. Interpretar como IPluginFactory COM ───────────────
    //
    // SAFETY: factory_raw apunta a un objeto COM cuyo primer campo
    // ES el puntero a vtable. Esto es garantía del ABI COM/VST3.
    // Hacemos cast, no copia — el objeto sigue siendo propiedad del DLL.
    let classes = unsafe {
        iterate_factory_classes(factory_raw)
    };

    // ─── 5. Liberar el DLL ────────────────────────────────────
    //
    // Ya copiamos toda la info que necesitábamos a structs Rust propias.
    // Ahora es seguro liberar.
    unsafe { let _ = FreeLibrary(hmodule); }

    Ok((handle_ptr, factory_addr, classes))
}

// ─── Iteración de clases via vtable ───────────────────────────
//
// Esta función es el corazón de la Fase 1.5.
// Recibe el puntero crudo al IPluginFactory y devuelve
// una lista de Vst3ClassInfo ya deserializada a tipos Rust.
#[cfg(target_os = "windows")]
unsafe fn iterate_factory_classes(
    factory_raw: *mut core::ffi::c_void,
) -> Vec<Vst3ClassInfo> {
    use com::{IPluginFactory, PClassInfo};

    let mut classes = Vec::new();

    // Interpretar el puntero como IPluginFactory COM.
    // SAFETY: el ABI COM garantiza que el primer campo es *vtable.
    let factory = factory_raw as *mut IPluginFactory;

    // Leer el puntero a la vtable.
    // SAFETY: factory no es null (verificado antes de llamar).
    let vtable = (*factory).vtable;
    if vtable.is_null() {
        log::error!("[vst3_host] vtable es NULL — plugin corrupto");
        return classes;
    }

    // ── Llamar countClasses() ─────────────────────────────────
    //
    // vtable[4] según el ABI de IPluginFactory.
    // Devuelve el número de clases registradas en el factory.
    let count = ((*vtable).count_classes)(factory_raw);

    log::info!("[vst3_host] Factory tiene {} clase(s)", count);

    if count <= 0 || count > 128 {
        // Sanity check: más de 128 clases sería muy raro y
        // podría indicar puntero corrupto.
        log::warn!("[vst3_host] count_classes devolvió {} — saltando", count);
        return classes;
    }

    // ── Llamar getClassInfo(i) para cada clase ────────────────
    //
    // vtable[5]. El plugin rellena nuestra PClassInfo struct.
    // Usamos zeroed() para que campos no escritos queden en '\0'.
    for i in 0..count {
        let mut info = PClassInfo::zeroed();

        let hr = ((*vtable).get_class_info)(
            factory_raw,
            i,
            &mut info as *mut PClassInfo,
        );

        // HRESULT: 0 = S_OK, negativo = error
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

#[cfg(not(target_os = "windows"))]
fn probe_vst3(_dll_path: &Path) -> Result<(usize, usize, Vec<Vst3ClassInfo>), String> {
    Err("Probe VST3 solo implementado en Windows por ahora".to_string())
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO TAURI — vst3_probe_plugin
// ═══════════════════════════════════════════════════════════════

#[tauri::command]
pub fn vst3_probe_plugin(bundle_path: String) -> ProbeResult {
    log::info!("[vst3_host] Probe iniciado: {}", bundle_path);

    let bundle = Path::new(&bundle_path);

    if !bundle.exists() {
        return ProbeResult {
            success: false,
            message: format!("Bundle no existe: {}", bundle_path),
            bundle_path,
            dll_path: None,
            dll_handle: None,
            factory_ptr: None,
            classes: vec![],
        };
    }

    let dll_path = match resolve_dll_path(bundle) {
        Some(p) => p,
        None => {
            return ProbeResult {
                success: false,
                message: format!(
                    "No se encontró el binario .vst3 dentro del bundle. Buscado en: {:?}",
                    DLL_SEARCH_PATHS
                ),
                bundle_path,
                dll_path: None,
                dll_handle: None,
                factory_ptr: None,
                classes: vec![],
            };
        }
    };

    let dll_path_str = dll_path.to_string_lossy().to_string();
    log::info!("[vst3_host] DLL resuelto: {}", dll_path_str);

    match probe_vst3(&dll_path) {
        Ok((handle, factory, classes)) => {
            let handle_hex  = format!("0x{:016x}", handle);
            let factory_hex = format!("0x{:016x}", factory);

            log::info!(
                "[vst3_host] ✅ {} → {} clase(s)",
                dll_path.file_name().unwrap_or_default().to_string_lossy(),
                classes.len()
            );

            ProbeResult {
                success:     true,
                message:     format!("OK — {} clase(s) encontrada(s)", classes.len()),
                bundle_path,
                dll_path:    Some(dll_path_str),
                dll_handle:  Some(handle_hex),
                factory_ptr: Some(factory_hex),
                classes,
            }
        }
        Err(e) => {
            log::error!("[vst3_host] ❌ {}", e);
            ProbeResult {
                success:     false,
                message:     format!("Error: {}", e),
                bundle_path,
                dll_path:    Some(dll_path_str),
                dll_handle:  None,
                factory_ptr: None,
                classes:     vec![],
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ── Test 1: bundle inexistente ────────────────────────────
    #[test]
    fn resolve_dll_returns_none_for_missing_bundle() {
        let path = PathBuf::from("C:\\ruta\\que\\no\\existe.vst3");
        let result = resolve_dll_path(&path);
        assert!(result.is_none());
    }

    // ── Test 2: kernel32.dll no es VST3 ──────────────────────
    #[cfg(target_os = "windows")]
    #[test]
    fn probe_fails_on_non_vst3_dll() {
        let path = PathBuf::from("C:\\Windows\\System32\\kernel32.dll");
        assert!(path.exists(), "kernel32.dll debe existir en Windows");

        let result = probe_vst3(&path);
        assert!(result.is_err(), "kernel32 no es VST3 — debe fallar");

        let err = result.unwrap_err();
        assert!(
            err.contains("GetPluginFactory"),
            "El error debe mencionar GetPluginFactory. Got: {}",
            err
        );
    }

    // ── Test 3: PClassInfo string helpers ────────────────────
    #[cfg(target_os = "windows")]
    #[test]
    fn pclassinfo_string_helpers_work() {
        use super::com::PClassInfo;

        let mut info = PClassInfo::zeroed();

        // Simular un nombre C string
        let name = b"TestPlugin";
        info.name[..name.len()].copy_from_slice(name);

        let cat = b"Audio Module Class";
        info.category[..cat.len()].copy_from_slice(cat);

        // CID: 16 bytes incrementales
        for (i, b) in info.cid.iter_mut().enumerate() {
            *b = i as u8;
        }

        assert_eq!(info.name_str(), "TestPlugin");
        assert_eq!(info.category_str(), "Audio Module Class");
        assert_eq!(info.cid_str(), "000102030405060708090A0B0C0D0E0F");
    }

    // ── Test 4: PClassInfo size check ────────────────────────
    // Verifica que el tamaño de nuestra struct coincide con el SDK.
    // Si esto falla, el layout está mal y el probe crasheará.
    #[cfg(target_os = "windows")]
    #[test]
    fn pclassinfo_size_is_correct() {
        use super::com::PClassInfo;
        // 16 (cid) + 4 (cardinality) + 32 (category) + 64 (name) = 116
        assert_eq!(
            std::mem::size_of::<PClassInfo>(),
            116,
            "PClassInfo debe ser exactamente 116 bytes"
        );
    }
}