# Historical topic: Adapter command discovery before the shared package

> **Archived.** This describes code before `2df7058`.

Before the shared discovery package, Claude Code, Pi, OMP, and Grok Adapters maintained similar but different command searches.

## Common pattern

Implementations usually:

1. Read explicit commands from Adapter options/environment.
2. Expand bare command names to candidates on current `PATH`.
3. Add Windows extensions such as `.EXE` / `.CMD` using `PATHEXT`.
4. Check existence/executability.
5. Search a few Harness-specific/user installation directories.
6. Throw or delay failure until spawn according to Adapter semantics.

This duplicated `pathValue`, `pathCandidates`, `isExecutable`, `nvmCandidates`, `userInstallCandidates`, and `withNodeRuntimeOnPath` across packages.

## Claude Code

The Adapter supported:

- Explicit `command`.
- `CODEX_Z_CLAUDE_COMMAND`.
- Current `PATH`.
- `~/.npm-global/bin`, `~/.local/bin`, `~/.claude/local`.
- NVM version directories.
- `/opt/homebrew/bin`, `/usr/local/bin`.
- Windows `%APPDATA%\npm`.
- Replacement of `claude.cmd` with native `claude.exe` inside the npm package.

Missing executables threw `ClaudeCodeExecutableError`.

## Pi

The Adapter supported:

- Explicit `command`.
- Internal compatibility with `PI_COMMAND`.
- Host Runtime passing explicit command through `CODEX_Z_PI_COMMAND`.
- Current `PATH`.
- `~/.npm-global/bin`, `~/.local/bin`.
- NVM version directories.
- Homebrew and `/usr/local/bin`.
- Windows npm and `.local/bin`.

If discovery failed, it returned `pi` or the explicit command, preserving delayed-failure semantics.

## OMP

OMP discovery was largely the same as Pi. Adapter compatibility used `OMP_COMMAND`; Host Runtime passed explicit command from `CODEX_Z_OMP_COMMAND`. Missing discovery returned `omp` or the explicit command.

## Grok

The Adapter supported:

- Explicit `command`.
- `CODEX_Z_GROK_COMMAND`.
- Current `PATH`.
- `~/.grok/bin`, `~/.local/bin`.
- Homebrew and `/usr/local/bin`.
- Windows npm directories.
- Adapter-owned `.cmd`/`.bat` invocation wrappers.

Missing executables threw `GrokExecutableError`.

## DeepSeek Harness

DeepSeek used a different transport:

1. Connect to loopback DSH Web Host first.
2. If unavailable, search current `PATH` for the explicit command or `dsh`.
3. Search local `npx` next.
4. Start `dsh web` or offline, no-install `npx @deepseek-ai/dsh web`.
5. Wait for HTTP Host readiness.

It duplicated PATH candidates, executable checks, and Windows shim invocation, without other Adapters' user-directory/NVM searches.

## Mechanisms replaced by the shared implementation

`2df7058` added `packages/harness-discovery` to centralize:

- Environment variable reads.
- `PATH` / `PATHEXT`.
- User installation directory templates.
- Node.js version-manager directories.
- Candidate source diagnostics.
- Windows shim invocation.
- Node Runtime PATH completion.

Claude Code, Pi, OMP, and Grok executable discovery migrated. DeepSeek had not migrated. Pi/OMP invocation and Grok Node Runtime PATH completion still had remaining work.
