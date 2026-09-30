# Invalidated conclusions and replacement facts

> **Archived.** These early conclusions must no longer be cited as current guidance.

## “Pi does not support automatic discovery”

**Obsolete.**

Pi searches through the shared engine:

- Current `PATH`.
- `~/.npm-global/bin`.
- `~/.local/bin`.
- Multiple Node.js version-manager directories.
- Homebrew and `/usr/local/bin`.
- Windows npm, `.local/bin`, and version-manager directories.

If still missing, Pi returns its default command and fails at spawn. That does not mean automatic discovery is unsupported.

## “All Harnesses use unified discovery”

**Obsolete or overstated.**

Claude Code, Pi, OMP, and Grok use shared executable discovery. DeepSeek Harness still searches current `PATH` for `dsh`/`npx` inside its Adapter.

Process invocation and Node Runtime PATH completion are not fully unified either:

- Grok uses shared `commandInvocation()` without Node Runtime PATH additions.
- Pi/OMP add Node Runtime PATH but retain their own Windows invocation.
- DeepSeek implements both inside its Adapter.

## “The shared discovery package locates Codex Desktop/codex-z installations”

**Incorrect.**

`@codex-z/harness-discovery` handles external Harness CLIs only. Native application location, validation, Launcher, and platform integration are outside the package.

## “NVM scanning is sufficient”

**Obsolete.**

Shared discovery also scans common fnm, Volta, asdf, nodenv, `n`, Bun, pnpm, Homebrew keg-only Node, and Windows nvm-windows layouts.

## “An entry installed under another Node version always runs after discovery”

**Incorrect.**

Discovery proves entry existence/executability only. Harness Node.js engine requirements, shim dependencies on version-manager environment, and the actual child-process Node Runtime can still prevent startup.

## “Every installation location can be discovered automatically”

**Incorrect.**

Current policy covers common directories without scanning whole disks. Configure arbitrary directories explicitly through Host settings:

```text
CODEX_Z_CLAUDE_COMMAND
CODEX_Z_PI_COMMAND
CODEX_Z_OMP_COMMAND
CODEX_Z_GROK_COMMAND
CODEX_Z_DEEPSEEK_HARNESS_COMMAND
```

## `PI_COMMAND` and `CODEX_Z_PI_COMMAND` use the same configuration entry

**Qualification required.**

- Host Runtime's public environment variable is `CODEX_Z_PI_COMMAND`, passed as an explicit Adapter option after reading.
- Pi discovery also accepts `PI_COMMAND` directly in the supplied environment for compatibility.

OMP has the same separation between Host-facing variables and internal compatibility variables. Explain the configuration layer; names are not interchangeable.

## “DeepSeek endpoint is a remote Model API”

**Incorrect.**

DeepSeek endpoint is the local loopback DSH Web Host, by default:

```text
http://127.0.0.1:3080/
```

The Adapter connects to existing Hosts first; only unavailable Hosts trigger local `dsh`/`npx` discovery/startup. This is not a DeepSeek cloud Model API URL.

## “Internal Workspace packages are published independently to npm”

**Incorrect.**

`@codex-z/harness-discovery` is `private: true` and not part of npm publication. It is an internal module boundary delivered with codex-z runtime artifacts.
