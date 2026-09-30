# Remote Harnesses over SSH

Use Harnesses that are installed and signed in only on a remote machine — Claude Code included — from your local Codex Desktop, through its native SSH workspace. Your credentials stay on the remote machine and are never sent over SSH.

## Prerequisites

- **Local machine** (macOS, Linux, or Windows): Codex Desktop and codex-z are installed.
- **Remote machine** (macOS or x64/ARM64 Linux; Windows isn't supported yet): Codex CLI is installed, along with **the same codex-z version** as your local machine.
- The Harness you want to use is installed and signed in on the remote machine.
- Codex Desktop's native SSH workspace already works (**Settings → Connections → SSH**).

## Install

Until codex-z packages are published, build the same source version on the remote machine. Install Node.js and the repository Rust toolchain first, then run:

```bash
git clone https://github.com/rafazafar/codex-z.git
cd codex-z
npm ci
npm run build
export PATH="$PWD/target/debug:$PATH"
codex-z remote install
codex-z remote start
codex-z remote status
```

`remote install` adds a clearly marked block to your shell profile that only applies to SSH sessions, and backs up the profile first. Your local shells and existing `codex` command are left alone. On macOS, it also installs a per-user LaunchAgent that starts Claude Code in your logged-in session. It never reads the Keychain or any credentials.

## Usage

1. On your local machine, launch Codex Desktop through codex-z.
2. Open the SSH workspace.
3. Pick a Harness from the composer's Agent / Model selector.

## Commands

```bash
codex-z remote status     # Check whether it is running and installed correctly
codex-z remote start      # Start it (safe to run more than once)
codex-z remote stop       # Stop it without touching other Codex processes
codex-z remote uninstall  # Uninstall it but keep your Thread mapping data
```

After you start, stop, or uninstall, reconnect the SSH workspace in Codex Desktop.

## Upgrade

Build the same source version on both machines. Once packages are published, use the same package manager for both. Then rerun `codex-z remote install` and `codex-z remote start` on the remote machine and reconnect the SSH workspace.

## Troubleshooting

- **`codex-z/harness/inspect is unsupported on this Host connection`**: the SSH connection isn't going through codex-z. Make sure the same codex-z version is installed and running on the remote machine, then reconnect the SSH workspace.
- **`remote status` says degraded or asks you to reinstall**: run `codex-z remote install`, then `codex-z remote start`.
- **A Harness is missing**: make sure it is installed and signed in on the remote machine, then click **Run connection diagnostics** in Settings.
- **Install fails on macOS with a launchd / `gui/$UID` error**: the remote Mac needs someone logged in to the desktop. Log in, then run `codex-z remote install` again.
