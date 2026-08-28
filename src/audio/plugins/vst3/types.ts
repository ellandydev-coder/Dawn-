// src/services/plugins/vst3/types.ts

export interface Vst3ClassInfo {
  cid: string;
  cardinality: number;
  category: string;
  name: string;
}

export interface Vst3LoadResult {
  success: boolean;
  message: string;
  bundle_path: string;
  dll_path: string | null;
  plugin_key: string | null;
  factory_ptr: string | null;
  classes: Vst3ClassInfo[];
}

export interface Vst3InstanceInfo {
  instance_id: string;
  class_cid: string;
  component_ptr: string;
  initialized: boolean;
  plugin_base_ptr: string;
  has_editor: boolean;
  has_processor: boolean;
  processing_active: boolean;
}

export interface Vst3CreateResult {
  success: boolean;
  message: string;
  instance_id: string | null;
  component_ptr: string | null;
  class_cid: string;
}

export interface Vst3InitResult {
  success: boolean;
  message: string;
  hresult: number;
  plugin_base_ptr: string | null;
  host_context_ptr: string | null;
}

export interface Vst3OpenEditorResult {
  success: boolean;
  message: string;
  hwnd: string | null;
  width: number;
  height: number;
  controller_ptr: string | null;
  view_ptr: string | null;
}

/** Resultado de vst3_activate_processing */
export interface Vst3ActivateProcessingResult {
  success: boolean;
  message: string;
  processor_ptr: string | null;
  latency_samples: number;
  sample_rate: number;
  max_block_size: number;
}

/** Resultado de vst3_process_block */
export interface Vst3ProcessBlockResult {
  success: boolean;
  message: string;
  output_l: number[];
  output_r: number[];
  num_samples: number;
}