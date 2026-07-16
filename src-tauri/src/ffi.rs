use std::ffi::{CStr, CString};
use std::os::raw::c_char;

extern "C" {
    fn cpp_sumar(a: i32, b: i32) -> i32;
    fn cpp_saludar(nombre: *const c_char) -> *const c_char;
    fn cpp_free_string(ptr: *const c_char);
}

pub fn sumar(a: i32, b: i32) -> i32 {
    unsafe { cpp_sumar(a, b) }
}

pub fn saludar(nombre: &str) -> String {
    let c_nombre = CString::new(nombre).unwrap();
    unsafe {
        let ptr = cpp_saludar(c_nombre.as_ptr());
        let s = CStr::from_ptr(ptr).to_string_lossy().into_owned();
        cpp_free_string(ptr);
        s
    }
}