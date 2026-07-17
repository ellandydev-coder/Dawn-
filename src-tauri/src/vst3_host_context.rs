// src-tauri/src/vst3_host_context.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 DawnHost — Nuestro objeto IHostApplication
// ═══════════════════════════════════════════════════════════════
//
// ── PROPÓSITO ──
// Cuando llamemos `component->initialize(host_ptr)` en Fase 2.5,
// el plugin recibirá un puntero a DawnHost. El plugin lo interpreta
// como IHostApplication (mismo layout binario del primer campo) y
// puede llamar sus métodos.
//
// ── PATRÓN: SERVIDOR COM EN RUST PURO ──
//
// Anatomía:
//
//   DawnHost {
//     vtable: *const IHostApplicationVtable  ← Primer campo (CRÍTICO)
//     ref_count: AtomicU32                   ← Nuestro estado
//   }
//
// La `vtable` apunta a `DAWN_HOST_VTABLE` que es una constante estática
// con punteros a nuestras funciones `extern "system"` (host_query_interface,
// host_add_ref, host_release, host_get_name, host_create_instance).
//
// ── SINGLETON ETERNO ──
//
// El DawnHost vive dentro de un OnceLock estático. Se aloca la primera
// vez que se pide y NUNCA se libera. add_ref/release mantienen un counter
// (para satisfacer al plugin) pero nunca destruyen el objeto.
//
// Esto es lo que hace REAPER y es totalmente estándar. Los plugins no
// tienen forma de saber si el host los "engaña" — solo les importa
// que sus llamadas add_ref/release retornen valores coherentes.
//
// ── THREAD SAFETY ──
//
// El plugin puede llamar métodos desde CUALQUIER thread:
//   • audio thread (real-time)
//   • UI thread
//   • worker threads del plugin
//
// AtomicU32 con Ordering::SeqCst garantiza refcount correcto.
// get_name y create_instance no tocan estado mutable, son thread-safe
// por naturaleza.
//
// ── ESTADO ACTUAL (Sub-paso 2.4.c) ──
// ✅ DawnHost struct con layout COM-compatible
// ✅ Vtable estática con 5 métodos implementados
// ✅ Singleton eterno via OnceLock
// ✅ Refcount atómico
// ✅ query_interface soporta IHostApplication + FUnknown
// ✅ get_name devuelve "DAWN v0.1.0"
// ✅ create_instance devuelve kNotImplemented
// ⬜ Integración con initialize() del componente     [Paso 2.5]

use std::os::raw::c_void;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::OnceLock;

use crate::vst3_com::{Hresult, Tuid, S_OK};
use crate::vst3_com::funknown::{FUnknownVtable, IID_FUNKNOWN};
use crate::vst3_com::ihost::{
    IHostApplicationVtable, String128, IID_IHOST_APPLICATION,
};
use crate::vst3_com::string_convert::str_to_string128;

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

/// Nombre del host que reportamos a los plugins.
/// Cambiar solo en releases mayores — algunos plugins guardan
/// el nombre en presets y podrían confundirse si cambia mucho.
const HOST_NAME: &str = "DAWN v0.1.0";

/// HRESULT: E_NOINTERFACE — el objeto no soporta la interfaz pedida
/// en queryInterface. Valor estándar COM.
const E_NOINTERFACE: Hresult = -2147467262; // 0x80004002

/// HRESULT: E_NOTIMPL — método no implementado.
const E_NOTIMPL: Hresult = -2147467263; // 0x80004001

/// HRESULT: E_POINTER — puntero inválido pasado como parámetro.
const E_POINTER: Hresult = -2147467261; // 0x80004003

// ═══════════════════════════════════════════════════════════════
// 🎯 DawnHost — el struct que el plugin ve como IHostApplication
// ═══════════════════════════════════════════════════════════════

/// Nuestro objeto host.
///
/// ⚠️ LAYOUT CRÍTICO ⚠️
/// - Primer campo: puntero a vtable (obligatorio COM)
/// - #[repr(C)] evita que Rust reordene campos
/// - Segundo campo en adelante: estado privado nuestro
///
/// El plugin solo ve el primer campo (piensa que es un IHostApplication
/// puro). Nunca accede a `ref_count` directamente — solo vía los
/// métodos add_ref/release de la vtable.
#[repr(C)]
pub struct DawnHost {
    /// Puntero a la vtable estática compartida.
    vtable: *const IHostApplicationVtable,

    /// Contador de referencias.
    /// Atomic porque el plugin puede llamar add_ref/release desde
    /// threads distintos sin sincronización externa.
    ref_count: AtomicU32,
}

// SAFETY: DawnHost solo contiene un puntero a static + AtomicU32.
// Ambos son Send + Sync por naturaleza. El puntero a vtable estática
// nunca cambia y las funciones extern "system" no capturan estado
// mutable no-atómico.
unsafe impl Send for DawnHost {}
unsafe impl Sync for DawnHost {}

// ═══════════════════════════════════════════════════════════════
// 🎯 VTABLE ESTÁTICA COMPARTIDA
// ═══════════════════════════════════════════════════════════════

/// La vtable de DawnHost.
///
/// Es `static` porque:
///   1. Todos los DawnHost (habrá 1) apuntan a la misma
///   2. Los punteros a fn son constantes en tiempo de compilación
///   3. Vive toda la duración del programa
///
/// El plugin recibe `*const IHostApplicationVtable` (mismo layout)
/// gracias a #[repr(C)] en ambas structs.
static DAWN_HOST_VTABLE: IHostApplicationVtable = IHostApplicationVtable {
    base: FUnknownVtable {
        query_interface: host_query_interface,
        add_ref:         host_add_ref,
        release:         host_release,
    },
    get_name:        host_get_name,
    create_instance: host_create_instance,
};

// ═══════════════════════════════════════════════════════════════
// 🎯 SINGLETON — un DawnHost eterno
// ═══════════════════════════════════════════════════════════════

/// El único DawnHost que existe.
///
/// Vive dentro de un OnceLock estático → alocación lazy la primera vez
/// que se pide, y luego vive hasta que la app termine.
///
/// Envolvemos en Box para tener heap alloc estable (dirección de
/// memoria fija) — el plugin va a guardar el puntero y llamarlo
/// desde cualquier thread. Si el DawnHost se moviera, crash.
static DAWN_HOST_INSTANCE: OnceLock<Box<DawnHost>> = OnceLock::new();

impl DawnHost {
    /// Devuelve un puntero al DawnHost singleton.
    /// La primera llamada crea el objeto; las demás retornan el mismo ptr.
    ///
    /// El puntero es válido durante toda la vida del programa.
    /// NO llamar release en este puntero pensando que lo va a destruir —
    /// nuestro `release` es un no-op para el singleton.
    pub fn get_singleton_ptr() -> *mut c_void {
        let host_box = DAWN_HOST_INSTANCE.get_or_init(|| {
            log::info!("[DawnHost] Inicializando singleton (name='{}')", HOST_NAME);
            Box::new(DawnHost {
                vtable:    &DAWN_HOST_VTABLE,
                ref_count: AtomicU32::new(1), // arranca en 1 (el host mismo lo posee)
            })
        });

        // Box::as_ref → &DawnHost → *const → *mut c_void
        // El puntero apunta a memoria de heap gestionada por OnceLock,
        // que vive lo que vive el programa. Válido para siempre.
        host_box.as_ref() as *const DawnHost as *mut c_void
    }

    /// Devuelve el refcount actual (para debug y tests).
    #[allow(dead_code)]
    pub fn current_ref_count() -> Option<u32> {
        DAWN_HOST_INSTANCE.get().map(|h| h.ref_count.load(Ordering::SeqCst))
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 IMPLEMENTACIÓN DE LOS MÉTODOS COM
// ═══════════════════════════════════════════════════════════════
//
// Todas las funciones son `extern "system"` porque el ABI Windows COM
// espera stdcall. En x86_64 stdcall == C, así que también funciona en
// Linux/Mac (aunque el resto del código es Windows-only por ahora).
//
// Cada función recibe `this: *mut c_void` que es el puntero al DawnHost.
// Lo casteamos y accedemos vía referencia.

// ─── query_interface ──────────────────────────────────────────

/// El plugin nos pregunta si soportamos una interfaz específica.
/// Nosotros solo soportamos IHostApplication y FUnknown (base COM).
///
/// SAFETY: `this` debe ser un puntero válido a DawnHost. Rust confía
/// en que el plugin no nos pasa basura — si lo hace, crash.
unsafe extern "system" fn host_query_interface(
    this: *mut c_void,
    iid:  *const Tuid,
    out:  *mut *mut c_void,
) -> Hresult {
    // Validación defensiva
    if this.is_null() || iid.is_null() || out.is_null() {
        return E_POINTER;
    }

    let requested_iid = *iid;

    // Soportamos:
    //   • IHostApplication (nuestra "cara" principal)
    //   • FUnknown (base COM — todo objeto lo soporta)
    if requested_iid == IID_IHOST_APPLICATION || requested_iid == IID_FUNKNOWN {
        // Al entregar el puntero debemos hacer addRef (contrato COM)
        host_add_ref(this);
        *out = this;
        S_OK
    } else {
        // Cualquier otra interfaz → no soportada
        *out = std::ptr::null_mut();
        E_NOINTERFACE
    }
}

// ─── add_ref ──────────────────────────────────────────────────

/// Incrementa refcount atómicamente.
/// SAFETY: `this` debe ser un DawnHost válido (el singleton).
unsafe extern "system" fn host_add_ref(this: *mut c_void) -> u32 {
    if this.is_null() {
        return 0;
    }
    let host = &*(this as *const DawnHost);
    // fetch_add retorna el valor ANTERIOR — sumamos 1 para el nuevo
    let previous = host.ref_count.fetch_add(1, Ordering::SeqCst);
    previous + 1
}

// ─── release ──────────────────────────────────────────────────

/// Decrementa refcount. NO destruye el objeto porque es singleton.
///
/// Si el contador llega a 0 por decrementos del plugin, ok — el
/// DawnHost sigue vivo en el OnceLock, listo para futuras llamadas
/// (rara vez pasa en la práctica, pero no queremos crashear).
///
/// SAFETY: `this` debe ser un DawnHost válido.
unsafe extern "system" fn host_release(this: *mut c_void) -> u32 {
    if this.is_null() {
        return 0;
    }
    let host = &*(this as *const DawnHost);
    let previous = host.ref_count.fetch_sub(1, Ordering::SeqCst);

    // fetch_sub retorna el valor ANTERIOR. Si era 1, ahora es 0.
    // El plugin verá 0 y creerá que destruyó el objeto. Nosotros
    // NO liberamos memoria porque somos singleton eterno.
    if previous == 1 {
        log::debug!("[DawnHost] refcount llegó a 0 (singleton NO destruido)");
        0
    } else {
        previous - 1
    }
}

// ─── get_name ─────────────────────────────────────────────────

/// El plugin quiere saber cómo nos llamamos.
/// Escribimos "DAWN v0.1.0" (o lo que sea HOST_NAME) en el buffer.
///
/// SAFETY: `name` debe apuntar a un buffer de exactamente 128 u16
/// (256 bytes). Es responsabilidad del plugin.
unsafe extern "system" fn host_get_name(
    _this: *mut c_void,
    name:  *mut String128,
) -> Hresult {
    if name.is_null() {
        return E_POINTER;
    }

    // `&mut *name` es una referencia mutable al buffer.
    // str_to_string128 escribe UTF-16 con null terminator garantizado.
    let buffer: &mut String128 = &mut *name;
    let written = str_to_string128(HOST_NAME, buffer);

    log::trace!("[DawnHost] get_name → '{}' ({} u16 escritas)", HOST_NAME, written);

    S_OK
}

// ─── create_instance ──────────────────────────────────────────

/// El plugin nos pide instanciar un objeto interno (IMessage,
/// IAttributeList, etc.). Por ahora devolvemos kNotImplemented.
///
/// Cuando implementemos plugins avanzados con comunicación entre
/// component y controller, aquí crearemos los objetos según iid.
unsafe extern "system" fn host_create_instance(
    _this: *mut c_void,
    _cid:  *const Tuid,
    _iid:  *const Tuid,
    obj:   *mut *mut c_void,
) -> Hresult {
    if !obj.is_null() {
        *obj = std::ptr::null_mut();
    }
    log::debug!("[DawnHost] create_instance → E_NOTIMPL (aún no soportado)");
    E_NOTIMPL
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMANDO TAURI — vst3_debug_host_context (Sub-paso 2.4.d)
// ═══════════════════════════════════════════════════════════════
//
// Comando de debug que simula lo que hará un plugin real cuando
// reciba nuestro host context. Sirve para validar end-to-end desde
// el frontend antes de exponer el host a plugins de terceros en
// Paso 2.5.
//
// ⚠️ Este comando NO se queda en producción. Solo lo usamos para
// verificar que Fase 2.4 funciona end-to-end.

/// Resultado del debug del host context.
#[derive(Debug, serde::Serialize)]
pub struct HostContextDebug {
    pub success: bool,
    /// Puntero al singleton DawnHost (hex, para debug)
    pub host_ptr: String,
    /// Puntero a la vtable estática (hex)
    pub vtable_ptr: String,
    /// Nombre reportado por get_name (debe ser "DAWN v0.1.0")
    pub reported_name: String,
    /// Refcount antes de nuestras operaciones
    pub ref_count_initial: u32,
    /// Refcount después de un add_ref
    pub ref_count_after_addref: u32,
    /// Refcount después de un release (debe volver al inicial)
    pub ref_count_after_release: u32,
    /// Retorno de query_interface con IID_IHOST_APPLICATION (debe ser 0 = S_OK)
    pub query_interface_hresult: i32,
    /// Mensaje descriptivo
    pub message: String,
}

/// Comando Tauri: valida end-to-end el DawnHost singleton.
///
/// Simula la secuencia típica que hará un plugin:
///   1. Recibe puntero al host
///   2. Lee vtable → llama get_name (verifica string)
///   3. Llama add_ref (verifica refcount++)
///   4. Llama release (verifica refcount--)
///   5. Llama query_interface con IID_IHOST_APPLICATION
#[tauri::command]
pub fn vst3_debug_host_context() -> HostContextDebug {
    use crate::vst3_com::ihost::{IHostApplicationVtable, String128, IID_IHOST_APPLICATION};
    use crate::vst3_com::string_convert::string128_to_str;

    log::info!("[vst3_host_context] Debug host context iniciado");

    // ─── 1. Obtener el singleton ────────────────────────
    let host_ptr = DawnHost::get_singleton_ptr();
    let host_addr = host_ptr as usize;

    if host_ptr.is_null() {
        return HostContextDebug {
            success: false,
            host_ptr: "0x0".to_string(),
            vtable_ptr: "0x0".to_string(),
            reported_name: String::new(),
            ref_count_initial: 0,
            ref_count_after_addref: 0,
            ref_count_after_release: 0,
            query_interface_hresult: -1,
            message: "get_singleton_ptr devolvió NULL".to_string(),
        };
    }

    // ─── 2. Leer la vtable (como haría un plugin) ──────
    let vtable_ptr = unsafe {
        *(host_ptr as *const *const IHostApplicationVtable)
    };
    let vtable_addr = vtable_ptr as usize;

    // ─── 3. Snapshot inicial de refcount ───────────────
    let ref_initial = DawnHost::current_ref_count().unwrap_or(0);

    // ─── 4. Llamar get_name via vtable ─────────────────
    let mut name_buffer: String128 = [0u16; 128];
    let get_name_hr = unsafe {
        let get_name_fn = (*vtable_ptr).get_name;
        get_name_fn(host_ptr, &mut name_buffer as *mut String128)
    };

    let reported_name = string128_to_str(&name_buffer);
    log::info!(
        "[vst3_host_context] get_name → '{}' (HRESULT=0x{:08X})",
        reported_name, get_name_hr as u32
    );

    // ─── 5. add_ref via vtable ─────────────────────────
    let ref_after_addref = unsafe {
        let add_ref_fn = (*vtable_ptr).base.add_ref;
        add_ref_fn(host_ptr)
    };

    // ─── 6. release via vtable ─────────────────────────
    let ref_after_release = unsafe {
        let release_fn = (*vtable_ptr).base.release;
        release_fn(host_ptr)
    };

    // ─── 7. query_interface(IID_IHOST_APPLICATION) ─────
    let mut out_ptr: *mut c_void = std::ptr::null_mut();
    let qi_hr = unsafe {
        let qi_fn = (*vtable_ptr).base.query_interface;
        qi_fn(
            host_ptr,
            &IID_IHOST_APPLICATION as *const _,
            &mut out_ptr as *mut *mut c_void,
        )
    };

    // query_interface hizo add_ref internamente → balanceamos con release
    if qi_hr == S_OK && !out_ptr.is_null() {
        unsafe {
            let release_fn = (*vtable_ptr).base.release;
            release_fn(host_ptr);
        }
    }

    log::info!(
        "[vst3_host_context] ✅ Debug completo: name='{}', refs=[{}→{}→{}], qi_hr=0x{:08X}",
        reported_name, ref_initial, ref_after_addref, ref_after_release, qi_hr as u32
    );

    HostContextDebug {
        success: true,
        host_ptr: format!("0x{:016x}", host_addr),
        vtable_ptr: format!("0x{:016x}", vtable_addr),
        reported_name,
        ref_count_initial: ref_initial,
        ref_count_after_addref: ref_after_addref,
        ref_count_after_release: ref_after_release,
        query_interface_hresult: qi_hr,
        message: "Debug completado sin crashes".to_string(),
    }
}


// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vst3_com::ihost::IID_IHOST_APPLICATION;
    use crate::vst3_com::funknown::IID_FUNKNOWN;
    use crate::vst3_com::string_convert::string128_to_str;

    // ⚠️ IMPORTANTE SOBRE TESTS DE SINGLETON:
    // El OnceLock persiste entre tests dentro del mismo binario.
    // Los tests que verifican refcount deben partir del valor actual,
    // no asumir que empieza en 1. Por eso los tests son "aditivos".

    #[test]
    fn singleton_returns_same_pointer_twice() {
        let p1 = DawnHost::get_singleton_ptr();
        let p2 = DawnHost::get_singleton_ptr();
        assert_eq!(p1, p2, "singleton debe retornar el mismo puntero");
        assert!(!p1.is_null());
    }

    #[test]
    fn singleton_has_valid_vtable() {
        let ptr = DawnHost::get_singleton_ptr();
        let host = unsafe { &*(ptr as *const DawnHost) };
        assert!(!host.vtable.is_null());
        // El vtable debe apuntar a nuestra static (misma dirección)
        assert_eq!(
            host.vtable as usize,
            &DAWN_HOST_VTABLE as *const _ as usize
        );
    }

    #[test]
    fn add_ref_increments_count() {
        let ptr = DawnHost::get_singleton_ptr();
        let before = DawnHost::current_ref_count().unwrap();
        let new_count = unsafe { host_add_ref(ptr) };
        assert_eq!(new_count, before + 1);

        // Cleanup: bajarlo de nuevo
        unsafe { host_release(ptr); }
    }

    #[test]
    fn release_decrements_count() {
        let ptr = DawnHost::get_singleton_ptr();
        // Sumamos primero para tener margen para restar
        unsafe { host_add_ref(ptr); }
        let before = DawnHost::current_ref_count().unwrap();
        let new_count = unsafe { host_release(ptr) };
        assert_eq!(new_count, before - 1);
    }

    #[test]
    fn query_interface_returns_self_for_ihost_application() {
        let ptr = DawnHost::get_singleton_ptr();
        let mut out: *mut c_void = std::ptr::null_mut();

        let hr = unsafe {
            host_query_interface(
                ptr,
                &IID_IHOST_APPLICATION as *const _,
                &mut out as *mut *mut c_void,
            )
        };

        assert_eq!(hr, S_OK);
        assert_eq!(out, ptr, "debe devolver el mismo puntero");

        // Cleanup: query_interface hizo add_ref
        unsafe { host_release(ptr); }
    }

    #[test]
    fn query_interface_returns_self_for_funknown() {
        let ptr = DawnHost::get_singleton_ptr();
        let mut out: *mut c_void = std::ptr::null_mut();

        let hr = unsafe {
            host_query_interface(
                ptr,
                &IID_FUNKNOWN as *const _,
                &mut out as *mut *mut c_void,
            )
        };

        assert_eq!(hr, S_OK);
        assert_eq!(out, ptr);

        unsafe { host_release(ptr); }
    }

    #[test]
    fn query_interface_returns_no_interface_for_unknown_iid() {
        let ptr = DawnHost::get_singleton_ptr();
        let mut out: *mut c_void = 0xDEADBEEF as *mut c_void; // basura inicial

        // IID inventado que no soportamos
        let random_iid: Tuid = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        let hr = unsafe {
            host_query_interface(
                ptr,
                &random_iid as *const _,
                &mut out as *mut *mut c_void,
            )
        };

        assert_eq!(hr, E_NOINTERFACE);
        assert!(out.is_null(), "out debe quedar en NULL en error");
    }

    #[test]
    fn get_name_writes_dawn_v010_to_buffer() {
        let ptr = DawnHost::get_singleton_ptr();
        let mut buffer: String128 = [0xFFFFu16; 128]; // buffer con basura

        let hr = unsafe { host_get_name(ptr, &mut buffer as *mut String128) };

        assert_eq!(hr, S_OK);
        assert_eq!(string128_to_str(&buffer), "DAWN v0.1.0");
    }

    #[test]
    fn get_name_null_pointer_returns_error() {
        let ptr = DawnHost::get_singleton_ptr();
        let hr = unsafe { host_get_name(ptr, std::ptr::null_mut()) };
        assert_eq!(hr, E_POINTER);
    }

    #[test]
    fn create_instance_returns_not_implemented() {
        let ptr = DawnHost::get_singleton_ptr();
        let mut out: *mut c_void = 0xDEADBEEF as *mut c_void;
        let dummy_cid: Tuid = [0; 16];
        let dummy_iid: Tuid = [0; 16];

        let hr = unsafe {
            host_create_instance(
                ptr,
                &dummy_cid as *const _,
                &dummy_iid as *const _,
                &mut out as *mut *mut c_void,
            )
        };

        assert_eq!(hr, E_NOTIMPL);
        assert!(out.is_null(), "out debe limpiarse a NULL");
    }

    // ── Test de simulación completa: emular llamada del plugin ──

    #[test]
    fn simulates_plugin_calling_via_vtable() {
        // Un plugin real vería DawnHost como *mut IHostApplication.
        // Simulamos exactamente lo que hace: lee vtable, llama métodos.
        let ptr = DawnHost::get_singleton_ptr();

        unsafe {
            // Leer el primer campo (que es *const IHostApplicationVtable)
            let vtable_ptr = *(ptr as *const *const IHostApplicationVtable);
            assert!(!vtable_ptr.is_null());

            // Llamar get_name via vtable (como haría el plugin)
            let mut buffer: String128 = [0u16; 128];
            let get_name_fn = (*vtable_ptr).get_name;
            let hr = get_name_fn(ptr, &mut buffer as *mut String128);

            assert_eq!(hr, S_OK);
            assert_eq!(string128_to_str(&buffer), "DAWN v0.1.0");

            // Llamar add_ref via vtable
            let add_ref_fn = (*vtable_ptr).base.add_ref;
            let refs = add_ref_fn(ptr);
            assert!(refs >= 2);

            // Y liberamos
            let release_fn = (*vtable_ptr).base.release;
            release_fn(ptr);
        }
    }

    // ── Layout binario ──────────────────────────────────────────

    #[test]
    fn dawn_host_first_field_is_vtable_pointer() {
        // Crítico: el offset del campo `vtable` debe ser 0.
        // Si Rust reordena o añade padding, el plugin lee basura.
        let host = DawnHost {
            vtable: &DAWN_HOST_VTABLE,
            ref_count: AtomicU32::new(0),
        };

        let host_addr   = &host as *const _ as usize;
        let vtable_addr = &host.vtable as *const _ as usize;
        assert_eq!(host_addr, vtable_addr, "vtable debe ser el primer campo");
    }
}