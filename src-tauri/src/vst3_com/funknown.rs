// src-tauri/src/vst3_com/funknown.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 FUnknown — Base de todas las interfaces COM en VST3
// ═══════════════════════════════════════════════════════════════
//
// ── QUÉ ES ──
// FUnknown es el equivalente VST3 a IUnknown de COM clásico.
// Todo objeto VST3 (factory, component, controller, host...) hereda
// de FUnknown y expone estos 3 métodos:
//
//   queryInterface(iid, out)  → obtener otra "cara" del mismo objeto
//   addRef()                  → incrementar refcount
//   release()                 → decrementar refcount (0 → destruir)
//
// ── HERENCIA COM ──
// En COM no hay herencia de datos, solo de vtable. Cuando decimos que
// "IComponent hereda de FUnknown" significa que los primeros 3 slots
// de la vtable de IComponent SON los 3 métodos de FUnknown en el
// mismo orden.
//
// Esto nos permite tratar cualquier objeto VST3 como FUnknown haciendo
// solo un cast del puntero — sin transmute complejo.
//
// ── REFCOUNTING ──
// Todo objeto COM tiene un contador interno. Cuando llega a 0, el
// objeto se destruye. Reglas:
//   • Recibes un puntero → alguien ya hizo addRef por ti
//   • Guardas el puntero → haces addRef
//   • Terminas de usarlo → haces release
//
// ⚠️ Olvidar release = memory leak. Doble release = crash.

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};

// ═══════════════════════════════════════════════════════════════
// 🎯 IID
// ═══════════════════════════════════════════════════════════════

/// IID de FUnknown — 00000000-0000-0000-C000-000000000046
/// Es el clásico "IUnknown" de COM que sirve como base universal.
pub const IID_FUNKNOWN: Tuid =
    tuid(0x00000000, 0x00000000, 0xC0000000, 0x00000046);

// ═══════════════════════════════════════════════════════════════
// 🎯 VTABLE
// ═══════════════════════════════════════════════════════════════

/// Vtable de FUnknown.
///
/// El orden de los campos ES el orden de los punteros en la vtable
/// (índices 0, 1, 2). Cualquier interfaz que "herede" de FUnknown
/// debe empezar su vtable con estos 3 métodos en este orden.
#[repr(C)]
pub struct FUnknownVtable {
    /// query_interface(this, iid, out) → HRESULT
    ///
    /// Pide al objeto un puntero a otra interfaz que también implemente.
    /// Ej: preguntarle a un IComponent si también es un IAudioProcessor.
    ///
    /// Retorno:
    ///   S_OK   → el objeto soporta esa interfaz, out contiene el puntero
    ///            (¡ya con addRef hecho!)
    ///   otro   → no soporta esa interfaz, out queda en NULL
    pub query_interface: unsafe extern "system" fn(
        this: *mut c_void,
        iid:  *const Tuid,
        out:  *mut *mut c_void,
    ) -> Hresult,

    /// add_ref(this) → nuevo refcount
    pub add_ref: unsafe extern "system" fn(this: *mut c_void) -> u32,

    /// release(this) → refcount tras decrementar. Si retorna 0,
    /// el objeto ya está destruido — no volver a tocarlo.
    pub release: unsafe extern "system" fn(this: *mut c_void) -> u32,
}

/// Objeto FUnknown — en COM el primer campo SIEMPRE es *vtable.
#[repr(C)]
pub struct FUnknown {
    pub vtable: *const FUnknownVtable,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 WRAPPERS DE ALTO NIVEL
// ═══════════════════════════════════════════════════════════════

/// Llama a `queryInterface` en cualquier objeto COM cuya vtable
/// empiece con FUnknown (o sea, todos).
///
/// SAFETY: `this` debe apuntar a un objeto COM válido cuya vtable
/// comience con los 3 métodos de FUnknown en los slots 0-1-2.
/// Esto es cierto para toda interfaz VST3 gracias a la "herencia" de vtable.
///
/// Retorno: `Ok(ptr)` con el nuevo puntero (ya con addRef) o `Err(HRESULT)`.
pub unsafe fn query_interface(
    this: *mut c_void,
    iid:  &Tuid,
) -> Result<*mut c_void, Hresult> {
    if this.is_null() {
        return Err(-1);
    }

    // Todos los objetos VST3 tienen FUnknownVtable en los primeros 3 slots.
    let funknown = this as *mut FUnknown;
    let vtable   = (*funknown).vtable;

    if vtable.is_null() {
        return Err(-1);
    }

    let mut out: *mut c_void = std::ptr::null_mut();
    let hr = ((*vtable).query_interface)(
        this,
        iid as *const Tuid,
        &mut out as *mut *mut c_void,
    );

    if hr == super::S_OK && !out.is_null() {
        Ok(out)
    } else {
        Err(hr)
    }
}

/// Llama a `release()` de forma segura. No hace nada si `this` es NULL.
/// Retorna el refcount resultante (0 = objeto destruido).
///
/// SAFETY: `this` debe ser un puntero COM válido o NULL.
pub unsafe fn release(this: *mut c_void) -> u32 {
    if this.is_null() {
        return 0;
    }
    let funknown = this as *mut FUnknown;
    let vtable   = (*funknown).vtable;
    if vtable.is_null() {
        return 0;
    }
    ((*vtable).release)(this)
}

/// Llama a `addRef()`. Retorna el nuevo refcount.
///
/// SAFETY: `this` debe ser un puntero COM válido no-nulo.
#[allow(dead_code)]
pub unsafe fn add_ref(this: *mut c_void) -> u32 {
    if this.is_null() {
        return 0;
    }
    let funknown = this as *mut FUnknown;
    let vtable   = (*funknown).vtable;
    if vtable.is_null() {
        return 0;
    }
    ((*vtable).add_ref)(this)
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iid_funknown_is_classic_iunknown() {
        // 00000000-0000-0000-C000-000000000046 es el IID canónico
        // de IUnknown desde 1993. VST3 lo reutiliza tal cual.
        let expected: Tuid = [
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0xC0, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x46,
        ];
        assert_eq!(IID_FUNKNOWN, expected);
    }

    #[test]
    fn vtable_has_three_slots() {
        // 3 métodos × tamaño de puntero función
        let expected_size = std::mem::size_of::<usize>() * 3;
        assert_eq!(std::mem::size_of::<FUnknownVtable>(), expected_size);
    }

    #[test]
    fn funknown_is_single_pointer() {
        // Un objeto FUnknown es solo un puntero a vtable
        assert_eq!(std::mem::size_of::<FUnknown>(), std::mem::size_of::<usize>());
    }
}