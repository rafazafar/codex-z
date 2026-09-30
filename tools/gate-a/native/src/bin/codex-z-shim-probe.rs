#![forbid(unsafe_code)]

use std::env;
use std::process;

use codex_z_gate_a_native::ProbeCapture;

fn run() -> codex_z_shim::ShimResult<i32> {
    let capture = ProbeCapture::from_environment()?;
    codex_z_shim::run_proxy_with_observer(&env::args_os().skip(1).collect::<Vec<_>>(), &capture)
}

fn main() {
    let exit_code = match run() {
        Ok(code) => code,
        Err(error) => {
            eprintln!("codex-z Gate Shim: {error}");
            1
        }
    };
    process::exit(exit_code);
}
