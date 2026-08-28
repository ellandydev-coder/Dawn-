// src-tauri/src/vst3/audio/process_block.rs

use tauri::State;
use crate::vst3::registry::Vst3Registry;
use crate::vst3_com::iaudio_processor::{self, AudioBusBuffers, ProcessData};

#[derive(Debug, serde::Serialize)]
pub struct ProcessBlockResult {
    pub success: bool,
    pub message: String,
    pub output_l: Vec<f32>,
    pub output_r: Vec<f32>,
    pub num_samples: i32,
}

#[tauri::command]
pub fn vst3_process_block(
    plugin_key: String,
    instance_id: String,
    input_l: Vec<f32>,
    input_r: Vec<f32>,
    registry: State<'_, Vst3Registry>,
) -> ProcessBlockResult {
    #[cfg(target_os = "windows")]
    {
        let n = input_l.len().min(input_r.len());
        if n == 0 {
            return ProcessBlockResult {
                success: false,
                message: "Buffer vacío".into(),
                output_l: vec![],
                output_r: vec![],
                num_samples: 0,
            };
        }

        let processor_ptr = match registry.with_plugin(&plugin_key, |p| {
            p.instances.get(&instance_id).map(|i| {
                (i.processor_ptr, i.processing_active, i.max_block_size)
            })
        }).flatten() {
            Some((ptr, true, max_b)) if ptr != 0 => {
                if n as i32 > max_b && max_b > 0 {
                    return ProcessBlockResult {
                        success: false,
                        message: format!("numSamples {} > maxBlock {}", n, max_b),
                        output_l: vec![],
                        output_r: vec![],
                        num_samples: 0,
                    };
                }
                ptr
            }
            _ => {
                return ProcessBlockResult {
                    success: false,
                    message: "Processor no activo — llamá vst3_activate_processing".into(),
                    output_l: vec![],
                    output_r: vec![],
                    num_samples: 0,
                };
            }
        };

        let mut in_l = input_l[..n].to_vec();
        let mut in_r = input_r[..n].to_vec();
        let mut out_l = vec![0.0f32; n];
        let mut out_r = vec![0.0f32; n];

        let hr = unsafe {
            let mut in_ptrs = [in_l.as_mut_ptr(), in_r.as_mut_ptr()];
            let mut out_ptrs = [out_l.as_mut_ptr(), out_r.as_mut_ptr()];

            let mut in_bus = AudioBusBuffers::from_channels(&mut in_ptrs);
            let mut out_bus = AudioBusBuffers::from_channels(&mut out_ptrs);

            let mut data = ProcessData::audio_only(
                n as i32,
                &mut in_bus as *mut _,
                1,
                &mut out_bus as *mut _,
                1,
            );

            iaudio_processor::process(processor_ptr as *mut _, &mut data)
        };

        if hr != 0 {
            return ProcessBlockResult {
                success: false,
                message: format!("process() HRESULT=0x{:08X}", hr as u32),
                output_l: vec![],
                output_r: vec![],
                num_samples: 0,
            };
        }

        ProcessBlockResult {
            success: true,
            message: "OK".into(),
            output_l: out_l,
            output_r: out_r,
            num_samples: n as i32,
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (plugin_key, instance_id, input_l, input_r, registry);
        ProcessBlockResult {
            success: false,
            message: "Solo Windows".into(),
            output_l: vec![],
            output_r: vec![],
            num_samples: 0,
        }
    }
}