// src-tauri/src/vst3_host_context.rs

use std::os::raw::c_void;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::OnceLock;

use crate::vst3_com::{tuid, Hresult, Tuid, S_OK};
use crate::vst3_com::funknown::{FUnknownVtable, IID_FUNKNOWN};
use crate::vst3_com::ihost::{IHostApplicationVtable, String128, IID_IHOST_APPLICATION};
use crate::vst3_com::iplug_view::ViewRect;
use crate::vst3_com::string_convert::str_to_string128;

const HOST_NAME: &str = "DAWN v0.1.0";
const E_NOINTERFACE: Hresult = -2147467262; // 0x80004002
const E_POINTER: Hresult = -2147467261;     // 0x80004003

pub const IID_ICOMPONENT_HANDLER: Tuid =
    tuid(0x93A4EB7D, 0x09D045E5, 0xA934FDAB, 0x96DD7A2D);

pub const IID_IPLUG_FRAME: Tuid =
    tuid(0x35042D4E, 0xA65C481C, 0x9E0002F5, 0x3E38870A);

// ==========================================
// 1. IHostApplication
// ==========================================
#[repr(C)]
pub struct DawnHost {
    pub vtable: *const IHostApplicationVtable,
    ref_count: AtomicU32,
}

unsafe impl Send for DawnHost {}
unsafe impl Sync for DawnHost {}

static DAWN_HOST_VTABLE: IHostApplicationVtable = IHostApplicationVtable {
    base: FUnknownVtable {
        query_interface: host_query_interface,
        add_ref: host_add_ref,
        release: host_release,
    },
    get_name: host_get_name,
    create_instance: host_create_instance,
};

static DAWN_HOST_INSTANCE: OnceLock<Box<DawnHost>> = OnceLock::new();

impl DawnHost {
    pub fn get_singleton_ptr() -> *mut c_void {
        let host_box = DAWN_HOST_INSTANCE.get_or_init(|| {
            Box::new(DawnHost {
                vtable: &DAWN_HOST_VTABLE,
                ref_count: AtomicU32::new(1),
            })
        });
        host_box.as_ref() as *const DawnHost as *mut c_void
    }
}

unsafe extern "system" fn host_query_interface(this: *mut c_void, iid: *const Tuid, out: *mut *mut c_void) -> Hresult {
    if this.is_null() || iid.is_null() || out.is_null() { return E_POINTER; }
    let req = *iid;
    if req == IID_IHOST_APPLICATION || req == IID_FUNKNOWN {
        host_add_ref(this);
        *out = this;
        S_OK
    } else {
        *out = std::ptr::null_mut();
        E_NOINTERFACE
    }
}

unsafe extern "system" fn host_add_ref(this: *mut c_void) -> u32 {
    if this.is_null() { return 0; }
    let host = &*(this as *const DawnHost);
    host.ref_count.fetch_add(1, Ordering::SeqCst) + 1
}

unsafe extern "system" fn host_release(this: *mut c_void) -> u32 {
    if this.is_null() { return 0; }
    let host = &*(this as *const DawnHost);
    let prev = host.ref_count.fetch_sub(1, Ordering::SeqCst);
    if prev == 1 { 0 } else { prev - 1 }
}

unsafe extern "system" fn host_get_name(_this: *mut c_void, name: *mut String128) -> Hresult {
    if name.is_null() { return E_POINTER; }
    str_to_string128(HOST_NAME, &mut *name);
    S_OK
}

unsafe extern "system" fn host_create_instance(_this: *mut c_void, _cid: *const Tuid, _iid: *const Tuid, obj: *mut *mut c_void) -> Hresult {
    if !obj.is_null() { *obj = std::ptr::null_mut(); }
    -2147467263
}

// ==========================================
// 2. IComponentHandler
// ==========================================
#[repr(C)]
pub struct IComponentHandlerVtable {
    pub base: FUnknownVtable,
    pub begin_edit: unsafe extern "system" fn(this: *mut c_void, id: u32) -> Hresult,
    pub perform_edit: unsafe extern "system" fn(this: *mut c_void, id: u32, value_normalized: f64) -> Hresult,
    pub end_edit: unsafe extern "system" fn(this: *mut c_void, id: u32) -> Hresult,
    pub restart_component: unsafe extern "system" fn(this: *mut c_void, flags: i32) -> Hresult,
}

#[repr(C)]
pub struct DawnComponentHandler {
    pub vtable: *const IComponentHandlerVtable,
    ref_count: AtomicU32,
}

unsafe impl Send for DawnComponentHandler {}
unsafe impl Sync for DawnComponentHandler {}

static HANDLER_VTABLE: IComponentHandlerVtable = IComponentHandlerVtable {
    base: FUnknownVtable {
        query_interface: handler_query_interface,
        add_ref: handler_add_ref,
        release: handler_release,
    },
    begin_edit: handler_begin_edit,
    perform_edit: handler_perform_edit,
    end_edit: handler_end_edit,
    restart_component: handler_restart_component,
};

static HANDLER_INSTANCE: OnceLock<Box<DawnComponentHandler>> = OnceLock::new();

impl DawnComponentHandler {
    pub fn get_singleton_ptr() -> *mut c_void {
        let handler_box = HANDLER_INSTANCE.get_or_init(|| {
            Box::new(DawnComponentHandler {
                vtable: &HANDLER_VTABLE,
                ref_count: AtomicU32::new(1),
            })
        });
        handler_box.as_ref() as *const DawnComponentHandler as *mut c_void
    }
}

unsafe extern "system" fn handler_query_interface(this: *mut c_void, iid: *const Tuid, out: *mut *mut c_void) -> Hresult {
    if this.is_null() || iid.is_null() || out.is_null() { return E_POINTER; }
    let req = *iid;
    if req == IID_ICOMPONENT_HANDLER || req == IID_FUNKNOWN {
        handler_add_ref(this);
        *out = this;
        S_OK
    } else {
        *out = std::ptr::null_mut();
        E_NOINTERFACE
    }
}

unsafe extern "system" fn handler_add_ref(this: *mut c_void) -> u32 {
    if this.is_null() { return 0; }
    let handler = &*(this as *const DawnComponentHandler);
    handler.ref_count.fetch_add(1, Ordering::SeqCst) + 1
}

unsafe extern "system" fn handler_release(this: *mut c_void) -> u32 {
    if this.is_null() { return 0; }
    let handler = &*(this as *const DawnComponentHandler);
    let prev = handler.ref_count.fetch_sub(1, Ordering::SeqCst);
    if prev == 1 { 0 } else { prev - 1 }
}

unsafe extern "system" fn handler_begin_edit(_this: *mut c_void, _id: u32) -> Hresult { S_OK }
unsafe extern "system" fn handler_perform_edit(_this: *mut c_void, _id: u32, _value: f64) -> Hresult { S_OK }
unsafe extern "system" fn handler_end_edit(_this: *mut c_void, _id: u32) -> Hresult { S_OK }
unsafe extern "system" fn handler_restart_component(_this: *mut c_void, _flags: i32) -> Hresult { S_OK }

// ==========================================
// 3. IPlugFrame
// ==========================================
#[repr(C)]
pub struct IPlugFrameVtable {
    pub base: FUnknownVtable,
    pub resize_view: unsafe extern "system" fn(this: *mut c_void, view: *mut c_void, new_size: *mut ViewRect) -> Hresult,
}

#[repr(C)]
pub struct DawnPlugFrame {
    pub vtable: *const IPlugFrameVtable,
    ref_count: AtomicU32,
}

unsafe impl Send for DawnPlugFrame {}
unsafe impl Sync for DawnPlugFrame {}

static FRAME_VTABLE: IPlugFrameVtable = IPlugFrameVtable {
    base: FUnknownVtable {
        query_interface: frame_query_interface,
        add_ref: frame_add_ref,
        release: frame_release,
    },
    resize_view: frame_resize_view,
};

static FRAME_INSTANCE: OnceLock<Box<DawnPlugFrame>> = OnceLock::new();

impl DawnPlugFrame {
    pub fn get_singleton_ptr() -> *mut c_void {
        let frame_box = FRAME_INSTANCE.get_or_init(|| {
            Box::new(DawnPlugFrame {
                vtable: &FRAME_VTABLE,
                ref_count: AtomicU32::new(1),
            })
        });
        frame_box.as_ref() as *const DawnPlugFrame as *mut c_void
    }
}

unsafe extern "system" fn frame_query_interface(this: *mut c_void, iid: *const Tuid, out: *mut *mut c_void) -> Hresult {
    if this.is_null() || iid.is_null() || out.is_null() { return E_POINTER; }
    let req = *iid;
    if req == IID_IPLUG_FRAME || req == IID_FUNKNOWN {
        frame_add_ref(this);
        *out = this;
        S_OK
    } else {
        *out = std::ptr::null_mut();
        E_NOINTERFACE
    }
}

unsafe extern "system" fn frame_add_ref(this: *mut c_void) -> u32 {
    if this.is_null() { return 0; }
    let frame = &*(this as *const DawnPlugFrame);
    frame.ref_count.fetch_add(1, Ordering::SeqCst) + 1
}

unsafe extern "system" fn frame_release(this: *mut c_void) -> u32 {
    if this.is_null() { return 0; }
    let frame = &*(this as *const DawnPlugFrame);
    let prev = frame.ref_count.fetch_sub(1, Ordering::SeqCst);
    if prev == 1 { 0 } else { prev - 1 }
}

unsafe extern "system" fn frame_resize_view(_this: *mut c_void, _view: *mut c_void, _new_size: *mut ViewRect) -> Hresult { S_OK }

#[derive(Debug, serde::Serialize)]
pub struct HostContextDebug {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub fn vst3_debug_host_context() -> HostContextDebug {
    let host_ptr = DawnHost::get_singleton_ptr();
    HostContextDebug {
        success: !host_ptr.is_null(),
        message: if !host_ptr.is_null() { "Host context activo".into() } else { "Error host context".into() },
    }
}