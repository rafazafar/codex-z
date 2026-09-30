# OpenCode Harness integration research

> Current implementation supports CLI v1 and v2. Validated baselines: v1 `1.18.25`, v2 `2.0.16`. Original SDK/HTTP analysis below uses v1; old `/v2` exports do not mean CLI 2.x support.

> DeepSeek comparisons preserve the research baseline. Legacy was later removed; the then-current supported managed Web versions were `0.1.2-rc.1` / `0.1.5-rc.1`. See current [connection flow](../../architecture/harness-executable-discovery.md#deepseek-specifics) and [recovery](../deepseek/dsh-edit-recovery.md).

This document records design, official capability evidence, and the first `codex/opencode-harness` branch. It separates existing official APIs, implemented behavior, declared capabilities, and required real Gates. Types/endpoints alone do not prove platform support.

## Dual-version integration and maintenance scope

One Harness ID/preinstalled plugin remains. `versioned-adapter.ts` reads actual CLI `--version` on inspect/open and selects native implementation. Open Sessions keep their original executable. Unknown majors/unrecognized output fail without old-protocol fallback.

| CLI | Native client | Implementation |
| --- | --- | --- |
| v1 | `/v2/client` from `@opencode-ai/sdk@1.18.25` | Existing opencode-adapter.ts/sdk-transport.ts modules, compatibility and required fixes |
| v2 | Promise client `@opencode/client@2.0.16` | `src/v2/` connection/Session/history/interaction/configuration modules, future feature mainline |

Version/protocol/state conversion stays in Adapter, without public Host/Renderer branches. Both share discovery, Model/Thinking encoding, permissions/commands. v2 execution events are not disguised as v1 messages.

Default discovery selects opencode. With both installed, use `CODEX_Z_OPENCODE_COMMAND`. This selects execution environment, not live Thread protocol switching. Reconnect Host to apply environment changes.

v1 refs remain. v2 locator adds `protocol: 2` with public formatVersion 1. Resume/Fork/Rollback must match major versions; mismatch preserves records and requests matching installation. codex-z neither migrates databases nor promises interchangeability.

### Native v2 semantics and limits

- Each Session owns a foreground loopback serve process with random password/native username opencode, not shared backends. Close/start failures reclaim it. Native OpenCode reads configuration/authentication.
- Listener readiness does not mean config plugins are active. Before catalog reads, bounded waits confirm opencode.config.provider/agent/policy to avoid startup-empty cache. Maintain probes with client versions.
- Native inbox admits Prompts. session.execution.* and durable idle determine outcomes; HTTP/text-end/interrupt acknowledgements are not terminal. Existing execution is not adopted.
- Transient text/Reasoning streams project live; tools/history/terminal states validate durable messages. Cancel can leave transient text without text.ended, so final history may omit displayed text. Fabricate no persistence.
- Traverse cursor pages. Added user inputs within one execution share a Turn. Fork uses native before; derived IDs are authoritative. Check semantic prefix/source/configuration/cwd. Rollback forks away the last Turn without file rollback.
- Support once/deny, native Questions, flat string/number/boolean/multiple-choice Forms. Validate before reply. External/hidden/conditional Forms fail and stop execution without automatic answers.
- Support Model/Thinking/permissions/compact and cumulative native Tokens/cost. Do not additionally claim full background Turns, child observation, import, or complex Forms.

### Validation method

Run `npm run build:typescript`; set `CODEX_Z_OPENCODE_REAL_COMMAND` separately to absolute v1/v2 paths and run through tests/vitest.config.js:

- `packages/adapters/opencode/test/opencode-adapter.real.test.ts`: Isolated Model/Thinking/permission selection/cold resume without Model calls.
- `packages/adapters/opencode/test/opencode-adapter.rollback.real.test.ts`: Local fake Model/real CLI for approval, Questions, edits, Diff, exact Fork/Rollback/compact, source preservation/cold resume.
- `tools/gate-opencode/cancel.real.test.mjs`: Real streaming cancel/follow-up/no overlap/warm-cold history.

Unit tests cover version/cross-generation rejection, pagination/config activation, admission/stream races, cancel/late events. Release checks include both clients in relocatable plugin Bundles, absent from Host, and complete licenses. Real validation used macOS arm64, isolated directories, and loopback Models, not Windows/Linux/SSH/real accounts/Desktop GUI acceptance.

v1 Fork also fixed sourceItemIds comparison: derived FileChange refs are new-Session Part identities, not semantic differences. Input/output/patch/results/current configuration remain checked.

The following sections retain v1 evidence/analysis.

## Conclusion

Prefer a managed loopback `opencode serve` with fixed tested `@opencode-ai/sdk/v2`, rather than TUI parsing, run-json-only, or ACP-only integration:

- First use Session/SSE/Question/Permission/Diff/Fork/Revert/Compact/Abort and project full Harness semantics.
- SDK/v2 includes current APIs and client.v2.*, enabling later features without transport replacement.
- Durable events/replay/queue/steer/idempotent admission/staged revert suit integration, but official parity gaps require experimental capabilities before execution replacement.
- ACP is standard compatibility/MVP but loses Questions, some control, and events through SDK projection.
- experimental_workspace may later register local/remote workspaces through an optional plugin; basic Adapter must not depend on it.

Recommended topology:

```text
codex-z host-runtime
  └─ OpenCode Adapter
      ├─ Start/supervise opencode serve
      ├─ health + version + OpenAPI capability handshake
      ├─ OpenCodeServerTransport (explicit executable, loopback, Basic Auth)
      ├─ @opencode-ai/sdk/v2 client
      │   ├─ client.session.*       Current execution/control
      │   ├─ client.event.*         Live SSE
      │   ├─ client.question.*      Native Questions
      │   ├─ client.permission.*    Native Approvals
      │   └─ client.v2.*            Experimental durable/replay/queue
      └─ HarnessSession / HarnessEvent / Interaction mapping
```

## First-branch implementation

The branch registered independent opencode. Production path:

```text
OpenCodeAdapter
  -> OpenCodeServerConnection
     -> opencode serve --hostname=127.0.0.1 --port=0
     -> Random Basic Auth per startup
     -> Bounded stderr/process-tree shutdown/restart after faults
  -> SdkOpenCodeTransport
     -> @opencode-ai/sdk/v2/client
     -> Session API + SSE
```

Implementation is in [`packages/adapters/opencode`](../../../packages/adapters/opencode), integrated with:

- Baseline Host composition, explicit CODEX_Z_OPENCODE_COMMAND, release dependency closure;
- Protocol Core codex-z/opencode-native carrier;
- Renderer picker/draft Model/Thinking/ownership/icon;
- Streaming text/Reasoning/tools, Questions, once/deny, cancellation, Usage, full Diff, commands/compact/Models/variants;
- Transcript Snapshots/exact checkpoints/reconnection status-message-pending reconciliation;
- Source-preserving native Fork rollback; editing retains files and validates history/config/source. Revert exists but is not used for edits.

Declared behavior and remaining exclusions at this branch:

- Default execution policy keeps native Questions/once/deny;
- default/ask/allow permission modes use native Session PermissionRuleset and persist through resume; allow is dangerous;
- unattended-full-access requires allow and injects native permission: allow per managed Server, without shared always rules;
- build/plan are Agents, not permissions;
- cross-cwd Fork, Subagent identity/transcript;
- Durable replay/queue/steer/idempotent admission/staged revert are not declared;
- experimental_workspace remains later enhancement.

Production imports only SDK/v2/client. Top-level v2 also bundles createOpencodeServer/cross-spawn and duplicates owned process supervision.

Recorded results (full validation still needs rerun after admission-race fix):

| Validation | Result |
| --- | --- |
| Repository TypeScript build/test typecheck | Passed |
| Hermetic Adapter/transport/model/history/usage tests | Passed |
| Repository Vitest including other Harnesses/Renderer | Passed |
| ESLint/package boundaries | Passed |
| Host release audit/build | Passed |
| Isolated 1.18.25 smoke | inspect/create/read/command list/close/resume passed, no paid/external Model |
| Git-backed Gate | Loopback fake Model, real edit/stream/tools/Diff/exact Fork/source-preserving rollback/cold resume; see edit-recovery notes |
| Cleanup | No managed serve process remained |

Smoke fixed macOS /var vs /private/var realpath resume/Fork rejection. Desktop launch and installed 1.18.4 were not covered.

## Versions and runtime validation

Original local opencode (user directory anonymized):

```text
<original-user-home>/.nvm/versions/node/v24.18.0/bin/opencode
1.18.4
```

Latest at research time: 1.18.25:

- [GitHub Release v1.18.25](https://github.com/anomalyco/opencode/releases/tag/v1.18.25)
- npm `latest`: `opencode-ai@1.18.25`
- npm `latest`: `@opencode-ai/sdk@1.18.25`
- npm `latest`: `@opencode-ai/plugin@1.18.25`

Download was temporary without replacing local 1.18.4:

- Official arm64 CLI: `/private/tmp/codex-z-opencode-v1.18.25-UZLrC3/extracted/opencode`
- ZIP SHA-256: `606b09722d98069605e16037fb8c3c7c8ebbfed9ba713079a5efb2e5b065ae27`
- Source v1.18.25: `cb7d8b2f5e44876ef98b661dc10590c915af3a9f`
- Isolated Server/OpenAPI directory: `/tmp/opencode-runtime.SUbAqe`

Temporary Server at 127.0.0.1:49096:

| Check | Result |
| --- | --- |
| GET /global/health | healthy true, 1.18.25 |
| `GET /api/health` | `healthy: true` |
| GET /doc | OpenAPI 3.1.0, 162 paths |
| Current API | /session and /event |
| Native V2 API | /api/session and /api/event |
| /event | SSE first server.connected |
| /api/event | SSE first server.connected plus heartbeat comments |
| Session persistence | V1/V2 Sessions readable after restart |
| Database | SQLite data/opencode/opencode.db |

Additional compatibility probes:

- SDK 1.18.25 with Server 1.18.4 succeeded for health/agents/providers/Questions/Permissions. Pin SDK, but inspect health/OpenAPI/methods instead of patch-only rejection.
- New SDK added two noReply inputs to isolated 1.18.4 and forked before the second ID. Source had two, candidate one; then deleted temporary Sessions. This proves exact boundary on that Server, not every minimum version.

ACP initialize passed on both versions. 1.18.25 with ACP SDK 1.3.0 also passed list/new/config/close, with Models, build/plan, and offered effort/variants.

See [OpenAPI](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/sdk/openapi.json). Probed Servers were stopped with no listeners retained.

## Existing integration patterns

Renderer does not read native wire protocols. All implement [`HarnessAdapter / HarnessSession`](../../../packages/harness-adapter/src/text-session.ts) for Turns/Items/Questions/Approvals/Usage/Subagents/checkpoints/history. Baseline registration was adapter-composition.ts; later [`harness-plugin-loader.ts`](../../../packages/host-runtime/src/harness-plugin-loader.ts). [`model-routing.ts`](../../../packages/protocol-core/src/model-routing.ts) owns routes.

Five representative baseline forms:

| Harness | Native entry | Integration | Characteristics |
| --- | --- | --- | --- |
| Pi | pi --mode rpc | Per-active-Session private JSON RPC plus native file history/Fork/Rollback | Model/Thinking/Usage/tools/extension questions; no permission modes |
| OMP | omp --mode rpc | Similar transport, distinct native history | Adds child observation/transcripts at baseline |
| Claude Code | Agent SDK | Explicit CLI query/partials/canUseTool | Models/Thinking/permissions/interrupt/children/Usage, native Transcripts for Fork/history |
| Grok | grok agent --no-leader stdio | ACP plus native extensions | Standard prompt/update/permissions/cancel with native history/Fork/Rewind/compaction |
| DeepSeek Harness | dsh web/loopback | Historical Host API HTTP/WebSocket, optional managed Web | Server topology resembles OpenCode; baseline declarations lacked Fork/Rollback/questions/approval |

Source evidence:

- Pi: [`pi-rpc-session.ts`](../../../packages/adapters/pi/src/pi-rpc-session.ts), [`pi-adapter.ts`](../../../packages/adapters/pi/src/pi-adapter.ts)
- OMP: [`omp-rpc-session.ts`](../../../packages/adapters/omp/src/omp-rpc-session.ts), [`omp-adapter.ts`](../../../packages/adapters/omp/src/omp-adapter.ts)
- Claude Code: [`sdk-transport.ts`](../../../packages/adapters/claude-code/src/sdk-transport.ts), [`claude-code-adapter.ts`](../../../packages/adapters/claude-code/src/claude-code-adapter.ts)
- Grok: [`acp-transport.ts`](../../../packages/adapters/grok/src/acp-transport.ts), [`grok-adapter.ts`](../../../packages/adapters/grok/src/grok-adapter.ts)
- DeepSeek: historical `packages/adapters/deepseek-harness/src/host-client.ts` (removed with the legacy Host API); current owner: [`deepseek-harness-adapter.ts`](../../../packages/adapters/deepseek-harness/src/deepseek-harness-adapter.ts)

Baseline fidelity comparison: Yes means implemented then; Feasible means native evidence pending Gates.

| Path | Question | Approval | Exact Fork | Last-Turn Rollback | Child identity/transcript |
| --- | --- | --- | --- | --- | --- |
| Pi RPC | Yes | No separate approval | Yes | Yes | No |
| OMP RPC | No | No | Yes | Yes | Yes |
| Claude SDK | Yes | Yes | Yes | Yes | Yes |
| Grok ACP/extensions | No | ACP | Extension | Extension | No |
| DeepSeek Host API | No | No | No | No | No |
| OpenCode ACP | No | ACP | No message boundary | No undo/redo | Mainly tools |
| OpenCode Server/SDK | Feasible | Feasible | Feasible | Feasible, modifies files if Revert used | Feasible, native child Session IDs |

OpenCode combines DeepSeek-like Server topology, Claude-like SDK controls, and Grok-like ACP compatibility. Use independent packages/adapters/opencode; do not expose native types in shared-contracts or copy all Grok.

## Programmable interface comparison

| Interface | Transport | Coverage | Role |
| --- | --- | --- | --- |
| serve + SDK/v2 | HTTP/SSE, some V2 PTY WebSocket | Most complete; APIs coexist | Main integration |
| acp | stdio JSON-RPC/NDJSON | Standard Session/Prompt/Permission/Diff, loses private features | Compatibility/MVP |
| run --format json | stdout events | Simplified events/interactions | Smoke/headless fallback |
| Plugin/custom tools | In-process extension | Tools/auth/hooks/workspaces | Optional enhancement |

No other documented private JSON-RPC Harness exists. Server is resource-based HTTP RPC/OpenAPI; ACP is actual standard JSON-RPC.

Provider API integration bypasses OpenCode loop/tools/permissions/questions/Sessions/plugins/rules/snapshots. It supplies model transport, not Harness semantics.

## Why Server plus SDK

### Public versioned SDK boundary

Official SDK exports:

- `@opencode-ai/sdk`
- `@opencode-ai/sdk/client`
- `@opencode-ai/sdk/server`
- `@opencode-ai/sdk/v2`
- `@opencode-ai/sdk/v2/client`
- `@opencode-ai/sdk/v2/types`

Evidence: [package.json](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/sdk/js/package.json), [SDK docs](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/web/src/content/docs/sdk.mdx).

SDK/v2 exposes session/question/permission plus client.v2 and directory/workspace header/query handling. Start with mature execution and progressively gate V2 without duplicate transports.

SDK implementation/generated code:

- [`packages/sdk/js/src/v2/client.ts`](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/sdk/js/src/v2/client.ts)
- [`packages/sdk/js/src/v2/gen/sdk.gen.ts`](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/sdk/js/src/v2/gen/sdk.gen.ts)
- [`packages/sdk/js/src/v2/gen/types.gen.ts`](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/sdk/js/src/v2/gen/types.gen.ts)

Official ACP imports SDK/v2 too, confirming SDK/Server as native underlying capability.

### Process ownership and trust

codex-z should own startup/health/exit/restart:

1. Select loopback ports per instance.
2. Generate OPENCODE_SERVER_PASSWORD; never start password-free.
3. Keep auth headers in Adapter memory, not Renderer/logs/Thread metadata.
4. Check global/api health/doc for actual version/capabilities.
5. Pin tested SDK; use minimum version/OpenAPI/method probes, fail closed or degrade, not version-string-only checks.
6. Reconnect SSE first, then reconcile status/messages/pending interactions.

[Server docs](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/web/src/content/docs/server.mdx) covers authentication/OpenAPI. 1.18.25 warns on password-free startup.

SDK [createOpencodeServer](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/sdk/js/src/v2/server.ts) hard-codes PATH without explicit executable/random authentication. Implement a small transport using discovery/bounded stderr/cross-platform tree shutdown, giving Adapter connected createOpencodeClient only.

Initial shared-per-Host Server was rejected for Session environment/policy isolation. Current topology is one managed Server per OpenSession. Shared hosting remains experimental; do not start per Turn or expose ports to Renderer.

SSH launches on remote workspace machine at remote loopback without local forwarded ports. Windows needs tree termination, not parent-only close.

## Current API capabilities

Routes: [session.ts](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/server/routes/instance/httpapi/groups/session.ts). SDK methods:

- Lifecycle: list/create/get/update/delete/status/children/todo.
- Transcript: `messages`, `message`.
- Execution: prompt/promptAsync/command/shell.
- Control: fork/abort/summarize/revert/unrevert.
- Files: diff.
- Events: event.subscribe for /event, global.event for /global/event.

Structured interactions:

- Questions: list/reply/reject; [routes](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/server/routes/instance/httpapi/groups/question.ts).
- Permissions: list/reply; [routes](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/server/routes/instance/httpapi/groups/permission.ts). Use /permission/{requestID}/reply, not deprecated Session-scoped response.

Preserve native interactions rather than chat-text simulation. Mapping:

| OpenCode | codex-z projection |
| --- | --- |
| message/part text delta | assistant text event |
| reasoning delta | reasoning event |
| tool part pending/running/completed/error | tool lifecycle event |
| permission asked/replied | Approval interaction |
| question asked/replied/rejected | Question interaction |
| session status | busy/idle/error lifecycle |
| `session.diff()` | file-change/diff projection |
| `session.abort()` | cancel turn |
| `session.fork()` | Harness session fork |
| `session.summarize()` | compact |
| `session.revert()` / `unrevert()` | rollback / restore capability |

### Turns, streams, and completion

Subscribe before submission but do not inject Host-generated native messageIDs. 1.18.4 orders User/Assistant by sortable native IDs; random UUIDs break ordering and can continue loops after finish=stop. promptAsync omits messageID, then binds native IDs from events/history; only Assistant Parts whose parentID matches may project. Native ACP registers idle waiters before requests; idle follows Turn events. Evidence: [acp/event](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/acp/event.ts#L54-L74), [status](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/session/status.ts#L39-L48).

HTTP 204, one delta, or temporary silence is not completion. Require:

1. Target Session transitions busy → idle;
2. Matching Assistant has completed/finish or explicit error;
3. Tool/reasoning/text final projections finish.

MessageAbortedError maps to cancelled only after Host cancel; other errors fail; error-free idle succeeds. Disconnect pauses completion until status/messages/interactions reconcile, without guessed outcomes.

Snapshots use durable messages/Parts, not transient SSE. A Turn includes one user and subsequent assistant/compaction/tools until next user. Native IDs prevent duplicated UI after reconnect. Save Model/Thinking in namespaced metadata and publish only after native success, preserving other metadata and selections even before next input.

### Adapter internal responsibilities

opencode-adapter.ts is a Session façade for four atomic state-machine responsibilities: admission/completion, event/interaction projection, state/Usage, and history/reconnect. Server/SDK moved to separate modules; do not yet split shared ActiveTurn/admission-buffer/closure/exactly-once invariants into objects. Future splits need observable HarnessSession seams/order contracts, not event buses/global mutable state.

About 1,840 lines is a design-review signal, not completed structural optimization.

### Question and Approval fidelity

Native question batches contain options/multiple/custom and optional messageID/callID. Map choice/custom to allowOther. No secret/multiline semantics are claimed. See [schema](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/schema/src/v1/question.ts).

Wire once/always/reject has a crucial scope: always is shared process-memory approved rules, not persistent or Session-bound. It is neither allowAlways nor strict allowForSession under shared hosting. First version:

- Support allowOnce/deny directly;
- For session approval, retain Adapter Session rules and reply once on matching calls, preventing cross-Session leakage;
- No allowAlways/user opencode.json changes without auditable persistent-policy design.

Reconcile asked/replied/rejected with lists. Close responses and cancel/exit/disappeared requests as cancelled/superseded; never leave UI pending.

### Agent, Model, Thinking, and Permission Mode

build/plan/custom Agent, providerID/modelID, variant/effort, and permission rules are distinct even when ACP groups them in configOptions.

HarnessSessionCapabilities has Model/Thinking/permissions but no Agent selection. Recommendation:

- Model: provider catalog → HarnessModelRef, supplied each V1 Prompt;
- Thinking: only explicitly offered, validated variants;
- Permissions: default/ask/allow native rules, never build/plan;
- Agent: native default first; add independent public capability or clearly named command for later selection.

V2 switchAgent/switchModel cannot replace stable V1 parameters before parity Gates.

### Exact Checkpoint Fork and Rollback

Session.fork copies messages **before** messageID and sets no parentID. parentID is Task lineage, not Fork lineage.

For exact completed-Turn Fork:

1. Save last Assistant ID as checkpointId;
2. Reread source and find the next message;
3. Use its exclusive boundary, or omit for the tail;
4. Verify count/final checkpoint; delete failed candidate and return checkpointNotFound/nativeFailure.

Like Pi's next-user-entry boundary. ACP lacks checkpoint/message arguments and cannot express exact Fork.

First-version forkAcrossCwd false: old message paths persist, files are not copied. Require history/tool-path/file Gates before enabling.

rollbackLastTurn forks before final user, preserving source/files and checking full prefix/Diff/configuration. Empty candidates persist Model/Thinking/permissions for recovery. Failure deletes only independent owned candidates, never unrevert. See [edit recovery](opencode-edit-recovery.md).

### Diff, Usage, and Subagents

Prefer session.diff(messageID). Host requires path/kind/unified diff; optional native file/status/patch needs validation. Do not infer paths/patches from counts. Reconcile missing fields with Parts; without full data, claim no FileChange.

Usage comes from assistant tokens.input/output/reasoning/cache.read/cache.write/cost; context limit from actual Model limit.context. Recommendation:

- Current context = latest input + cache reads + writes;
- Total Session cost = sum Assistant costs;
- Preserve raw Tokens; Provider USD estimates are not bills;
- No plan-window fields without native subscription windows.

Task creates native child parentID and metadata parentSessionId/sessionId/Model/background/job. children/status/messages map public child state/transcripts. Use child Session ID, task_id for continuation, not Fork-as-child. [task.ts](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/tool/task.ts).

This is richer than tool-only ACP but needs foreground/background/cancel/failure/parent-idle-child-running/restart/permissions Gates. Start with Task tools, then declare observe/readTranscript only after validation.

Distinguish:

- Fork copies Transcript, not Git worktree/files; [session.ts](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/session/session.ts#L691).
- Revert changes actual files/saves recovery, not hidden chat; [revert.ts](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/session/revert.ts#L38).

### Persistence boundaries

SQLite stores Sessions/messages/Parts/durable events:

- DB/WAL: [database.ts](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/core/src/database/database.ts)
- Session/message/input: [sql.ts](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/core/src/session/sql.ts)
- Durable events: [sql.ts](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/core/src/event/sql.ts)

V1 pending questions/permissions are process-memory and rejected on exit. always is shared process-lifetime state. On restart:

- Restore Session/Transcript;
- Do not assume old pending requests are answerable;
- Terminate old interactions interrupted/rejected and reconcile anew.

## Native V2: value and limits

V2 /api provides:

- Sessions fixed to explicit Location.
- Caller-ID idempotent durable admission.
- `delivery: "steer" | "queue"`.
- Explicit resume/switchAgent/switchModel.
- `compact`, `wait`, `interrupt`.
- Bounded durable event history.
- Per-Session aggregate-sequence replay-and-tail SSE.
- staged / clear / commit revert.
- V2 permissions/questions.
- models, providers, integrations, credentials.
- Short-token PTY WebSocket.

SDK entry points:

```text
client.v2.session.create/list/get/active
client.v2.session.switchAgent/switchModel
client.v2.session.prompt/compact/wait/context/history/events/interrupt
client.v2.session.revert.stage/clear/commit
client.v2.session.permission.*
client.v2.session.question.*
client.v2.model.list
client.v2.provider.list/get
client.v2.integration.*
client.v2.credential.*
client.v2.event.subscribe
```

These can address replay after reconnect, idempotence, queued/steered input, explicit selection, and preview/commit revert transactions.

Official parity still marks partial/missing:

- project/configured/nested instructions;
- selected-agent prompt/policy;
- provider-family base instructions;
- Complete built-in/MCP/plugin/structured-output tools;
- per-prompt system/tool override;
- steering reminders;
- plugin transforms;
- variants/settings;
- structured output;
- template/mention/reference expansion;
- file/media/MCP attachment materialization;
- Crash continuation and clustered ownership.

See [V1 parity checklist](https://github.com/anomalyco/opencode/blob/v1.18.25/specs/v2/session.md#L123-L181). Recommendation:

- Current/V1 API for first execution;
- Separate experimental replay/queue/steer/idempotence/revert capabilities;
- Declare each only after interaction Gates;
- No broad supportsV2 flag hiding maturity differences.

## ACP capabilities and limits

[ACP docs](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/web/src/content/docs/acp.mdx) and implementation show:

- stdio JSON-RPC/NDJSON;
- initialize/authenticate;
- new/load/list/resume/close/fork;
- Model/effort/variant/mode;
- prompt/cancel;
- Embedded context/images;
- MCP HTTP/SSE;
- Text/reasoning/tools/Usage/cost;
- once/always/reject permissions;
- Proposed edits as diff blocks.

Entry/implementation:

- CLI: [`packages/opencode/src/cli/cmd/acp.ts`](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/cli/cmd/acp.ts)
- Service: [`packages/opencode/src/acp/service.ts`](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/acp/service.ts)
- Event translation: [`packages/opencode/src/acp/event.ts`](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/acp/event.ts)
- Permission/diff translation: [`packages/opencode/src/acp/permission.ts`](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/acp/permission.ts)

ACP internally starts Server.listen and SDK client, so it is a projection over native APIs. Losses:

- No native Questions;
- undo/redo unsupported;
- close aborts/removes ACP memory, not persisted Sessions;
- resume replays last 20; load replays all;
- Model/mode/variant state is memory rebuilt from messages;
- Unstable Fork accepts Session/cwd but no boundary; SDK call omits messageID;
- Task projection lacks full child identities/state/Transcript;
- Event translator handles status/permissions/Parts, not every native event.

ACP suits shared compatibility, not the richest native path. Future ACP-only Harnesses can share mechanisms; OpenCode prefers SDK.

## Headless CLI fallback

[CLI docs](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/web/src/content/docs/cli.mdx) includes continue/Session/Fork/Model/Agent/variant/file/server/raw JSON/auto permissions.

[run.ts](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/cli/cmd/run.ts#L670-L878) shows:

- Without auto, permissions reject;
- With auto, approve once;
- No native question interaction;
- Simplified tool_use/step_start/step_finish/text/reasoning/error output.

Use for install probes/smoke/one-off fallback, not persistent Harness Sessions.

## Plugins, custom tools, and workspaces

Plugins receive project/directory/worktree/client/URL/Shell and can provide:

- tools;
- provider/auth integration;
- event hook;
- chat transform;
- permission hook;
- tool before/after hook;
- environment hook.

See [types](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/plugin/src/index.ts). Custom Tools in .opencode/tools or global configuration use plugin types and Agent/Session/message/directory/worktree context; [docs](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/web/src/content/docs/custom-tools.mdx).

Main platform extension:

```ts
experimental_workspace.register(type, WorkspaceAdapter)
```

WorkspaceAdapter configure/create/remove/target supports local directories/remote URLs with headers. Native Worktree proves the pattern:

- [Registration](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/plugin/src/index.ts#L36-L64)
- [Control types](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/control-plane/types.ts)
- [Worktree](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/control-plane/adapters/worktree.ts)

Optional codex-z-opencode-plugin could later:

1. Register managed local worktrees/remote workspaces.
2. Supply genuine Host tools/hooks such as UI requests/workspace metadata.

experimental is explicit. Basic Adapter drives OpenCode without mandatory reverse plugin dependency, avoiding install/version/trust/remote prerequisites.

## Model, Provider, Account, and credentials

Current APIs:

- Provider lists/default Model;
- provider auth method discovery;
- OAuth authorize/callback;
- auth set/remove.

V2 adds platform-UI operations:

- model list;
- provider list/get;
- integration list/get;
- key/OAuth connect;
- OAuth attempt status/cancel/complete;
- credential label/update/remove.

Hidden experimental Console accounts/orgs include login/logout/switch/orgs/open and metadata/org-switch HTTP. Sources:

- [`packages/opencode/src/cli/cmd/account.ts`](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/cli/cmd/account.ts)
- [`packages/opencode/src/account/account.ts`](https://github.com/anomalyco/opencode/blob/v1.18.25/packages/opencode/src/account/account.ts)

Do not treat hidden features as stable Account contracts. auth.json secrets are mode 0600; codex-z must not read/copy/log/return them. Display native redacted status/authorization actions only.

## Suggested capability layers

Target, not current branch declarations:

| Capability | Target | Basis |
| --- | --- | --- |
| Session create/list/load/resume | Supported | SDK/SQLite |
| Text/reasoning/tools | Supported | SSE/idle/Transcript reconciliation |
| Approval | Partial | once/reject; session/always policies above |
| Permission picker | Supported | default/ask/allow native rules |
| Questions | Native subset | choice/multiple/custom, no secret/multiline or ACP support |
| Cancel | Supported | abort |
| Usage/cost/context | Supported | message data/Model limits |
| Diff | Complete native records | diff; fail closed without path/patch |
| Fork | Explicit semantics | Exact Transcript, not filesystem |
| Cross-cwd | Not first version | Paths/files are not copied |
| Compact | Supported | summarize |
| Edit rollback | Supported | Independent Fork, source/current files retained |
| Model selection | Supported | Provider APIs, credentials native |
| Permissions | Supported | Session rules |
| Thinking | Per-Model probe | Validated variants |
| Agent selection | New Host capability needed | Distinct from permissions |
| Children | Phase two | Native IDs/metadata with Gates |
| Durable replay | Experimental | V2 sequence |
| Queue/steer | Experimental | V2 delivery |
| Idempotent admission | Experimental | Caller ID |
| Staged revert | Experimental | stage/clear/commit |
| PTY | Deferred | Terminal permissions/token lifecycle |
| Console accounts/orgs | Unsupported | Hidden experiments |
| Workspace plugin | Optional experiment | experimental_workspace |

## Release and future Gates

APIs/types/initialize do not prove usability. Validate:

1. Startup/faults/ports/authentication/versions.
2. SSE disconnect/duplicates/missing/reconcile.
3. once/reject/Session scope/shared always/exit pending semantics.
4. Single/multiple/custom/reject/cancel and unsupported secret/multiline/restart.
5. Tool lifecycle/proposed/real edits/errors.
6. Admission/busy-idle/cancel/concurrency and enabled queue/steer.
7. Cross-process recovery/end/middle Fork/cwd/exact history.
8. Revert/unrevert source/files/failure compensation.
9. Model/Provider/variants/unauthed/OAuth/redaction, no Agent-as-permission.
10. Foreground/background Tasks/children/cancel/failure/parent completion/transcripts.
11. Shared Server/multi-Session/cross-cwd/interactions/permissions.
12. Local/SSH/Windows/missing/old/upgrade/downgrade.

## Next implementation steps

1. Method-level OpenAPI handshake, not version/type inference.
2. Isolated Provider live Gates for Questions/permissions/tool errors/cancel/streaming.
3. SSH/Windows Revert process/path checks.
4. Multi-Session/cross-cwd/correlation/remote trees.
5. Session approvals/children; separate Agent capability before picker.
6. Independent V2 replay/queue/steer/idempotence/revert experiments.
7. Optional workspace plugin last, not initial release blocker.

This order supplies richer interactions than ACP/CLI while keeping evolving V2 features behind detectable, reversible capability Gates.
