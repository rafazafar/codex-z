# Historical topic: native Codex Desktop and codex-z installation discovery

> **Archived.** These notes explain early analysis coverage, not current Harness CLI discovery.

Part of the original temporary analysis investigated Codex Desktop/codex-z installation locations on each platform. This concerns native application discovery and Launcher/platform integration, outside `@codex-z/harness-discovery` ownership.

## Topics recorded at the time

### Windows

Early analysis covered:

- `CODEX_Z_PROBE_*` Gate A overrides.
- `CODEX_Z_INSTALL_ROOT` portable/unpacked MSIX overrides.
- Windows PackageManager/AppX package discovery.
- WindowsApps installation roots.
- Codex CLI cache in `%LOCALAPPDATA%\OpenAI\Codex\bin\`.
- Validation of `ChatGPT.exe`, bundled Codex CLI, `app.asar`, and `AppxManifest.xml`.

### macOS

Early analysis covered:

- `/Applications/Codex.app`.
- `/Applications/ChatGPT.app`.
- `~/Applications/Codex.app`.
- `~/Applications/ChatGPT.app`.
- Validation of Bundle Identifier, `CFBundleExecutable`, Mach-O executables, and `app.asar`.
- Conflicts between multiple valid installations.

### Linux

Early analysis covered:

- Fixed application directory `/usr/lib/chatgpt/`.
- `/usr/bin/chatgpt` launcher.
- Validation of `ChatGPT`, `codex-launcher`, bundled Codex CLI, and `linux-package-metadata.json`.

## Separate ownership from Harness discovery

These capabilities answer:

> How does codex-z locate and validate the native Codex Desktop application it hosts or extends?

`@codex-z/harness-discovery` answers:

> How does running codex-z find external Harness CLIs such as `claude`, `pi`, `omp`, or `grok`?

Ownership differs:

- Rust/release layers own native application installation, Launcher, and platform integration.
- TypeScript Adapters and `packages/harness-discovery` own external Harness CLI command search.

Early documents combined both questions in one discovery-location summary. Readers could incorrectly infer that the public Harness package scans/validates Codex Desktop application bundles. The current implementation has no such responsibility.
