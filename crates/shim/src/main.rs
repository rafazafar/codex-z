#![forbid(unsafe_code)]
#![cfg_attr(
    all(target_os = "windows", not(debug_assertions)),
    windows_subsystem = "windows"
)]

use std::process;

fn main() {
    let exit_code = match codex_z_shim::run_from_environment() {
        Ok(code) => code,
        Err(error) => {
            eprintln!("codex-z shim: {error}");
            1
        }
    };
    process::exit(exit_code);
}
