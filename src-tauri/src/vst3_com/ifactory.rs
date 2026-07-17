// src-tauri/src/vst3_com/ifactory.rs
//
// ═══════════════════════════════════════════════════════════════
// 🎯 IPluginFactory — Entrada al plugin
// ═══════════════════════════════════════════════════════════════
//
// ── QUÉ ES ──
// Todo DLL VST3 exporta la función C:
//   IPluginFactory* GetPluginFactory();
//
// El factory es el punto de entrada al plugin. Nos permite:
//   • Preguntar cuántas clases contiene (countClasses)
//   • Obtener info de cada clase (getClassInfo)
//   • Instanciar cualquier clase (createInstance) ← Paso 2.3 ✅
//
// ── HERENCIA ──
// IPluginFactory hereda de FUnknown:
//   slots 0-2: query_interface, add_ref, release
//   slots 3-6: get_factory_info, count_classes, get_class_info, create_instance
//
// ── VERSIONES ──
// Hay IPluginFactory2 y IPluginFactory3 con más métodos.
// Por ahora solo usamos IPluginFactory (versión base).

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid};
use super::funknown::FUnknownVtable;

// ═══════════════════════════════════════════════════════════════
// 🎯 IID
// ═══════════════════════════════════════════════════════════════

/// IID de IPluginFactory — 7A4D811C-52114A1F-AED9-D2EE0B43BF9F
pub const IID_IPLUGIN_FACTORY: Tuid =
    tuid(0x7A4D811C, 0x52114A1F, 0xAED9D2EE, 0x0B43BF9F);

// ═══════════════════════════════════════════════════════════════
// 🎯 PClassInfo — struct que rellena getClassInfo
// ═══════════════════════════════════════════════════════════════

#[repr(C)]
pub struct PClassInfo {
    pub cid:         Tuid,
    pub cardinality: i32,
    pub category:    [u8; 32],
    pub name:        [u8; 64],
}

impl PClassInfo {
    pub fn zeroed() -> Self {
        unsafe { std::mem::zeroed() }
    }

    pub fn category_str(&self) -> String {
        let end = self.category.iter().position(|&b| b == 0)
            .unwrap_or(self.category.len());
        String::from_utf8_lossy(&self.category[..end]).to_string()
    }

    pub fn name_str(&self) -> String {
        let end = self.name.iter().position(|&b| b == 0)
            .unwrap_or(self.name.len());
        String::from_utf8_lossy(&self.name[..end]).to_string()
    }

    pub fn cid_str(&self) -> String {
        self.cid.iter().map(|b| format!("{:02X}", b)).collect()
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 VTABLE
// ═══════════════════════════════════════════════════════════════

/// Vtable de IPluginFactory.
///
/// Layout completo (7 slots):
///   [0-2]  FUnknown        (query_interface, add_ref, release)
///   [3]    get_factory_info
///   [4]    count_classes
///   [5]    get_class_info
///   [6]    create_instance  ← Paso 2.3
#[repr(C)]
pub struct IPluginFactoryVtable {
    pub base: FUnknownVtable,

    pub get_factory_info: unsafe extern "system" fn(
        this: *mut c_void,
        info: *mut c_void,
    ) -> Hresult,

    pub count_classes: unsafe extern "system" fn(this: *mut c_void) -> i32,

    pub get_class_info: unsafe extern "system" fn(
        this:  *mut c_void,
        index: i32,
        info:  *mut PClassInfo,
    ) -> Hresult,

    /// create_instance(this, cid, iid, out) → HRESULT
    ///
    /// Instancia una clase del factory.
    ///
    /// Parámetros:
    ///   cid → TUID de la clase (viene de PClassInfo.cid)
    ///   iid → TUID de la interfaz que queremos (ej: IID_ICOMPONENT)
    ///   out → puntero de salida — el plugin lo rellena con el nuevo objeto
    ///
    /// Retorno:
    ///   S_OK        → out contiene un puntero válido (con addRef hecho)
    ///   kNoInterface → esa clase no soporta esa interfaz
    ///   otros errores → out queda en NULL
    pub create_instance: unsafe extern "system" fn(
        this: *mut c_void,
        cid:  *const Tuid,
        iid:  *const Tuid,
        out:  *mut *mut c_void,
    ) -> Hresult,
}

/// Objeto IPluginFactory — puntero a vtable.
#[repr(C)]
pub struct IPluginFactory {
    pub vtable: *const IPluginFactoryVtable,
}

// ═══════════════════════════════════════════════════════════════
// 🎯 WRAPPERS DE ALTO NIVEL
// ═══════════════════════════════════════════════════════════════

pub unsafe fn count_classes(factory: *mut c_void) -> i32 {
    if factory.is_null() {
        return 0;
    }
    let fac    = factory as *mut IPluginFactory;
    let vtable = (*fac).vtable;
    if vtable.is_null() {
        return 0;
    }
    ((*vtable).count_classes)(factory)
}

pub unsafe fn get_class_info(
    factory: *mut c_void,
    index:   i32,
) -> Result<PClassInfo, Hresult> {
    if factory.is_null() {
        return Err(-1);
    }
    let fac    = factory as *mut IPluginFactory;
    let vtable = (*fac).vtable;
    if vtable.is_null() {
        return Err(-1);
    }
    let mut info = PClassInfo::zeroed();
    let hr = ((*vtable).get_class_info)(factory, index, &mut info as *mut PClassInfo);
    if hr == super::S_OK {
        Ok(info)
    } else {
        Err(hr)
    }
}

/// Llama a `createInstance` en un factory.
///
/// SAFETY:
/// - `factory` debe ser un IPluginFactory válido.
/// - `cid` y `iid` deben apuntar a TUIDs válidos (16 bytes).
///
/// Retorna un puntero al nuevo objeto (ya con addRef hecho por el plugin)
/// o Err(HRESULT) si falla.
///
/// ⚠️  El caller es RESPONSABLE de llamar release() cuando termine
/// de usar el puntero. Si no, memory leak. Si lo llama dos veces, crash.
pub unsafe fn create_instance(
    factory: *mut c_void,
    cid:     &Tuid,
    iid:     &Tuid,
) -> Result<*mut c_void, Hresult> {
    if factory.is_null() {
        return Err(-1);
    }
    let fac    = factory as *mut IPluginFactory;
    let vtable = (*fac).vtable;
    if vtable.is_null() {
        return Err(-1);
    }

    let mut out: *mut c_void = std::ptr::null_mut();
    let hr = ((*vtable).create_instance)(
        factory,
        cid as *const Tuid,
        iid as *const Tuid,
        &mut out as *mut *mut c_void,
    );

    if hr == super::S_OK && !out.is_null() {
        Ok(out)
    } else {
        Err(hr)
    }
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pclassinfo_size_is_116_bytes() {
        assert_eq!(std::mem::size_of::<PClassInfo>(), 116);
    }

    #[test]
    fn pclassinfo_string_helpers() {
        let mut info = PClassInfo::zeroed();

        let name = b"TestPlugin";
        info.name[..name.len()].copy_from_slice(name);

        let cat = b"Audio Module Class";
        info.category[..cat.len()].copy_from_slice(cat);

        for (i, b) in info.cid.iter_mut().enumerate() {
            *b = i as u8;
        }

        assert_eq!(info.name_str(),     "TestPlugin");
        assert_eq!(info.category_str(), "Audio Module Class");
        assert_eq!(info.cid_str(),      "000102030405060708090A0B0C0D0E0F");
    }

    #[test]
    fn vtable_has_seven_slots() {
        // 3 de FUnknown + 4 de IPluginFactory (get_factory_info,
        // count_classes, get_class_info, create_instance)
        let expected = std::mem::size_of::<usize>() * 7;
        assert_eq!(std::mem::size_of::<IPluginFactoryVtable>(), expected);
    }
}