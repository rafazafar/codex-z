# Grok CLI Adapter integration analysis

## 1. Background

codex-z currently integrates two external Harnesses:

- Pi through official RPC Mode.
- Claude Code through Agent SDK / CLI.

Both implement `HarnessAdapter` and project native Session, Turn, tool, permission, and history semantics into Desktop.

Assess whether Grok CLI can integrate as an independent Harness and whether to use Grok-specific interfaces or ACP (Agent Client Protocol).

Initial conclusions used local CLI `1.0.3`, rechecked against `1.0.4` commands, initialization responses, ACP Diff Content, and installed documentation. Later versions can change extension fields; use runtime discovery/schema checks.

## 2. Main conclusion

Grok CLI can integrate through:

> Standard ACP for live execution, discoverable Grok extensions for enhancements, read-only native files for history facts.

Relationship:

> Grok CLI is an ACP-capable Harness; GrokAdapter communicates with it through ACP internally.

Proposed structure:

```text
Host Runtime
    |
    | codex-z domain semantics
    v
HarnessAdapter
    |
    v
GrokAdapter
    |
    +-- Standard ACP capability mapping
    +-- Grok x.ai/* extension mapping
    +-- Grok History Reader
    |
    v
ACP Client / Transport
    |
    | JSON-RPC 2.0 over stdio
    v
grok agent --no-leader stdio
```

ACP is GrokAdapter's internal protocol. `HarnessAdapter` remains Host Runtime's only domain interface.

## 3. ACP and HarnessAdapter responsibilities

Their responsibilities differ:

| Layer | Responsibility |
| --- | --- |
| `HarnessAdapter` | Common codex-z Thread, Turn, Item, Approval, Usage, Fork, Checkpoint semantics |
| ACP | Common Client/Harness Session, Prompt, Streaming, Tool, Permission, Cancel communication |

GrokAdapter converts `tool_call` / `tool_call_update` before Host Runtime receives them:

- `HostCommandExecutionItem` for verified commands such as bash, with stdout/exit code.
- `HostToolExecutionItem` for generic tools with arguments/readable result text.
- `HostFileChangeItem` only with reliable diffs.

Map `session/request_permission` to `HostApprovalInteraction` and `PromptResponse.stopReason` to `TurnOutcome`.

Keep ACP types/extension fields outside `host-runtime`, `protocol-core`, and Renderer.

## 4. Grok CLI interfaces

### 4.1 Standard ACP RPC

Local stdio mode:

```bash
grok agent --no-leader stdio
```

Confirmed JSON-RPC 2.0 stdin/stdout methods:

- `initialize`
- `session/new`
- `session/load`
- `session/prompt`
- `session/cancel`
- `session/update`
- `session/request_permission`
- `session/set_config_option`

WebSocket Server is also available:

```bash
grok agent serve --bind 127.0.0.1:2419 --secret <token>
```

Prefer stdio for local process integration: no ports, Secrets, or network service; clear lifecycle/failure isolation.

### 4.2 ACP SDK

Use the official TypeScript ACP SDK:

```text
@agentclientprotocol/sdk
```

It provides ACP types, request correlation, reverse permission requests, notifications, cancellation, and connection lifecycle. Grok negotiates ACP v1; implement v1 without assuming v2.

Rust, Python, Go, and Kotlin SDKs are also documented. Prefer TypeScript for the owning Workspace.

### 4.3 Grok ACP extension RPC

Grok provides `x.ai/*` extensions on the same channel, including:

```text
x.ai/session/*
x.ai/rewind/*
x.ai/git/*
x.ai/fs/*
x.ai/terminal/*
x.ai/search/*
x.ai/auth/*
```

Specific methods include:

- `x.ai/session/fork`
- `x.ai/prompt_history`
- `x.ai/compact_conversation`
- `x.ai/session_notification`
- `x.ai/git/diffs`

These are custom ACP RPCs, not another transport. SDKs can send them without complete Grok types. Define local types/runtime schemas for used extensions.

### 4.4 Native Session files

Session location:

```text
~/.grok/sessions/<encoded-cwd>/<session-id>/
```

Main files:

```text
summary.json
updates.jsonl
chat_history.jsonl
rewind_points.jsonl
signals.json
```

Documentation identifies `updates.jsonl` as authoritative recovery content. Read files only for snapshots, stable Turn mapping, and fallback Usage.

Do not mutate files for Fork, Rollback, or configuration. Writes use native RPC/CLI; Grok retains Session ownership.

### 4.5 No dedicated Grok Agent SDK

No dedicated SDK equivalent to `@anthropic-ai/claude-agent-sdk` was found.

Official npm package:

```text
@xai-official/grok
```

It distributes CLI/platform binaries without `main`, `exports`, or TypeScript types; it is not an embedded Agent SDK.

Model APIs, OpenAI-compatible APIs, and `@ai-sdk/xai` lack native Agent Loop, tools, permissions, and Sessions. They would require rebuilding a Harness, outside this integration.

## 5. Capability comparison

| Capability | Codex | Pi | Claude Code | Standard ACP | Grok/native enhancement |
| --- | --- | --- | --- | --- | --- |
| Streaming answers | Native | Yes | Yes | Yes | No enhancement needed |
| Reasoning / Thinking stream | Native | Yes | Yes | Yes | No enhancement needed |
| Tool state | Native | Yes | Yes | Yes | Grok metadata can supplement |
| Edit Diff | Native | Yes | Yes | Tool Content can provide before/after text | Successful terminal state provides reliable ACP Diff Content |
| Question | Native | Yes | Yes | Agent-dependent | Native interactions supplement |
| Tool approval | Native | Yes | Yes | Yes | Preserve native Option IDs |
| Cancel Turn | Native | Yes | Yes | Yes | No enhancement needed |
| Model selection | Native | Yes | Yes | Discover via `configOptions` | `_meta.modelState` Catalog |
| Thinking selection | Native | Yes | Yes | Discover via `configOptions` | `_meta.reasoningEfforts` options |
| Permission modes | Native | No | Yes | Discover via modes/config | Grok defines semantics |
| Usage / context | Native | Yes | Yes | Limited/experimental Usage | `turn_completed.usage`, `signals.json` |
| Resume | Native | Yes | Yes | Yes | Validate history with `updates.jsonl` |
| Full history | Native | Yes | Yes | Replay without sufficient stable IDs | `updates.jsonl`, `summary.json` |
| Thread / Session management | Native | Yes | Partial | Basic negotiation | Grok Session extensions |
| Fork | Native | Any Turn | Any Turn | No ACP v1 common guarantee | Fork by Prompt Index |
| Compaction | Native | Yes | Yes | No common guarantee | Automatic/manual Context Compaction Items; manual `x.ai/compact_conversation` |
| Slash commands | Native | In development | In development | Discoverable, varying execution semantics | Commands extensions |
| Revise/rollback last | Native | Yes | Partial | Insufficient standard support | Verify Rewind semantics |

Standard ACP best covers live core operations:

- Session create/resume
- Prompt
- Streaming Text/Thinking
- Tool lifecycle
- Approval
- Cancel
- Basic configuration

ACP does not guarantee faithful history, arbitrary Turn Fork, Rollback, Unified Diff, complete Usage, or Compaction lifecycle across Harnesses.

## 6. Capability differences between ACP Harnesses

Each Harness can:

1. Implement only some standard capabilities.
2. Declare support through `initialize`.
3. Return modes/configOptions through create/load.
4. Add extension RPCs.

ACP unifies communication, not all business capabilities.

Example:

| Capability | Harness A | Harness B |
| --- | --- | --- |
| Text Prompt | Yes | Yes |
| Image input | Yes | No |
| Session Load | Yes | No |
| Approval | Yes | Yes |
| Fork | Custom extension | No |

Negotiate capabilities and map to `HarnessSessionCapabilities`. Host Runtime need not know whether support comes from ACP, extensions, or native files.

## 7. Proposed architecture

### 7.1 Initial structure

For the first ACP Harness, keep Transport inside Grok Adapter:

```text
packages/adapters/grok/
  src/
    command.ts
    acp-client.ts
    acp-transport.ts
    grok-adapter.ts
    grok-capabilities.ts
    grok-extensions.ts
    grok-history.ts
    grok-models.ts
    grok-usage.ts
```

Responsibilities:

| Module | Responsibility |
| --- | --- |
| `command.ts` | Executable discovery, environment, arguments |
| `acp-client.ts` | SDK connection / JSON-RPC lifecycle |
| `acp-transport.ts` | Standard Session/Prompt/Cancel/Tool/Permission |
| `grok-adapter.ts` | Implement `HarnessAdapter` |
| `grok-capabilities.ts` | Aggregate standard/extension capabilities |
| `grok-extensions.ts` | Used extension RPCs/schemas |
| `grok-history.ts` | Read-only Sessions to `HostThreadSnapshot` |
| `grok-models.ts` | Catalog and Thinking/Effort mapping |
| `grok-usage.ts` | Usage mapping |

### 7.2 Shared structure after multiple ACP Harnesses

After a second real ACP integration, extract genuinely common Core:

```text
HarnessAdapter
├── GrokAdapter
│   ├── Grok Extensions
│   ├── Grok History
│   └── AcpAdapterCore
├── OtherAcpHarnessAdapter
│   ├── Other Extensions
│   ├── Other History
│   └── AcpAdapterCore
├── ClaudeCodeAdapter
│   └── Claude Agent SDK
└── PiAdapter
    └── Pi RPC
```

Shared Core owns only:

- stdio subprocess/ACP connection
- `initialize`
- `session/new` / `session/load`
- `session/prompt` / `session/cancel`
- Text, Thinking, Tool Updates
- Permission Request/Response
- `configOptions`
- ACP errors/process faults

Each Adapter still owns:

- `harnessId`
- Installation/arguments
- Authentication state
- Native configuration semantics
- Snapshots/stable Turn identities
- Usage extensions
- Fork, Rollback, Diff
- Harness-specific RPC

Do not create callback-heavy `GenericAcpAdapter` now. With one Harness it can become a parameterized Grok copy. Extract common code from two real implementations later.

## 8. Capability discovery

Aggregate sources in this order:

```text
initialize.agentCapabilities
             +
session/new or session/load modes/configOptions
             +
Grok initialize._meta
             +
Verified x.ai/* extensions
             |
             v
HarnessSessionCapabilities
```

Rules:

- Do not hardcode capability by version.
- Do not infer permissions from button text.
- Method Not Found does not fault the whole Session.
- Ignore unknown extension fields and reduce support.
- Declare support only after response schema/behavior validation.

Example:

```ts
const capabilities = {
  configuration: {
    selectModel: hasConfigCategory("model"),
    selectThinkingOption: hasConfigCategory("thought_level"),
    selectPermissionMode: hasSessionModes,
  },
  history: {
    fork: true,
    forkAcrossCwd: true,
    rollbackLastTurn: true,
  },
};
```

## 9. Fork and Rollback constraints

Local `grok 1.0.5` verified full/partial Fork through `_x.ai/session/fork` with camelCase arguments on ACP. It is neither standard `session/fork` nor `ext_method` envelope.

Mapping:

```text
Selected Host Turn
    -> Native Checkpoint (Grok Prompt Index)
    -> _x.ai/session/fork
    -> session/load
    -> Create independent Native Session
```

Adapter declaration:

```ts
history: {
  fork: true,
  forkAcrossCwd: true,
  rollbackLastTurn: true,
}
```

`forkAcrossCwd` passes Desktop's new-Worktree branch cwd to Grok. Adapter does not create Worktrees.

Revise-last uses native Rewind:

```text
Current Native Session
    -> Last Host Turn Prompt Index
    -> session/load
    -> _x.ai/rewind/execute { force: true, mode: "conversation_only" }
    -> Same Session ID, one fewer Turn
```

For Rewind, `targetPromptIndex` is exclusive: the last index removes that Turn and later content. One-Turn history can become empty. `force: true` is required; otherwise 1.0.5 returns false without truncation. `conversation_only` preserves disk files. Native history appends `rewind_marker` instead of deleting old updates; mapping must apply markers.

Rewind changes the current Session. Host last-turn permits same identity; Fork/post-Fork require new identity. Native files cannot automatically recover after truncation if Host persistence fails.

## 10. Edit Diff

CLI 1.0.4 provides verified Tool-owned standard Diff Content:

- `type: "diff"`
- Absolute `path`
- Native `oldText`
- Native `newText`

Accept Diff Content only at successful `status: "completed"`. Active updates can have incomplete oldText. Failed/cancelled/nonterminal/invalid/no-op/oversized data stays Tool-only. Generate deterministic Unified Diff from native before/after text, without file reads, Git checks, or tool-name/argument inference.

Only `oldText: null` reliably indicates new files; empty strings mean updates. ACP v1 has no unambiguous deletion, so do not infer delete. Workspace/review diffs are not evidence for a specific Tool/Turn change.

History reconstruction uses the same successful-terminal rule without separate Diff persistence.

## 11. Proposed first-release scope

### Supported

- Installation/authentication classification
- Create/resume/close Native Sessions
- Streaming text/Reasoning
- Tool start/update/complete
- Verified bash/run_terminal_command/kind:execute as Command Execution; generic tools with arguments/readable results
- Tool Approval
- Turn Cancel
- Model Catalog
- Creation Model/Thinking/Effort selection
- Live Model/Thinking changes after capability discovery
- Token, Cache, Reasoning, Context, Cost Usage
- Native history snapshots
- Live/history File Change from successful terminal Diff Content
- Live automatic/manual Context Compaction
- Session faults/process exits

### Not initially supported

- Arbitrary-Turn Fork
- codex-z Rollback Last Turn
- Unambiguous deletion Diff absent from ACP
- Undocumented RPC features
- Native file mutation
- Remote WebSocket Agent

## 12. Required codex-z modules

### Add

```text
packages/adapters/grok/
```

### Host Runtime

- Register `GrokAdapter`.
- Executable environment configuration.
- Package metadata/release bundling.

### protocol-core

- Add `grok` to `ExternalHarnessId`.
- Add native Transport Model ID.
- Configuration encoding/decoding.

### renderer-extension

- Add Agent union/Picker entries.
- Label/icon/installation links.
- Isolated per-Agent configuration preferences.
- Capability-controlled Fork/configuration/Usage UI.

### shared-contracts / harness-adapter

No new shared ACP types initially; keep them in Grok Adapter.

If product chooses end-only Fork display, change history capability instead of Renderer Harness checks.

### Tests

Cover at least:

- Initialization/capability discovery
- Create/resume
- Event projection
- Permission Request/Response
- Cancel
- Model/Thinking Catalog
- Usage mapping
- History projection/stable identities
- Unknown extension/Method Not Found handling
- Missing executable/authentication, exit, protocol errors

## 13. Interface selection principles

Future integration priority:

1. Official complete stable Harness SDK.
2. Officially supported standard ACP.
3. Official RPC extensions for missing capabilities.
4. Read-only native history/metadata.
5. Avoid unpublished internal protocols.

SDK priority applies to complete Harness SDKs. Model APIs do not replace ACP; they lack Loop, tools, permissions, Sessions.

Recommendations:

| Harness | Interface |
| --- | --- |
| Pi | Official RPC |
| Claude Code | Claude Agent SDK / CLI |
| Grok CLI | ACP + extensions + read-only native history |
| Other ACP-only Harnesses | ACP + specific Adapter |

## 14. Final decision

Integration rules:

- Grok is an independent Harness, not Pi Model/Claude Provider.
- Implement `HarnessAdapter`.
- ACP stays internal as primary protocol.
- Standard ACP owns core live communication.
- Discoverable/fallback-capable extensions only.
- Read-only files supply history/fallback Usage.
- Attribute File Change only from successful terminal Diff Content; do not infer Fork/Rollback/deletion.
- Extract shared Core after a second integration.

This preserves common domain semantics and ACP live communication without assuming equal capabilities across Harnesses.
