# Harness executable discovery and archived analysis

> Status: Current implementation
> Baseline: `2df7058 feat: unify harness executable discovery`

## Purpose

Desktop-launched codex-z often receives a different `PATH` from an interactive Shell. Harnesses can be installed in npm user directories, Homebrew, other Node.js versions, or Windows npm shim directories.

`@codex-z/harness-discovery` handles installed Harness executables that codex-z cannot find.

It does not discover/install codex-z or Codex Desktop packages. Launcher, release packages, and Rust platform code own native installation discovery and launch.

## Package boundaries

Public implementation:

```text
packages/harness-discovery/
```

This is a private npm Workspace package:

```json
{
  "name": "@codex-z/harness-discovery",
  "private": true
}
```

It participates in TypeScript builds but is not independently published. npm artifacts remain `@codex-z/cli` and platform packages. Discovery ships with Host Runtime and Adapters.

## Public capabilities

### Executable resolution

`resolveHarnessExecutable()` checks:

1. Explicit caller command;
2. Harness command environment variable;
3. Current `PATH`;
4. Declared common installation directories;
5. Node.js version-manager binary directories.

An unresolved explicit command does not silently select another installation.

### Cross-platform paths

Shared handling includes:

- Case-insensitive Windows environment names;
- Windows `PATHEXT`；
- Windows/POSIX paths and separators;
- Templates such as `~` and `${APPDATA}`;
- POSIX execution permissions and Windows file existence;
- Quoted PATH directories.

### Node.js version-manager directories

Common macOS/Linux coverage:

- NVM；
- fnm；
- Volta；
- asdf；
- nodenv；
- `n`；
- Bun；
- pnpm；
- Homebrew keg-only Node, such as `node@22` / `node@24`.

Common Windows coverage:

- nvm-windows；
- fnm；
- Volta；
- Bun；
- pnpm。

Search version directories in descending numeric-aware order for predictable results across Node installations.

### Child-process helpers

The package provides:

- `commandInvocation()`: Windows `.cmd`/`.bat` calls through `cmd.exe` with argument escaping;
- `withNodeRuntimeOnPath()`: Add codex-z Node Runtime directory to child PATH.

## Current integration

| Harness | Shared discovery | Shared Windows invocation | Node Runtime PATH | Notes |
|---|---:|---:|---:|---|
| Claude Code | Yes | General shim not needed | Yes | Prefer native npm `claude.exe` over `claude.cmd` on Windows |
| Pi | Yes | No; Adapter implementation remains | Yes | Preserve deferred failure when absent |
| OMP | Yes | No; Adapter implementation remains | Yes | Preserve deferred failure when absent |
| Grok | Yes | Yes | No | Reduced GUI PATH still needs Node Runtime completion |
| DeepSeek Harness | No | No | No | Adapter discovers `dsh`/`npx`, validates version format, starts managed Web |

Current conclusion:

> Claude Code, Pi, OMP, and Grok share discovery. DeepSeek has not migrated. Invocation and Node Runtime PATH are not unified across all Adapters.

## DeepSeek specifics

DeepSeek was validated on `0.1.2-rc.1`, `0.1.5-rc.1`, `0.1.5-rc.2`, `0.1.5-rc.3`, and `0.1.7-rc.1`. Other SemVer versions are not rejected solely by version difference, but are not proven compatible. Legacy and external Host attach/fallback were removed. Default diagnostic endpoint:

```text
http://127.0.0.1:3080/
```

Connection flow:

1. Require a credential-free loopback HTTP root; reject bootstrap URLs and query parameters.
2. Check explicit command, PATH `dsh`, then local `npx --offline --no-install @deepseek-ai/dsh`. Invalid explicit commands do not select another installation.
3. Require one-line valid SemVer from `--version`: `0.1.2` attempts V0; `0.1.7-rc.1` selects V4; others attempt V3. Web Remote/log/stream profiles are strictly validated. Incompatibility returns actual startup/protocol errors, not version-only rejection.
4. Check endpoint fingerprints without credentials. Recognized DSH authentication asks the user to close that instance and rerun diagnostics, without adopting credentials or stopping it. Other services receive no Session content.
5. Start `web --no-open --host 127.0.0.1 --port 0`, wait for bootstrap, authenticate, then connect HTTP/WebSocket on its temporary port.

Normal use needs no manual `dsh web`. Restart after CLI version changes to select profiles. See [revision and recovery](../harnesses/deepseek/dsh-edit-recovery.md) for V0/V3/V4 boundaries.

Endpoint checks, Host startup/readiness, and HTTP/WebSocket lifecycle remain in `packages/adapters/deepseek-harness`.

General `dsh`/`npx` discovery and Windows `.cmd` invocation can later use `@codex-z/harness-discovery`.

## Manual connection-page installation guides

Uninstalled rows/download icons open a side guide instead of the website. `settings/harness-installation-guides.ts` stores official sources, commands, prerequisites, and next steps. `harness-installation-panel.ts` displays/copies text and invokes diagnostics, without installation/login/Shell execution.

- Distinguish macOS/Linux terminal commands from Windows PowerShell. npm guides state Node prerequisites. Show OS options without inferring remote OS from local OS.
- Operate on the remote target machine. Native Windows does not automatically use WSL installations.
- Pin validated `@deepseek-ai/dsh@0.1.5-rc.1`, not latest; this is not a connection whitelist. Update tested-version notices with evidence. Usually no manual Web launch is needed. rc.2 child ranges can install rc.3 and Cordis needs exact versions. `--version` does not prove Web startup. For plugin/HMR failures, inspect dependencies and `patchReload`; see [validation](../harnesses/deepseek/dsh-015rc1-validation.md). Relaxed version checks do not repair CLI startup. rc.3/017rc1 passed real Gates and can be recommended under product policy.
- WorkBuddy uses official macOS/Windows downloads, not an npm CLI package or unconfirmed Linux command. Desktop login differs from built-in CLI authentication.
- Qoder/Qoder CN use separate sources/commands.
- Users recheck after native installation/authentication/configuration. Copy failures show feedback; diagnostics retain existing details. WorkBuddy paths/environment changes can need restart.

Panels show commands, essential dependencies, next steps, and remote reminders. Detailed OS/PATH/WSL troubleshooting stays in official guides.

Official links in data entries establish command sources. Grok uses public `@xai-official/grok` metadata; DeepSeek global installation follows official `dsh` entry and discovery constraints. Installation does not guarantee arbitrary-version compatibility; diagnostics decide.

## Resolved problems

Mainly addresses:

- Missing Shell PATH on Finder/Windows desktop launch;
- codex-z/Harness under different Node versions;
- npm, Homebrew, and common user binaries absent from PATH;
- Windows npm `.cmd` discovery/invocation;
- `#!/usr/bin/env node` without GUI Node, for Adapters with PATH completion.

## Remaining limits

1. **DeepSeek lacks shared discovery.** A stopped local Host and `dsh` only under another Node version can remain undiscoverable.
2. **Grok lacks Node Runtime PATH completion.** An entry can be found while GUI PATH still breaks its shebang.
3. **Custom directories are not traversed.** Use `CODEX_Z_*_COMMAND` for unusual installs.
4. **Windows custom version-manager roots are incomplete.** Custom `NVM_HOME`/`VOLTA_HOME` can need explicit commands.
5. **Discovery does not prove compatibility.** The launch Node Runtime must meet Harness version requirements even if installation used Node 24.

## Next steps

Priority:

1. Migrate DeepSeek discovery/Windows invocation, retaining loopback lifecycle;
2. Add `withNodeRuntimeOnPath()` to Grok;
3. Reuse `commandInvocation()` in Pi/OMP where useful;
4. Add Windows custom version-manager roots;
5. Show complete paths/sources from `harnessCandidates()` in diagnostics.

## Historical analysis

Earlier exploration mixed native installation discovery with external Harness CLI discovery and included conclusions inconsistent with current code. It moved to:

```text
docs/archive/harness-discovery-pre-2df7058/
```

Archives explain decisions only and are not current behavior or operational configuration.
