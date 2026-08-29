// src-tauri/src/vst3_com/iaudio_processor.rs

use std::os::raw::c_void;
use super::{tuid, Hresult, Tuid, S_OK};
use super::funknown::FUnknownVtable;

/// IID IAudioProcessor oficial Steinberg — 42043F99-B7DA-42C2-A291-599D61C1E2EE
pub const IID_IAUDIO_PROCESSOR: Tuid =
    tuid(0x42043F99, 0xB7DA42C2, 0xA291599D, 0x61C1E2EE);

pub const kRealtime: i32 = 0;
pub const kSample32: i32 = 0;
pub const kSpeakerArrStereo: u64 = 3;

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct ProcessSetup {
    pub process_mode: i32,
    pub symbolic_sample_size: i32,
    pub max_samples_per_block: i32,
    pub sample_rate: f64,
}

impl ProcessSetup {
    pub fn realtime_f32(sample_rate: f64, max_samples_per_block: i32) -> Self {
        Self {
            process_mode: kRealtime,
            symbolic_sample_size: kSample32,
            max_samples_per_block,
            sample_rate,
        }
    }

    pub fn default_48k() -> Self {
        Self::realtime_f32(48000.0, 1024)
    }
}

#[repr(C)]
pub struct AudioBusBuffers {
    pub num_channels: i32,
    pub silence_flags: u64,
    pub channel_buffers_32: *mut *mut f32,
}

impl AudioBusBuffers {
    pub fn from_channels(ptrs: &mut [*mut f32]) -> Self {
        Self {
            num_channels: ptrs.len() as i32,
            silence_flags: 0,
            channel_buffers_32: ptrs.as_mut_ptr(),
        }
    }
}

#[repr(C)]
pub struct ProcessData {
    pub process_mode: i32,
    pub symbolic_sample_size: i32,
    pub num_samples: i32,
    pub num_inputs: i32,
    pub num_outputs: i32,
    pub inputs: *mut AudioBusBuffers,
    pub outputs: *mut AudioBusBuffers,
    pub input_parameter_changes: *mut c_void,
    pub output_parameter_changes: *mut c_void,
    pub input_events: *mut c_void,
    pub output_events: *mut c_void,
    pub process_context: *mut c_void,
}

impl ProcessData {
    pub fn audio_only(
        num_samples: i32,
        inputs: *mut AudioBusBuffers,
        num_inputs: i32,
        outputs: *mut AudioBusBuffers,
        num_outputs: i32,
    ) -> Self {
        Self {
            process_mode: kRealtime,
            symbolic_sample_size: kSample32,
            num_samples,
            num_inputs,
            num_outputs,
            inputs,
            outputs,
            input_parameter_changes: std::ptr::null_mut(),
            output_parameter_changes: std::ptr::null_mut(),
            input_events: std::ptr::null_mut(),
            output_events: std::ptr::null_mut(),
            process_context: std::ptr::null_mut(),
        }
    }
}

#[repr(C)]
pub struct IAudioProcessorVtable {
    pub base: FUnknownVtable,
    pub set_bus_arrangements: unsafe extern "system" fn(
        this: *mut c_void,
        inputs: *mut u64,
        num_ins: i32,
        outputs: *mut u64,
        num_outs: i32,
    ) -> Hresult,
    pub get_bus_arrangement: unsafe extern "system" fn(
        this: *mut c_void,
        bus_direction: i32,
        index: i32,
        arrangement: *mut u64,
    ) -> Hresult,
    pub can_process_sample_size: unsafe extern "system" fn(
        this: *mut c_void,
        symbolic_sample_size: i32,
    ) -> Hresult,
    pub get_latency_samples: unsafe extern "system" fn(this: *mut c_void) -> u32,
    pub setup_processing: unsafe extern "system" fn(
        this: *mut c_void,
        setup: *mut ProcessSetup,
    ) -> Hresult,
    pub set_processing: unsafe extern "system" fn(this: *mut c_void, state: u8) -> Hresult,
    pub process: unsafe extern "system" fn(this: *mut c_void, data: *mut ProcessData) -> Hresult,
    pub get_tail_samples: unsafe extern "system" fn(this: *mut c_void) -> u32,
}

#[repr(C)]
pub struct IAudioProcessor {
    pub vtable: *const IAudioProcessorVtable,
}

#[inline]
unsafe fn vtable(this: *mut c_void) -> Option<&'static IAudioProcessorVtable> {
    if this.is_null() { return None; }
    let obj = this as *mut IAudioProcessor;
    let vt = (*obj).vtable;
    if vt.is_null() { return None; }
    Some(&*vt)
}

pub unsafe fn setup_processing(this: *mut c_void, setup: &mut ProcessSetup) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.setup_processing)(this, setup as *mut ProcessSetup),
        None => -1,
    }
}

pub unsafe fn set_processing(this: *mut c_void, state: bool) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.set_processing)(this, if state { 1 } else { 0 }),
        None => -1,
    }
}

pub unsafe fn get_latency_samples(this: *mut c_void) -> u32 {
    match vtable(this) {
        Some(vt) => (vt.get_latency_samples)(this),
        None => 0,
    }
}

pub unsafe fn can_process_f32(this: *mut c_void) -> bool {
    match vtable(this) {
        Some(vt) => (vt.can_process_sample_size)(this, kSample32) == S_OK,
        None => false,
    }
}

pub unsafe fn set_bus_arrangements_stereo(this: *mut c_void) -> Hresult {
    match vtable(this) {
        Some(vt) => {
            let mut in_arr = kSpeakerArrStereo;
            let mut out_arr = kSpeakerArrStereo;
            (vt.set_bus_arrangements)(this, &mut in_arr, 1, &mut out_arr, 1)
        }
        None => -1,
    }
}

pub unsafe fn process(this: *mut c_void, data: &mut ProcessData) -> Hresult {
    match vtable(this) {
        Some(vt) => (vt.process)(this, data as *mut ProcessData),
        None => -1,
    }
}