# DeepSeek Harness integration analysis for codex-z

> Research date: 2026-08-13
> DeepSeek Harness source baseline:[`47f943859bef60e4160492346772ded9b24f765a`](https://github.com/deepseek-ai/deepseek-harness/tree/47f943859bef60e4160492346772ded9b24f765a)
> Status: updated after real local DSH Web Host API validation. Early JSON-RPC/Cordis proposals remain historical analysis, not implementation recommendations. ACP remains outside the main production path.

## 1. Conclusion

Integrate DeepSeek Harness as the third external codex-z Harness, with recommended stable ID `deepseek-harness`. It is a complete Harness with Agent Loop, tools, Sessions, persistence, sandbox, and interactions, rather than only a Model Provider SDK. Official documentation describes a Cordis runtime composed of Model/tool/Skill/Session/sandbox/storage/loop/UI plugins.[Product page](https://www.deepseek.com/harness/) [Plugin documentation](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)

Implemented architecture:

```text
Codex Desktop Renderer
  -> codex-z transport model: codex-z/deepseek-harness-native@...
  -> Host Runtime
  -> @codex-z/harness-adapter contract
       - DeepSeekHarnessAdapter implements HarnessAdapter
       - DeepSeekHarnessSession implements HarnessSession
  -> official loopback DSH Web Host HTTP/WebSocket API
  -> user's local DSH Web profile and official Session Store
```

This preserves the codex-z Adapter layer. Host Runtime depends only on existing `HarnessAdapter`/`HarnessSession`. `DeepSeekHarnessAdapter` owns `inspect/open/close`; its Session owns `readSnapshot/execute/close` and emits standard `HarnessOutput`. DSH Host wire types/event names stay inside the Adapter. Connect to an existing loopback Host first; when unreachable, start locally installed/cached `dsh web`. The Adapter does not maintain Cordis configuration, credentials, Skills, tools, or another Native Transcript.

Official `@deepseek-ai/dsh-sdk-jsonrpc-server` and `@deepseek-ai/dsh-sdk-client` provide newline-delimited JSON-RPC on dedicated stdout, with complete append-only Session events streamed live. This resembles Pi subprocess RPC and fits codex-z's native-interface and faithful-projection principle.[SDK overview](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/README.zh.md) [Protocol definitions](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/protocol/src/types.ts) [Server implementation](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/server/src/server.ts)

The SDK control surface currently contains only `initialize`, `session/prompt`, and `shutdown`. It lacks per-Turn cancellation, individual Session close, history resume/read, Fork, runtime Model changes, permission responses, and Question responses. Handshake has no protocol-version negotiation. Official documentation lists these limits.[Protocol documentation](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/protocol/README.zh.md) [Server limits](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/server/README.zh.md)

Do not wrap the current SDK as a complete Adapter. Proposed steps:

1. First use a formal Gate to prove pinned-runtime startup, execution, persistence, and exit on macOS/Windows.
2. Add a small codex-z control plugin on the DeepSeek side, or extend official SDK protocol with `session/open|resume|read|cancel|close`.
3. Release only capabilities with explicit native semantics in MVP. Enable Fork, Permission Mode, Question, and others later according to protocol support; never simulate success.

## 2. Harness ownership instead of Model Provider integration

A codex-z Harness owns Agent Loop, context organization, tools, permission interactions, and Native Session. DeepSeek fits this definition. `deepseek-official` is a Provider route; `deepseek-v4-flash` is a Model. Adding it to Pi/Claude Code Model Catalogs would:

- Bypass native Session/Event/Persistence.
- Lose tool, sandbox, plugin, compaction, and Subagent semantics.
- Misrepresent `Thread -> Harness` ownership.
- Confuse Provider credentials with Harness installation status.

Use independent `packages/adapters/deepseek-harness`, with Harness-specific wire details in that package only, according to repository[terminology](../../project/terminology.md) and Adapter boundary rules.

## 3. Interface selection

### 3.1 Recommended historical proposal: native SDK JSON-RPC + Session Event

Benefits:

- Strict JSON-RPC stdout and diagnostic stderr suit controlled subprocesses.[Service plugin](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/server/src/index.ts)
- `session.event` streams complete SessionEvent envelopes, not just final text.
- Native `turn/start`, `turn/end`, `assistant/chunk`, `assistant/message`, `tool/call`, `tool/result`, `request/header`, and Usage support stable projection.[Session types](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/types.ts)
- Append-only Native Session logs provide one source for recovery, branching, and replay, consistent with codex-z retaining no second Transcript.[Product description](https://www.deepseek.com/harness/)
- TypeScript SDK clients accept explicit runtime executable, args, cwd, and env, giving clear process lifecycle boundaries.[Client API](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/client/src/api.ts)

Current gaps:

| codex-z Adapter capability | Current SDK | Conclusion |
|---|---:|---|
| Create Session | Lazy creation on first `session/prompt` | Usable; add explicit `session/open` for Native Ref before first Turn |
| Multiple text Turns | Supported | Usable |
| Text/Reasoning stream | `assistant/chunk` | Usable; validate stream fragments against committed messages |
| Tool lifecycle | `tool/call` / `tool/result` | Usable |
| Usage | `assistant/message.usage` | Aggregate/project |
| Cancel Turn | Unsupported | Required before release; UI-only cancellation is invalid |
| Close one Session | Unsupported | MVP can use one process per Session so process close closes Session |
| Read history | Unsupported on wire | Add `session/read`; do not parse private JSONL/compressed formats |
| Resume Session | Core supports it, wire does not | Add `session/resume` calling `ctx.agents.resume()` internally |
| Fork | Core supports it, wire does not | Add later; checkpoints can use completed-Turn event sequences |
| Model discovery/selection | Unsupported on wire | First release uses configured fixed Catalog; add inspect/select later |
| Permission Mode | Native policy/preset exists, wire unsupported | No selectable mode initially; map native presets later |
| Approval/Question | Native services exist, SDK has no bridge | Add server-to-client JSON-RPC request bridge later |

Core already provides recovery/Fork primitives. `ctx.agents.resume()` loads persisted Sessions; `SessionStore.fork()` derives at balanced event boundaries. The main gap is the SDK transport plugin, not the Harness domain model.[Agent Registry](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent/src/index.ts) [Session Store](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/index.ts)

### 3.2 Not recommended: production ACP integration

The built-in ACP bridge supports `session/new`, `session/prompt`, `session/cancel`, and one-time `session/request_permission`, with these explicit limits:

- New Sessions only; no load, resume, list, delete, or Fork.
- Committed assistant text only.
- No live progress, Reasoning, Tool activity, Plan, Title, or Usage on wire.
- No Question, configuration selectors, or Transcript replay.

Source:[ACP documentation and limits](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/acp/acp/README.zh.md)

This conflicts with README native-fidelity goals. ACP is suitable only for:

- Early connection probes.
- Cancellation/approval semantic comparison.
- Experiments before SDK control extensions.

Do not use it as the official `DeepSeekHarnessAdapter` transport.

### 3.3 Historical objection: reuse of DeepSeek Web API

Web Host API Proxy/Typert Remote targets its Client composition. Remote handles unary requests/results only; Session event streams are explicitly outside Remote descriptors.[API Gateway](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.zh.md)

Web-server dependency adds ports, origin/trust fences, browser Host lifecycle, and private API drift. This early proposal argued that codex-z did not need the DeepSeek UI and therefore should avoid this layer.

## 4. Proposed native protocol extensions

Prefer upstream contributions over a long-term codex-z fork. Minimal extensions:

```text
initialize({ clientInfo, protocolVersion })
runtime/inspect() -> providers, models, capabilities, serverInfo
session/open({ sessionId, cwd, provider, model, ... })
session/resume({ sessionId, cwd, provider?, model? })
session/read({ sessionId }) -> header + ordered SessionEvents
session/prompt({ sessionId, contentBlocks }) -> messageId
session/cancel({ sessionId, cause: "user" })
session/close({ sessionId })
shutdown()
```

Second stage:

```text
session/fork({ sourceSessionId, boundarySeq, childSessionId, cwd })
session/selectModel(...)
session/selectPermissionPreset(...)
server -> client: interaction/request
client -> server response: approval or structured question answer
```

Protocol requirements:

- `initialize` negotiates versions. Current unvalidated `serverInfo.version = 0.0.1` has no prerelease compatibility guarantee.
- `session/prompt` messageId proves inbox acceptance only. Establish Turn ownership from subsequent `turn/start`/`turn/end` and idle barrier, not an assumed next assistant message.
- `session/cancel` waits for/proves the Agent's cancelled terminal state, not just request ACK.
- `session/read` returns structured events from `sessionPersistence`/Session API. Do not read JSONL, guess compression, or copy DeepSeek parsers.
- Each interaction has request ID, Session ID, Turn/Tool correlation, and cancellation semantics. Reject unanswered requests according to native rules.
- Unknown Session events with `ignorable !== true` cause protocol errors; preserve facts needed for replay.

## 5. Adapter internal design

Proposed package structure:

```text
packages/adapters/deepseek-harness/
  src/
    deepseek-harness-adapter.ts   # HarnessAdapter/HarnessSession state machine
    transport.ts                  # Subprocess, JSONL-RPC, timeout, close
    protocol.ts                   # Adapter-internal wire schema
    event-mapper.ts               # SessionEvent -> HostEvent
    history.ts                    # SessionEvents -> HostThreadSnapshot
    model-catalog.ts              # Provider/Model opaque refs
    command.ts                    # runtime/config/executable resolution
  test/
```

Keep SDK types outside `shared-contracts`; Host Runtime does not branch by DeepSeek event name. It sees only `HarnessAdapter`/`HarnessSession`.

### 5.1 Process model

MVP proposal: one subprocess per live Native Session:

- `initialize` cwd/provider/model is process-level and cannot represent multiple workspaces/Models correctly.
- One-Session processes map `HarnessSession.close()` reliably to SDK shutdown plus EOF/SIGTERM/SIGKILL escalation.
- Session crashes do not affect other Threads.
- Memory/startup cost increases. Consider shared processes after per-Session open/config support.

Confirm process-tree termination as Pi does. Use Windows `taskkill` or existing helpers and separate macOS process groups. Parse protocol only from stdout; keep bounded sanitized stderr tails.

### 5.2 Native identity

Proposal:

- `harnessId = "deepseek-harness"`
- `nativeSessionId = DeepSeek SessionId`
- `NativeTurnRef.nativeTurnKey = "turn:<native turn number>"`
- `NativeCheckpointRef = completed turn/end event seq`(publish only after Fork protocol support and balanced-boundary validation)
- `NativeSessionRef.locator` stores at most storage domain/profile ID, never Prompts, event bodies, API keys, or arbitrary user paths. Adapter configuration restores Session roots.

`SESSION_FORMAT_VERSION` is still `0`; prerelease source gives no compatibility/migration promise. Pin runtime package family and Session format together. Run old-Session recovery Gates before upgrades.[Session format](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/types.ts)

### 5.3 Event mapping

| DeepSeek Session Event | codex-z Host semantics |
|---|---|
| `turn/start` | `turn.started`; bind accepted Host Turn |
| `assistant/chunk` `text-delta` | `agentMessage` item + `text.append` |
| `assistant/chunk` `reasoning-delta` | `reasoning` item + `text.append` |
| `assistant/message` | Validate/complete current text and Reasoning Items; read Usage |
| `tool/call` | `toolExecution`; verified shell tools can map to `commandExecution` |
| `tool/result` | Complete Tool Item; extract text/image results and failure state |
| `turn/end` | `turn.completed`; map completed/aborted/error/max-tokens/interrupted |
| `compaction/start/end` | Project completed `contextCompaction` Item |
| `request/header/context` | Update effective Model/Thinking; not Transcript Item |
| `approval/*`, `permission/*` | State/audit; interactions require live request bridge, not pending requests inferred from logs |

Two fidelity constraints:

1. `assistant/chunk` is raw Provider streaming; `assistant/message` is the committed assembled message. Retry composition can emit failed partial attempts absent from final text. Exclude retry wrappers producing irreversible partial streams initially, or add Host `text.replace` and strict committed-message reconciliation. Failed attempts must not remain final answers.
2. `tool/call` supplies stable names/raw JSON arguments; `tool/result` supplies Model-visible results/tool-owned `meta`. Project unknown tools faithfully as generic `toolExecution`. Enhance only fixed tested shell/fs tools in codex-z-owned Cordis configuration to `commandExecution`/`fileChange`. Diffs come from structured `meta.diffs` or presentation contracts, never inferred natural-language output.

### 5.4 History

`readSnapshot()` groups full native logs by `turn/start...turn/end` with stable Native Turn Refs. Cover:

- Empty Turns, blocked, max-tokens, error, aborted, interrupted.
- Multiple Steps per Turn.
- Tool call/result pairing and orphan repair.
- Compaction surface replacement.
- `session/end-seed` and plugin events.
- Stable Item/Turn identity across reads.

Native event logs are the only Transcript source. Mapping Store keeps Host/native identities and checkpoint anchors without copying bodies.

## 6. Model, authentication, and permissions

### Model Catalog

SDK has no Model discovery. Initial codex-z-owned deployment declares a small Provider/Model Catalog; do not scan user plugins or hardcode all product Models. Adapter-owned opaque IDs decode internally to `{provider, model}`.

Do not treat `provider=deepseek-official` as Harness ID. Official SDK defaults use route `deepseek-official` and example Model `deepseek-v4-flash`; they remain Provider/Model identities.[SDK client defaults](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/client/src/api.ts)

### Authentication

Official DeepSeek Adapter reads `DEEPSEEK_API_KEY` / optional `DEEPSEEK_BASE_URL`. For official deployment, inspect distinguishes:

- Missing runtime: `notInstalled`.
- Runtime/config startup failure: `unavailable`.
- Missing key/Provider authentication rejection: `authenticationRequired`.
- Protocol/schema incompatibility: `error/protocolError`.

Credentials reach only DeepSeek subprocesses, never Renderer, transport IDs, Mapping Store, or diagnostics.

### Permission

Native approval policy is `ask | never`; only `allowed-once` grants permission. Missing answerers return `unavailable` and reject. Permission Presets also combine sandbox/approval.[Approval service](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/interaction/user-approval/src/index.ts) [Permission Presets configuration](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/config-catalog.zh.md#deepseek-aidsh-permission-presets)

Without live interaction bridges, MVP uses deterministic `never` or controlled tools requiring no approval escalation, with `selectPermissionMode=false`. Do not show selectable modes while approving automatically in the background.

## 7. codex-z change scope

### Protocol Core

Add in [`model-routing.ts`](../../../packages/protocol-core/src/model-routing.ts):

- `DEEPSEEK_HARNESS_NATIVE_TRANSPORT_MODEL_ID = "codex-z/deepseek-harness-native"`
- `deepseek-harness` in `EXTERNAL_HARNESS_IDS`
- transport selection encode/decode
- Create route/tests

Initial configuration carriers need Model only. Do not encode Thinking/Permission before native controls exist.

### Host Runtime

Register in the historical `packages/host-runtime/src/adapter-composition.ts` file (removed from the current tree) and add explicit environment variables:

- `CODEX_Z_DEEPSEEK_HARNESS_COMMAND`
- `CODEX_Z_DEEPSEEK_HARNESS_ENDPOINT`

Sessions use local official DSH Session Store. Mapping Store records only created Native Session IDs; codex-z sets no private Session root.

Update dependencies, tsconfig references, release closure, display names, and generic tests. Replace current Claude/Pi binary `approvalServerName()` logic with full mapping to avoid labeling DeepSeek as Pi.

### Renderer Extension

Current Agent enums and Model/Thinking state hardcode Pi/Claude Code. Add:

- `deepseek-harness` Agent, label, icon, installation URL.
- availability inspection；
- Transport Model detection/injection.
- per-Agent Model state；
- Thread restore/ownership；
- Picker/e2e coverage.

Use `Partial<Record<ExternalRendererAgent, ...>>` for per-Agent selection instead of growing fragile `piModel/claudeModel/...` fields. This bounded integration refactor does not require a generic plugin system.

### Mapping Store

Records already use generic `HarnessId`, `NativeSessionRef`, and opaque locators, so schema upgrade is generally unnecessary. Add recovery, history alignment, archive, delete, and privacy tests. Upgrade only if new locator fields need schema support.

### Release

Pin one prerelease family; do not mix different RCs from npm `latest`/`next`. Research found `@deepseek-ai/dsh` `0.1.0-rc.6` while some SDK latest tags were older RCs. Use exact versions and verify upgrades together.[npm: dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) [npm: sdk client](https://www.npmjs.com/package/@deepseek-ai/dsh-sdk-client)

Development Node 22.19+ (pinned 22.22.0) satisfies `^22.19.0 || >=24.0.0`; packaged private runtime is pinned 24.13.1. Risks concern native/runtime closure and platform tools:

- Official Python bundled runtime lists Linux x64/arm64 and macOS arm64 only, without Windows artifacts.[platforms.json](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/python/sdk-runtime/platforms.json)
- Official coding-agent examples use local bash. Independently compose/test PowerShell, filesystem, and Windows sandbox; do not copy POSIX configuration.[Example configuration](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/examples/jsonrpc-agent/cordis.yml)
- stdout loggers break protocol. Static release configuration Gates prohibit console/stdout loggers.

Release artifacts contain exact-pinned Host API client contracts, not another DSH Runtime or private Cordis configuration. Local `dsh web` profiles own tools, Skills, settings, credentials, permissions, and official Session Store. `CODEX_Z_DEEPSEEK_HARNESS_COMMAND` / `CODEX_Z_DEEPSEEK_HARNESS_ENDPOINT` explicitly override local discovery.

## 8. Implementation stages

### Gate D0: runtime viability without product UI

- Pin packages/use independent temporary Session root.
- Test real JSON-RPC initialize, first/subsequent Turns, Tool, Usage, shutdown.
- Verify macOS arm64/Windows x64 separately.
- Verify clean stdout, sanitized stderr, no remaining process tree, missing-key errors.

Exit condition: real runtime passes on both platforms without source checkout/global profiles.

### Gate D1: protocol control surface

- Implement/contribute version negotiation.
- Implement `session/open|resume|read|cancel|close`.
- Use mock LLM/real persistence for crash/restart, cancellation races, repeated reads, cwd ownership.
- Specify rejection of unknown required Session events.

Exit condition: required create/resume/read/cancel/close use real semantics, without storage-file reads or process kills as ordinary cancellation.

### Gate D2: headless Adapter

- Create `packages/adapters/deepseek-harness`.
- Complete Model inspection, Session state machine, event/history mapping, Usage, error classification.
- Hermetic fake transport tests + real runtime Gate。

Exit condition: two text Turns, streaming text/Reasoning, tools, file changes, cancellation, recovery pass; unimplemented capabilities false.

### Gate D3: Host/Renderer vertical integration

- Protocol route, Host registry, Renderer Agent picker, transport injection.
- New DeepSeek Thread completes first/second Turns.
- Thread ownership, read/resume, archive/delete, app restart recovery.
- Preserve Codex/Pi/Claude Code paths.

### Gate D4: interactions and advanced history

- Two-way Approval/Question bridges.
- Native Permission Presets.
- Fork/checkpoint。
- Add command Catalogs, plugin modes, or other capabilities only with native executable guarantees.

## 9. Main risks

| Risk | Impact | Controls |
|---|---|---|
| Prerelease SDK without negotiation | Wire/Session incompatibility | Exact pins, handshake negotiation, upgrade recovery Gates |
| Missing cancel/resume/read | Cannot satisfy HarnessSession | Extend native plugin before capability release |
| Format still 0 | Old Threads may not resume after upgrade | Pin runtime/format together; fixture migration decisions |
| Raw chunks differ from committed message | Failed retry text remains visible | Restrict composition or add replace/reconcile |
| Tool-owned `meta` | Incorrect diff/terminal classification | Enhance tested fixed-deployment tools only; others generic |
| Per-Session process cost | Multiple-Thread memory/startup cost | Prioritize MVP isolation; evaluate sharing after per-Session config |
| No official Windows bundled runtime | Release blocked | npm closure, native Windows configuration, real-device Gate |
| Plugins can enable stdout logger | Broken JSON-RPC | Immutable owned config, lint, handshake timeout |
| User plugins change capabilities | Unrecognized events/tools | Reject required unknown events, generic tools, no arbitrary-profile guarantee |
| API key leakage | Security incident | Minimal subprocess env, sanitized logs, no Renderer/Mapping Store credentials |

## 10. Proposed minimum product scope

Explicit initial-release limits:

- Included pinned coding deployment.
- Official Provider/configured Models.
- Independent Native Session/process per Thread.
- Text, Reasoning, fixed shell/fs tools, reliable diffs, Usage.
- Create, multiple Turns, cancel, app restart recovery, read/archive/delete.
- No user-custom Cordis profiles.
- No Fork, dynamic plugin UI, arbitrary Providers, Question, or selectable Permission Mode until native controls exist.

This preserves core commitments: one Harness owns each Thread; Native Session is authoritative; Adapter uses native structured events; Host does not infer tool/approval/history semantics.
