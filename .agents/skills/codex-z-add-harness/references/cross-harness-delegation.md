# Cross-Harness delegation through ordinary writable Threads

Read this page when a new Harness accepts tasks, delegates to other Harnesses internally, or claims complete Agent coordination. Native Subagent output/Transcript is a separate capability; see [outputs and interactions](output-and-interactions.md).

## Public path without a dedicated execution interface

Authoritative entry points in `packages/host-runtime/src/`:

- `harness-delegation-coordinator.ts`: Adapter Map, configuration validation, task/ordinary Thread coordination.
- `delegation-cli.ts`, `delegation-types.ts`: current CLI/request contracts.
- `delegation-cli-help.ts`, `delegation-cli-output.ts`: per-command help and compact output.
- `delegation-snapshot.ts`: read-only progress/result projection.
- `external-thread-runtime.ts`: ordinary Session creation, persistence, recovery.

```text
Generic inspect / delegate start / thread send, cancel, read, wait, list
  → Coordinator / Thread Runtime
  → HarnessAdapter.inspect / open
  → HarnessSession.execute / outputs / readSnapshot
```

Manifest, factory, and Loader put plugins in the same Adapter Map. The Coordinator validates identity against the actual Map. Do not add adapter.delegate, dedicated send/cancel, Catalog, CLI routing, or static Harness lists. Official Codex's special path is not an external-plugin template.

## Accept tasks and configuration

Verify through public interfaces:

- `codex-z harness inspect <id>` calls real inspect, returns current Catalog/capabilities, and creates no user Session.
- If callers omit Model/Thinking, open(create) also omits them and lets native code choose defaults. Do not substitute recent Renderer preferences, other Threads, or static tables.
- Explicit configuration uses opaque Refs/IDs returned by inspect. The Host can validate first, but native open provides final confirmation.
- With Thinking alone, the Host can validate against a default Model. This does not authorize writing that Model as explicitly requested by the caller.
- create handles `unattended-full-access` according to [public behavior](public-adapter-contract.md). Unattended execution does not automatically answer arbitrary interactions.
- First/subsequent Turns use Host turnId. Standard events publish visible text and actual terminal state.

Use agentMessage for externally observable progress/final answers. Retain separate Reasoning, tool, command, and file-change types. Observers use public projection; the Coordinator does not read a new Harness's private Transcript.

## CLI observation output

- `harness list` discovers targets from current Adapter Map without starting Sessions or querying Model Catalogs.
- `--format json` keeps complete JSON by default; `--format compact` gives compact JSON with actionable task links instead of internal tracking IDs. User reports show target, status, result, and task link only.
- Compact result view shows the result and latest nonempty progress while running. messages view shows the current message page/status without repeating progress/final answers. Do not truncate bodies.
- Pagination `hasMore` states whether a next page currently exists; retain `nextCursor` for later incremental reads. Preserve original sequence cursor positions when filtering blank messages, so old cursors do not skip new messages.
- Create results include working directory/parent task. Delegation without `cwd` first inherits parent cwd, then falls back to Host Runtime process cwd.
- Each command has independent `--help`. Update CLI and Runtime together before using new discovery/pagination support.

## Ordinary Thread remains writable

Complete delegation is more than a one-time script:

- After initial success, recoverable failure, or cancellation, idle Sessions accept another turn.start.
- A second start while busy returns sessionBusy. Do not queue, run concurrently, or cancel the old task.
- cancel affects only the matching current Turn. Preserve native Session/history and permit continuation.
- readSnapshot is read-only, returns stable multi-Turn history, starts no Turn, and replays no events.
- The Host is the only outputs consumer. read/wait/list use Host projections; plugins do not open another consumer for the same stream.
- After Host restart, resume the same native identity/history and permit send/cancel.

Native systems without writable resume can provide only explicitly limited backends. There is no automatic ephemeral delegation Thread fallback. Fork/Rollback are separate capabilities; delegation does not require invented implementations.

## Further delegation: Session environment reaches execution

The Host provides:

- `CODEX_Z_CLI_PATH`
- `CODEX_Z_RUNTIME_ENDPOINT`
- `CODEX_Z_RUNTIME_TOKEN`
- `CODEX_Z_THREAD_ID`

Every supported open path propagates `OpenSessionInput.environment` unchanged to the process/environment that executes tools, not just a stored factory base environment. Thread overrides take precedence over stale factory values. Verify that shared services distinguish Session environments.

- CLI_PATH selects the CLI; do not fall back to another codex-z on PATH.
- THREAD_ID sets parent/child relationships; endpoint/token identify the private current Runtime. Do not generate, rename, or guess replacements, or log these values.
- Verify installed delegation instructions/tools are visible to the actual native Agent. Environment propagation alone does not prove CLI discovery/use. Existing `.claude` installation rules are not general guarantees for all Harnesses.
- Explicitly fail when a native sandbox cannot reach Runtime. Do not switch Hosts or bypass it with hidden Turns.
- Plugins pass execution capabilities only. They do not start hidden delegation or automatically inject child results into parent Turns.

## Human interactions

Use public Interactions for native Approval/Question. Do not remove them because delegation uses unattended execution intent.

Current CLI help has no generic thread respond path. Users can use the returned deepLink in Desktop only if that Harness's Desktop integration is complete. Backend-only plugins cannot promise the existing Picker/Thread UI can handle them.

Verify pending interactions remain observable/cancellable and can continue after a human response. Ordinary Agent Messages do not replace pending interactions. Do not invent answers for test completion.

## Acceptance matrix

| Scenario | Evidence |
|---|---|
| Inspection | Correct cwd/refresh, Catalog/capabilities, no user Session |
| Default/explicit configuration | Preserve omissions; native confirmation of explicit opaque IDs; invalid combinations rejected |
| First task | Execution policy/environment applied; stable identity, visible progress/final result |
| Subsequent task | Same writable Thread accepts second Turn; rejects while busy |
| Cancellation/continuation | One cancellation terminal state; preserved history/identity; send works again |
| Read-only observation | read/wait/list start no task and do not consume plugin outputs |
| Persistence | Resume same Session after Host restart and continue |
| Interaction | If supported, wait/respond/cancel/close work; human-entry limits stated |
| Recursive delegation | Native Agent uses injected CLI/Runtime information to task another Harness; correct parent/child ownership |
| Errors | Unavailable Harness, configuration failure, native exit yield typed errors/correct terminal state |

Prefer plugin public-interface tests for local behavior and focused actual Coordinator integration. For native environment propagation, observe values actually received by child process/service. Do not copy the full Coordinator per Harness.

Report evidence separately for accepting delegation, recursive delegation, continuation after restart, and human takeover. Claim complete Agent coordination only when included ordinary Thread, environment, and observation semantics are all verified.
