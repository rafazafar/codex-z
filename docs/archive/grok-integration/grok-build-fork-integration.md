# Grok Build Fork integration background

This records native Grok Build Session Fork facts for later codex-z `thread/fork` mapping through the Grok Adapter.

## Conclusion

Grok Build exposes Fork to external ACP clients as a custom extension, not a standard method. Local `grok 1.0.5` stdio uses the extension directly as JSON-RPC method with an `_` prefix:

```text
ACP JSON-RPC method: _x.ai/session/fork
```

`ext_method` is an internal abstraction in some ACP implementations, not this stdio method. Sending it returns Method Not Found.

Integration path:

```text
codex-z thread/fork
    -> GrokAdapter
    -> ACP request("_x.ai/session/fork", GrokForkParams)
    -> session/load
    -> New Grok Native Session
```

Grok owns Fork capability. codex-z converts Host Thread/Turn boundaries to native parameters and stores Host Fork mappings.

## Source evidence

This conclusion follows source inspection of public repository `https://github.com/xai-org/grok-build`:

- Repository snapshot：`9fabadea800fa6e2ed8ec91c4f45f02b7e2504f4`
- `xai-grok-shell` crate：`1.0.5`
- ACP handler：[crates/codegen/xai-grok-shell/src/extensions/session_admin.rs](https://github.com/xai-org/grok-build/blob/9fabadea800fa6e2ed8ec91c4f45f02b7e2504f4/crates/codegen/xai-grok-shell/src/extensions/session_admin.rs)
- Fork implementation：[crates/codegen/xai-grok-shell/src/session/fork.rs](https://github.com/xai-org/grok-build/blob/9fabadea800fa6e2ed8ec91c4f45f02b7e2504f4/crates/codegen/xai-grok-shell/src/session/fork.rs)
- ACP dispatch：[crates/codegen/xai-grok-shell/src/agent/mvp_agent/acp_agent.rs](https://github.com/xai-org/grok-build/blob/9fabadea800fa6e2ed8ec91c4f45f02b7e2504f4/crates/codegen/xai-grok-shell/src/agent/mvp_agent/acp_agent.rs)
- Official ACP documentation：[crates/codegen/xai-grok-pager/docs/user-guide/15-agent-mode.md](https://github.com/xai-org/grok-build/blob/9fabadea800fa6e2ed8ec91c4f45f02b7e2504f4/crates/codegen/xai-grok-pager/docs/user-guide/15-agent-mode.md)

Grok Build public source is periodically synchronized from xAI's internal monorepo. Probe methods/fields after updates; version numbers alone do not prove capabilities.

## External transports

### stdio ACP

```bash
grok agent --no-leader stdio
```

stdio currently best suits codex-z. ACP JSON-RPC uses stdin/stdout without local ports.

### WebSocket ACP Server

```bash
grok agent serve --bind 127.0.0.1:2419 --secret <token>
```

These commands use installed `grok`. WebSocket requires Secret authentication and suits independent Agent Servers; it is not preferred for local Adapters.

## ACP Fork request

Use `_x.ai/session/fork` as JSON-RPC method with arguments directly in `params`, without another `{ method, params }` wrapper:

```json
{
  "jsonrpc": "2.0",
  "id": "fork-1",
  "method": "_x.ai/session/fork",
  "params": {
    "sourceSessionId": "parent-session-id",
    "sourceCwd": "/workspace/project",
    "newCwd": "/workspace/project",
    "newSessionId": "optional-child-session-id",
    "newModelId": "optional-model-id",
    "targetPromptIndex": 3,
    "sessionKind": "fork"
  }
}
```

Field semantics:

| Field | Required | Description |
| --- | --- | --- |
| `sourceSessionId` | Yes | Source Native Session ID |
| `sourceCwd` | Yes | Source cwd for locating local Session files |
| `newCwd` | Yes | Child Session cwd |
| `newSessionId` | No | Explicit child ID; Grok generates UUIDv7 if omitted |
| `newModelId` | No | Child Model override; inherits source if omitted |
| `targetPromptIndex` | No | Zero-based inclusive Prompt boundary; omitted means full current history |
| `sessionKind` | No | Summary Session type; default `fork` |
| `sourceWorkspaceDir` | No | Source workspace for Worktree Fork |

Use camelCase wire fields, not Rust names such as `source_session_id`.

## ACP Fork response

Main response shape:

```json
{
  "newSessionId": "child-session-id",
  "chatMessagesCopied": 12,
  "updatesCopied": 12,
  "planStateCopied": true,
  "newCwd": "/workspace/project",
  "parentSessionId": "parent-session-id",
  "newModelId": "grok-model"
}
```

`newModelId` can be omitted without a Model override.

Some transports wrap extension responses in JSON-RPC `result`; others expose raw payload. Support both:

```json
{"newSessionId":"child"}
```

and:

```json
{"result":{"newSessionId":"child"}}
```

Missing `newSessionId` or an `error` means Fork failure.

## Load is required after Fork

`x.ai/session/fork` copies/persists data without starting a Session Actor. After success, call standard ACP `session/load`:

```json
{
  "jsonrpc": "2.0",
  "id": "load-child-1",
  "method": "session/load",
  "params": {
    "sessionId": "child-session-id",
    "cwd": "/workspace/project",
    "mcpServers": []
  }
}
```

Required order:

```text
1. Call x.ai/session/fork
2. Validate newSessionId
3. Call session/load(newSessionId)
4. Send subsequent prompts to child Session
```

If Fork succeeds but load fails, return an explicit error and retain `newSessionId` for diagnosis. Do not report an opened child Session.

## Data copied by Grok

Native `JsonlStorageAdapter::copy_session_data_sync` creates a new directory and copies:

- `chat_history.jsonl`
- `updates.jsonl`
- `summary.json`
- plan state
- plan mode state
- signals
- tool state
- announcement state
- compaction segments
- Compaction checkpoints referenced by copied updates

Child summary contains:

- New Session ID
- New cwd
- `parent_session_id`
- `forked_at`
- `session_kind`, default `fork`
- New Model or inherited source Model

This is Harness-owned copying. codex-z does not implement Fork by copying/modifying `~/.grok/sessions` itself.

## Fork at a history position

Native ACP Fork supports `targetPromptIndex`:

- `0` retains history through the first Prompt boundary.
- Zero-based and inclusive.
- Chat history truncates at that position.
- Updates copy through the same position.
- Result is a new independent Native Session.

Do not describe Grok as supporting only end-of-history Fork. Accurate statement:

> Native `x.ai/session/fork` supports full/partial history by Prompt Index. Official TUI `/fork --at <turn>` still rejects `--at`; CLI UI has not exposed it.

Convert Host Fork boundaries to Grok `targetPromptIndex`:

```text
Host Turn ID
    -> Grok Native Turn / Prompt Index
    -> targetPromptIndex
    -> x.ai/session/fork
```

Host Turn IDs are not Prompt indexes. Use Adapter history mappings; reject missing mappings, cross-Session references, or unfinished boundaries.

## cwd and Worktree

Separate `sourceCwd`/`newCwd` allow children in another directory. Ordinary Fork rewrites copied cwd paths; Worktree Fork uses `sourceWorkspaceDir` to preserve original workspace semantics.

Verify separately for initial integration:

1. Same-cwd Fork without Worktree.
2. Different-cwd Fork.
3. Worktree Fork.
4. Fork from an existing Worktree Session.

Pass Desktop-prepared target cwd as `newCwd`. For different directories, use `sessionKind: "worktree"` and `sourceWorkspaceDir`; inherit original workspace from a Worktree source. This field does not replace Host target-directory validation. Adapters do not create/delete Git Worktrees.

## Official CLI and ACP differences

Official CLI supports:

```bash
grok --resume <session-id> --fork-session
grok --continue --fork-session
grok --resume <session-id> --fork-session --session-id <child-id>
```

Official `/fork` also supports:

```text
/fork
/fork --worktree
/fork --no-worktree
/fork <directive>
```

Official TUI currently rejects:

```text
/fork --at <turn>
```

This is a CLI UI limit, not absence of ACP `targetPromptIndex` support.

## SDK and other RPC boundaries

### ACP SDK

Official ACP SDKs such as TypeScript `@agentclientprotocol/sdk` connect/send custom requests. They provide ACP communication, not Grok Fork types/business semantics.

Adapter defines:

- `GrokForkParams`
- `GrokForkResponse`
- Runtime parameter validation
- Runtime response validation
- Method Not Found/business error mapping

### Internal Grok Rust API

Source contains an internal Rust API:

```rust
xai_grok_shell::session::fork_session(
    request: ForkSessionRequest,
    agent_id: &str,
    auth_manager: Option<Arc<AuthManager>>,
) -> io::Result<ForkSessionResponse>
```

`ForkSessionRequest` / `ForkSessionResponse` are re-exported from `xai-grok-shell::session`, but are internal crate APIs, not a stable cross-language SDK. TypeScript Adapters cannot depend on them.

### Internal Sandbox REST Client

Source also contains an internal HTTP client:

```text
POST {base_url}/sandbox/sessions/fork
```

`SandboxClient::fork_session` uses internal xAI authentication headers and `SandboxForkRequest` / `SandboxForkResponse`. It is not documented as a stable public Agent API; do not depend on this endpoint.

### Workspace RPC

`SessionLifecycleRequest::Fork` in `xai-grok-workspace-types` manages local Workspace/Subagent lifecycle and copies tools, environment, capabilities, and Worktree context. It does not replace persistent conversation Fork through `x.ai/session/fork`.

## codex-z Adapter integration requirements

### Transport layer

Add Grok-specific extensions in `packages/adapters/grok/src/acp-transport.ts`, or a Grok-only extension request method owned by the Adapter:

```ts
const response = await connection.request<GrokForkResponse, GrokForkParams>(
  "_x.ai/session/fork",
  params,
);
```

Use current SDK generic signatures, but always wire `_x.ai/session/fork` with unwrapped camelCase parameters.

### Adapter layer

Minimum Fork flow:

1. Parse source Thread, target cwd, and boundary from Host request.
2. Find source Session ID in native history.
3. Resolve `targetPromptIndex` from `grok-history.ts` Host Turn mapping.
4. Validate target cwd, Session ID, boundary.
5. Call `x.ai/session/fork`.
6. Validate `newSessionId` / parent-child relationship.
7. Load child with `session/load`.
8. Close/release old Transport and establish child state.
9. Persist Host `forkSource`, including source Thread/Turn IDs.
10. Verify first child snapshot matches boundary before returning success.

### Capability

Current Adapter declaration:

```ts
history: {
  fork: true,
  forkAcrossCwd: true,
  rollbackLastTurn: true,
}
```

`forkAcrossCwd` binds Native Session to Desktop-prepared cwd; Desktop still creates Worktrees. Method Not Found, failed Prompt mapping, or mismatched loaded history rejects that Fork. Do not report opened children.

Fork does not imply Rollback. Grok revise-last uses `_x.ai/rewind/execute` on the current Session without children. Do not implement last-turn rollback as Fork merely because Prompt indexes exist.

## Required tests

### Protocol tests

- JSON-RPC method `_x.ai/session/fork`.
- No `ext_method` outer envelope.
- camelCase request fields.
- Correct zero-index transmission.
- Correct optional omissions/overrides.
- Parse raw/result-wrapped responses.
- Reject missing `newSessionId`.
- Method Not Found means unsupported Fork without corrupting Session.

### Semantic tests

- Full-history Fork.
- Partial history at Prompt index.
- New child Native Session ID.
- Child summary records parent ID.
- Child history/updates stop at boundary.
- Load after Fork.
- First child Prompt executes.
- Source unchanged.
- No incorrect mappings on failure.
- Diagnosable load failure after successful Fork.
- Separate cwd/Worktree checks.

### Version compatibility tests

After each version change, verify at least:

- ACP v1 declaration.
- Fork method routing.
- Parameter/response fields.
- Prompt-index boundaries.
- Loaded history replay.
- Native Prompt/Turn mapping.

## Final boundaries

Supported dependencies:

- Standard ACP `initialize`, `session/new`, `session/load`, `session/prompt`, `session/cancel`.
- Grok Fork extension with runtime schema checks.
- Read-only native files for identity/boundary mapping.

Unsupported dependencies:

- Standard generic Fork: ACP has no common Fork method.
- Grok public Agent SDK: none found stable.
- Internal Sandbox REST endpoint.
- Direct mutation of native files.
- Workspace/Subagent Fork as conversation Fork.

Implementation conclusion:

> Grok Build exposes Fork through `_x.ai/session/fork` on ACP JSON-RPC, not a public Grok SDK or standard ACP method. It supports full/partial history by native Prompt Index. Load the child after successful Fork.
