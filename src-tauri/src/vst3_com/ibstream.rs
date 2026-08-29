// src-tauri/src/vst3_com/ibstream.rs

use std::os::raw::c_void;
use std::sync::atomic::{AtomicU32, Ordering};
use super::{tuid, Hresult, Tuid, S_OK};
use super::funknown::{FUnknownVtable, IID_FUNKNOWN};

/// IID de IBStream oficial Steinberg — C3BF6EA2-3D26-4399-B62C-AE223B2A108F
pub const IID_IBSTREAM: Tuid =
    tuid(0xC3BF6EA2, 0x3D264399, 0xB62CAE22, 0x3B2A108F);

const E_NOINTERFACE: Hresult = -2147467262;
const E_POINTER: Hresult = -2147467261;

#[repr(C)]
pub struct IBStreamVtable {
    pub base: FUnknownVtable,
    pub read: unsafe extern "system" fn(this: *mut c_void, buffer: *mut c_void, num_bytes: i32, num_bytes_read: *mut i32) -> Hresult,
    pub write: unsafe extern "system" fn(this: *mut c_void, buffer: *const c_void, num_bytes: i32, num_bytes_written: *mut i32) -> Hresult,
    pub seek: unsafe extern "system" fn(this: *mut c_void, pos: i64, mode: i32, result: *mut i64) -> Hresult,
    pub tell: unsafe extern "system" fn(this: *mut c_void, pos: *mut i64) -> Hresult,
}

#[repr(C)]
pub struct MemoryStream {
    pub vtable: *const IBStreamVtable,
    ref_count: AtomicU32,
    buffer: Vec<u8>,
    position: usize,
}

static STREAM_VTABLE: IBStreamVtable = IBStreamVtable {
    base: FUnknownVtable {
        query_interface: stream_query_interface,
        add_ref: stream_add_ref,
        release: stream_release,
    },
    read: stream_read,
    write: stream_write,
    seek: stream_seek,
    tell: stream_tell,
};

impl MemoryStream {
    pub fn new() -> *mut c_void {
        let stream = Box::new(MemoryStream {
            vtable: &STREAM_VTABLE,
            ref_count: AtomicU32::new(1),
            buffer: Vec::new(),
            position: 0,
        });
        Box::into_raw(stream) as *mut c_void
    }

    pub unsafe fn seek_start(this: *mut c_void) {
        if this.is_null() { return; }
        let stream = &mut *(this as *mut MemoryStream);
        stream.position = 0;
    }

    pub unsafe fn release_stream(this: *mut c_void) {
        if !this.is_null() {
            stream_release(this);
        }
    }
}

unsafe extern "system" fn stream_query_interface(this: *mut c_void, iid: *const Tuid, out: *mut *mut c_void) -> Hresult {
    if this.is_null() || iid.is_null() || out.is_null() { return E_POINTER; }
    let req = *iid;
    if req == IID_IBSTREAM || req == IID_FUNKNOWN {
        stream_add_ref(this);
        *out = this;
        S_OK
    } else {
        *out = std::ptr::null_mut();
        E_NOINTERFACE
    }
}

unsafe extern "system" fn stream_add_ref(this: *mut c_void) -> u32 {
    if this.is_null() { return 0; }
    let stream = &*(this as *const MemoryStream);
    stream.ref_count.fetch_add(1, Ordering::SeqCst) + 1
}

unsafe extern "system" fn stream_release(this: *mut c_void) -> u32 {
    if this.is_null() { return 0; }
    let stream = &*(this as *const MemoryStream);
    let prev = stream.ref_count.fetch_sub(1, Ordering::SeqCst);
    if prev == 1 {
        let _ = Box::from_raw(this as *mut MemoryStream);
        0
    } else {
        prev - 1
    }
}

unsafe extern "system" fn stream_read(this: *mut c_void, buffer: *mut c_void, num_bytes: i32, num_bytes_read: *mut i32) -> Hresult {
    if this.is_null() || buffer.is_null() || num_bytes <= 0 { return S_OK; }
    let stream = &mut *(this as *mut MemoryStream);
    let avail = stream.buffer.len().saturating_sub(stream.position);
    let to_read = (num_bytes as usize).min(avail);
    if to_read > 0 {
        std::ptr::copy_nonoverlapping(stream.buffer.as_ptr().add(stream.position), buffer as *mut u8, to_read);
        stream.position += to_read;
    }
    if !num_bytes_read.is_null() {
        *num_bytes_read = to_read as i32;
    }
    S_OK
}

unsafe extern "system" fn stream_write(this: *mut c_void, buffer: *const c_void, num_bytes: i32, num_bytes_written: *mut i32) -> Hresult {
    if this.is_null() || buffer.is_null() || num_bytes <= 0 { return S_OK; }
    let stream = &mut *(this as *mut MemoryStream);
    let slice = std::slice::from_raw_parts(buffer as *const u8, num_bytes as usize);
    let end_pos = stream.position + slice.len();
    if end_pos > stream.buffer.len() {
        stream.buffer.resize(end_pos, 0);
    }
    stream.buffer[stream.position..end_pos].copy_from_slice(slice);
    stream.position = end_pos;
    if !num_bytes_written.is_null() {
        *num_bytes_written = num_bytes;
    }
    S_OK
}

unsafe extern "system" fn stream_seek(this: *mut c_void, pos: i64, mode: i32, result: *mut i64) -> Hresult {
    if this.is_null() { return -1; }
    let stream = &mut *(this as *mut MemoryStream);
    let new_pos = match mode {
        0 => pos as usize,
        1 => (stream.position as i64 + pos) as usize,
        2 => (stream.buffer.len() as i64 + pos) as usize,
        _ => stream.position,
    };
    stream.position = new_pos;
    if !result.is_null() {
        *result = stream.position as i64;
    }
    S_OK
}

unsafe extern "system" fn stream_tell(this: *mut c_void, pos: *mut i64) -> Hresult {
    if this.is_null() { return -1; }
    let stream = &*(this as *const MemoryStream);
    if !pos.is_null() {
        *pos = stream.position as i64;
    }
    S_OK
}