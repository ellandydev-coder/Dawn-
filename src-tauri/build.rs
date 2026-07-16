fn main() {
    cc::Build::new()
        .cpp(true)
        .file("cpp/core.cpp")
        .include("cpp")
        .flag_if_supported("-std=c++17")
        .compile("dawn_core");

    tauri_build::build();
}