// src-tauri/src/vst3/mod.rs

pub mod cid;
pub mod commands;
pub mod dll;
pub mod editor;
pub mod registry;
pub mod types;
pub mod audio;

pub use commands::*;
pub use registry::Vst3Registry;
pub use audio::*;