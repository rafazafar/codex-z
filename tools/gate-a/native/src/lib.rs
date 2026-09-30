#![forbid(unsafe_code)]

#[cfg(feature = "gate-tools")]
mod capture;

#[cfg(feature = "gate-tools")]
pub use capture::ProbeCapture;

#[cfg(feature = "gate-tools")]
pub const PROBE_OUTPUT_ENV: &str = "CODEX_Z_PROBE_OUTPUT";
#[cfg(feature = "gate-tools")]
pub const DESKTOP_VERSION_ENV: &str = "CODEX_Z_DESKTOP_VERSION";
#[cfg(feature = "gate-tools")]
pub const INSTALL_ROOT_ENV: &str = "CODEX_Z_INSTALL_ROOT";
#[cfg(feature = "gate-tools")]
pub const LAUNCH_MODE_ENV: &str = "CODEX_Z_LAUNCH_MODE";
