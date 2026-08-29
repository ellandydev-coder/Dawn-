// src-tauri/src/vst3_host_context.rs

use std::os::raw::{c_char, c_void};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::OnceLock;

use crate::vst3_com::{Hresult, Tuid, S_OK};
use crate::vst3_com::funknown::{FUnknownVtable, IID_FUNKNOWN};
use crate::vst3_com::ihost::{IHostApplicationVtable, String128, IID_IHOST_APPLICATION};
use crate::vst3_com::iplug_view::ViewRect;
use crate::vst3_com::string_convert::str_to_string128;

const HOST_NAME: &str = "DAWN";
const E_NOINTERFACE: Hresult = -2147467262; // 0x80004002
const E_POINTER: Hresult = -2147467261;     // 0x80004003
const E_NOTIMPL: Hresult = -2147467263;     // 0x80004001

// IIDs oficiales Steinberg VST3 (disposición exacta de bytes en memoria Win32 x86_64)
/// IPlugInterfaceSupport — 58E595CC-2DDB-4969-8B6A-AF8C36A664E5
pub const IID_IPLUG_INTERFACE_SUPPORT: Tuid = [
    0xCC, 0x95, 0xE5, 0x58, 0x2D, 0xDB, 0x69, 0x49,
    0x8B, 0x6A, 0xAF, 0x8C, 0x36, 0xA6, 0x64, 0xE5,
];

/// IComponentHandler — 93A4EB7D-09D0-45E5-A934-FDAB96DD7A2D
pub const IID_ICOMPONENT_HANDLER: Tuid = [
    0x7D, 0xEB, 0xA4, 0x93, 0xD0, 0x09, 0xE5, 0x45,
    0xA9, 0x34, 0xFD, 0xAB, 0x96, 0xDD, 0x7A, 0x2D,
];

/// IComponentHandler2 — F040B4B3-A360-45EC-ABCD-C045B4D5A2CC
pub const IID_ICOMPONENT_HANDLER2: Tuid = [
    0xB3, 0xB4, 0x40, 0xF0, 0x60, 0xA3, 0xEC, 0x45,
    0xAB, 0xCD, 0xC0, 0x45, 0xB4, 0xD5, 0xA2, 0xCC,
];

/// IComponentHandler3 — 28971206-9330-4192-83B3-8B78344A8F6A
pub const IID_ICOMPONENT_HANDLER3: Tuid = [
    0x06, 0x12, 0x97, 0x28, 0x30, 0x93, 0x92, 0x41,
    0x83, 0xB3, 0x8B, 0x78, 0x34, 0x4A, 0x8F, 0x6A,
];

/// IUnitHandler — 61E45968-3D36-4F39-B15E-17334944172B
pub const IID_IUNIT_HANDLER: Tuid = [
    0x68, 0x59, 0xE4, 0x61, 0x36, 0x3D, 0x39, 0x4F,
    0xB1, 0x5E, 0x17, 0x33, 0x49, 0x44, 0x17, 0x2B,
];

/// IPlugFrame — 35042D4E-A65C-481C-9E00-02F53E38870A
pub const IID_IPLUG_FRAME: Tuid = [
    0x4E, 0x2D, 0x04, 0x35, 0x5C, 0xA6, 0x1C, 0x48,
    0x9E, 0x00, 0x02, 0xF5, 0x3E, 0x38, 0x87, 0x0A,
];

fn tuid_to_hex(tuid_val: &Tuid) -> String {
    tuid_val
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join("")
}

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

unsafe extern "system" fn host_query_interface(
    this: *mut c_void,
    iid: *const Tuid,
    out: *mut *mut c_void,
) -> Hresult {
    if this.is_null() || iid.is_null() || out.is_null() {
        return E_POINTER;
    }
    let req = *iid;

    if req == IID_IHOST_APPLICATION || req == IID_FUNKNOWN {
        host_add_ref(this);
        *out = this;
        return S_OK;
    }
    if req == IID_IPLUG_INTERFACE_SUPPORT {
        let support = DawnPlugInterfaceSupport::get_singleton_ptr();
        support_add_ref(support);
        *out = support;
        return S_OK;
    }
    if req == IID_ICOMPONENT_HANDLER
        || req == IID_ICOMPONENT_HANDLER2
        || req == IID_ICOMPONENT_HANDLER3
        || req == IID_IUNIT_HANDLER
    {
        let handler = DawnComponentHandler::get_singleton_ptr();
        handler_add_ref(handler);
        *out = handler;
        return S_OK;
    }
    if req == IID_IPLUG_FRAME {
        let frame = DawnPlugFrame::get_singleton_ptr();
        frame_add_ref(frame);
        *out = frame;
        return S_OK;
    }

    println!("[DawnHost QI] IID no soportado solicitado: {}", tuid_to_hex(&req));
    *out = std::ptr::null_mut();
    E_NOINTERFACE
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

unsafe extern "system" fn host_create_instance(
    _this: *mut c_void,
    _cid: *const Tuid,
    _iid: *const Tuid,
    obj: *mut *mut c_void,
) -> Hresult {
    if !obj.is_null() { *obj = std::ptr::null_mut(); }
    E_NOTIMPL
}

// ==========================================
// 2. IPlugInterfaceSupport
// ==========================================
#[repr(C)]
pub struct IPlugInterfaceSupportVtable {
    pub base: FUnknownVtable,
    pub is_plug_interface_supported:
        unsafe extern "system" fn(this: *mut c_void, iid: *const Tuid) -> Hresult,
}

#[repr(C)]
pub struct DawnPlugInterfaceSupport {
    pub vtable: *const IPlugInterfaceSupportVtable,
    ref_count: AtomicU32,
}

unsafe impl Send for DawnPlugInterfaceSupport {}
unsafe impl Sync for DawnPlugInterfaceSupport {}

static SUPPORT_VTABLE: IPlugInterfaceSupportVtable = IPlugInterfaceSupportVtable {
    base: FUnknownVtable {
        query_interface: support_query_interface,
        add_ref: support_add_ref,
        release: support_release,
    },
    is_plug_interface_supported: support_is_plug_interface_supported,
};

static SUPPORT_INSTANCE: OnceLock<Box<DawnPlugInterfaceSupport>> = OnceLock::new();

impl DawnPlugInterfaceSupport {
    pub fn get_singleton_ptr() -> *mut c_void {
        let box_inst = SUPPORT_INSTANCE.get_or_init(|| {
            Box::new(DawnPlugInterfaceSupport {
                vtable: &SUPPORT_VTABLE,
                ref_count: AtomicU32::new(1),
            })
        });
        box_inst.as_ref() as *const DawnPlugInterfaceSupport as *mut c_void
    }
}

unsafe extern "system" fn support_query_interface(
    this: *mut c_void,
    iid: *const Tuid,
    out: *mut *mut c_void,
) -> Hresult {
    if this.is_null() || iid.is_null() || out.is_null() { return E_POINTER; }
    let req = *iid;
    if req == IID_IPLUG_INTERFACE_SUPPORT || req == IID_FUNKNOWN {
        support_add_ref(this);
        *out = this;
        S_OK
    } else {
        *out = std::ptr::null_mut();
        E_NOINTERFACE
    }
}

unsafe extern "system" fn support_add_ref(this: *mut c_void) -> u32 {
    if this.is_null() { return 0; }
    let inst = &*(this as *const DawnPlugInterfaceSupport);
    inst.ref_count.fetch_add(1, Ordering::SeqCst) + 1
}

unsafe extern "system" fn support_release(this: *mut c_void) -> u32 {
    if this.is_null() { return 0; }
    let inst = &*(this as *const DawnPlugInterfaceSupport);
    let prev = inst.ref_count.fetch_sub(1, Ordering::SeqCst);
    if prev == 1 { 0 } else { prev - 1 }
}

unsafe extern "system" fn support_is_plug_interface_supported(
    _this: *mut c_void,
    iid: *const Tuid,
) -> Hresult {
    if !iid.is_null() {
        println!("[IPlugInterfaceSupport] supported? {}", tuid_to_hex(&*iid));
    }
    S_OK
}

// ==========================================
// 3. IComponentHandler & IUnitHandler
// ==========================================
#[repr(C)]
pub struct IComponentHandler2Vtable {
    pub base: FUnknownVtable,
    pub begin_edit: unsafe extern "system" fn(this: *mut c_void, id: u32) -> Hresult,
    pub perform_edit:
        unsafe extern "system" fn(this: *mut c_void, id: u32, value_normalized: f64) -> Hresult,
    pub end_edit: unsafe extern "system" fn(this: *mut c_void, id: u32) -> Hresult,
    pub restart_component: unsafe extern "system" fn(this: *mut c_void, flags: i32) -> Hresult,
    pub set_dirty: unsafe extern "system" fn(this: *mut c_void, state: u8) -> Hresult,
    pub request_open_editor:
        unsafe extern "system" fn(this: *mut c_void, name: *const c_char) -> Hresult,
    pub start_group_edit: unsafe extern "system" fn(this: *mut c_void) -> Hresult,
    pub finish_group_edit: unsafe extern "system" fn(this: *mut c_void) -> Hresult,
    pub notify_unit_selection: unsafe extern "system" fn(this: *mut c_void, unit_id: i32) -> Hresult,
    pub notify_program_list_change: unsafe extern "system" fn(this: *mut c_void, list_id: i32, program_index: i32) -> Hresult,
}

#[repr(C)]
pub struct DawnComponentHandler {
    pub vtable: *const IComponentHandler2Vtable,
    ref_count: AtomicU32,
}

unsafe impl Send for DawnComponentHandler {}
unsafe impl Sync for DawnComponentHandler {}

static HANDLER_VTABLE: IComponentHandler2Vtable = IComponentHandler2Vtable {
    base: FUnknownVtable {
        query_interface: handler_query_interface,
        add_ref: handler_add_ref,
        release: handler_release,
    },
    begin_edit: handler_begin_edit,
    perform_edit: handler_perform_edit,
    end_edit: handler_end_edit,
    restart_component: handler_restart_component,
    set_dirty: handler_set_dirty,
    request_open_editor: handler_request_open_editor,
    start_group_edit: handler_start_group_edit,
    finish_group_edit: handler_finish_group_edit,
    notify_unit_selection: handler_notify_unit_selection,
    notify_program_list_change: handler_notify_program_list_change,
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

unsafe extern "system" fn handler_query_interface(
    this: *mut c_void,
    iid: *const Tuid,
    out: *mut *mut c_void,
) -> Hresult {
    if this.is_null() || iid.is_null() || out.is_null() { return E_POINTER; }
    let req = *iid;
    if req == IID_ICOMPONENT_HANDLER
        || req == IID_ICOMPONENT_HANDLER2
        || req == IID_ICOMPONENT_HANDLER3
        || req == IID_IUNIT_HANDLER
        || req == IID_FUNKNOWN
    {
        handler_add_ref(this);
        *out = this;
        S_OK
    } else {
        println!("[Handler QI] IID no soportado: {}", tuid_to_hex(&req));
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
unsafe extern "system" fn handler_set_dirty(_this: *mut c_void, _state: u8) -> Hresult { S_OK }
unsafe extern "system" fn handler_request_open_editor(_this: *mut c_void, _name: *const c_char) -> Hresult { S_OK }
unsafe extern "system" fn handler_start_group_edit(_this: *mut c_void) -> Hresult { S_OK }
unsafe extern "system" fn handler_finish_group_edit(_this: *mut c_void) -> Hresult { S_OK }
unsafe extern "system" fn handler_notify_unit_selection(_this: *mut c_void, _unit_id: i32) -> Hresult { S_OK }
unsafe extern "system" fn handler_notify_program_list_change(_this: *mut c_void, _list_id: i32, _program_index: i32) -> Hresult { S_OK }

// ==========================================
// 4. IPlugFrame
// ==========================================
#[repr(C)]
pub struct IPlugFrameVtable {
    pub base: FUnknownVtable,
    pub resize_view: unsafe extern "system" fn(
        this: *mut c_void,
        view: *mut c_void,
        new_size: *mut ViewRect,
    ) -> Hresult,
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

unsafe extern "system" fn frame_query_interface(
    this: *mut c_void,
    iid: *const Tuid,
    out: *mut *mut c_void,
) -> Hresult {
    if this.is_null() || iid.is_null() || out.is_null() { return E_POINTER; }
    let req = *iid;
    if req == IID_IPLUG_FRAME || req == IID_FUNKNOWN {
        frame_add_ref(this);
        *out = this;
        S_OK
    } else {
        println!("[Frame QI] IID no soportado: {}", tuid_to_hex(&req));
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

unsafe extern "system" fn frame_resize_view(
    _this: *mut c_void,
    _view: *mut c_void,
    _new_size: *mut ViewRect,
) -> Hresult {
    S_OK
}

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
        message: if !host_ptr.is_null() {
            "Host context activo".into()
        } else {
            "Error host context".into()
        },
    }
}