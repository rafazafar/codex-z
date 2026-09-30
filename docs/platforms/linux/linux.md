# Linux support

codex-z supports x64 and ARM64 Linux. Install the official ChatGPT App for your architecture, Node.js, and the repository Rust toolchain. Until codex-z packages are published, build from source:

```bash
git clone https://github.com/rafazafar/codex-z.git
cd codex-z
npm ci
npm start
```

## Supported environment

The Linux release supports the official ChatGPT `.deb` and `.rpm` packages on x86-64 and ARM64. The codex-z Linux native binaries use glibc 2.35 as their release baseline and can load on systems with glibc 2.35 or newer; the official ChatGPT App's distribution support remains defined by OpenAI's documentation. codex-z verifies the production package metadata, native ELF architecture, and these packaged entry points:

- launcher: `/usr/bin/chatgpt`
- installation: `/usr/lib/chatgpt`
- Desktop executable: `/usr/lib/chatgpt/ChatGPT`

The runtime requires a mounted `/proc` and Linux `pidfd` support. Snap, Flatpak, AppImage, local or relocated installations, wrapper or `alternatives` launchers, cross-architecture execution, and codex-z Linux installer packages are not supported. The planned Linux distribution uses npm; current installations use the source build.

## Renderer compatibility

Renderer integration failures are recovered in the background and do not display compatibility dialogs or write local warning acknowledgements. While an external Agent integration is unavailable, the managed Desktop remains usable with official Codex routing. The initial Controller handshake still fails closed on malformed or unsupported readiness output.

## Process ownership

codex-z refuses to take over an independently running ChatGPT App. Quit ChatGPT completely before launching codex-z. A managed launch starts the verified Desktop executable directly and supervises it through `/proc`; stock ChatGPT launches still use the official launcher. Shutdown signals are sent only after PID, start time, and executable identity are revalidated.

## Diagnosis

After `npm run build`, add `target/debug` from the repository to `PATH`, or use `./target/debug/codex-z` directly.

```bash
codex-z inspect
codex-z --version
```

`inspect` reports the recognized package identity, version, launcher, executable, and running process IDs. After a ChatGPT App update, use it to confirm that codex-z still recognizes the installed Desktop. Renderer integration retries automatically when a supported surface is temporarily unavailable.
