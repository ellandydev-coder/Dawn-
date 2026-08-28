// src-tauri/src/vst3/types.rs

use super::registry::{InstanceId, PluginKey};

#[derive(Debug, Clone, serde::Serialize)]
pub struct Vst3ClassInfo {
    pub cid: String,
    pub cardinality: i32,
    pub category: String,
    pub name: String,
}

#[derive(Debug, serde::Serialize)]
pub struct ProbeResult {
    pub success: bool,
    pub message: String,
    pub bundle_path: String,
    pub dll_path: Option<String>,
    pub dll_handle: Option<String>,
    pub factory_ptr: Option<String>,
    pub classes: Vec<Vst3ClassInfo>,
}

#[derive(Debug, serde::Serialize)]
pub struct LoadResult {
    pub success: bool,
    pub message: String,
    pub bundle_path: String,
    pub dll_path: Option<String>,
    pub plugin_key: Option<PluginKey>,
    pub factory_ptr: Option<String>,
    pub classes: Vec<Vst3ClassInfo>,
}

#[derive(Debug, serde::Serialize)]
pub struct CreateInstanceResult {
    pub success: bool,
    pub message: String,
    pub instance_id: Option<InstanceId>,
    pub component_ptr: Option<String>,
    pub class_cid: String,
}

#[derive(Debug, serde::Serialize)]
pub struct InitializeResult {
    pub success: bool,
    pub message: String,
    pub hresult: i32,
    pub plugin_base_ptr: Option<String>,
    pub host_context_ptr: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct OpenEditorResult {
    pub success: bool,
    pub message: String,
    pub hwnd: Option<String>,
    pub width: i32,
    pub height: i32,
    pub controller_ptr: Option<String>,
    pub view_ptr: Option<String>,
}