# Pi subagent mapping

Pi core has no unified subagent protocol. The Adapter integrates the asynchronous Host protocol and versioned synchronous-workflow child summaries of **nicobailon's `pi-subagents`**. It does not support all tools with the same name. The protocol reference is `pi-subagents@0.70.0`; local no-model RPC inspection used Pi `0.85.1`.

## Integration path

- `pi-subagent-rpc.ts` reads `widgetLines` from `extension_ui_request / setWidget`. It recognizes only `PI_SUBAGENT_ASYNC_JSON:` on `subagent-async`, with `pi-subagents.async-status-snapshot` v1. These frames create no model Turn or Question.
- When native `subagent` tool `details.asyncId` matches confirmed state, `pi-subagents.ts` generates public `subagentDelegation` and preserves the original tool result. Management/query calls, synchronous single-Agent results without a supported identity protocol, and unknown plugins remain normal tools.
- Synchronous workflows need no asynchronous widget. Read actual child ID, state, and Model from `details.workflowChildren` v1 in tool deltas and final results. Stable identity is workflow run ID + child ID. Several results can all have `index` 0; it is not a child identity. Tool errors still project failed states of children that started. Live execution and history recovery use the same identity.
- Actual workflow children each map to a receiving Thread. A `host-step` check is not an Agent and creates no child Thread. Identity includes root run ID and native child ID, not just agent name or array index.
- Update delegation cards within the parent Turn, then update observed children through public `subagent.state.changed` / `subagent.transcript.changed`. Parent-tool return or parent-Turn cancellation does not prove background-child completion. Do not fabricate native stop.
- Child Threads, parent-child links, and Desktop cards use the public Host path. No Pi-specific Host/Renderer branch or second subagent engine is added.

## Read child sessions

Prefer the running parent Pi RPC Session. If it is not in memory, restore a temporary parent connection from the persisted reference, validate Session ID and cwd, read, then close it.

**Synchronous workflow**: Locate the workflow/child in native tool results on the parent session's current branch. Read its referenced Pi v3 child Session file, at most 8 MiB, read-only, without child models or processes. Child Turn references bind to the parent Native Session with a child namespace and have no writable checkpoint. If the file is removed, oversized, or unsupported but the parent retains `finalOutput`, show an explicitly marked native result summary, not a full session. Without a record, return a retryable error. UI child IDs contain no file paths.

**Asynchronous tasks**: First use `get_commands` to confirm the native `subagents-inspect-rpc` extension command. Then send `/subagents-inspect-rpc <requestId> <runId> [childId] --lines 200`. If absent, do not send an ordinary Prompt that could trigger a model. Responses come from `subagent-inspect` as `PI_SUBAGENT_INSPECT_JSON:` v1 and must match the request and target identity. Ignore unmatched, withdrawn, damaged, and unknown-version frames. Timeout and close end the wait.

This interface provides a **native bounded transcript window**, not a complete writable Session: at most 200 messages and 64 KiB, with native truncation notices retained. Do not infer task text absent from native data, such as fork context. Show tool transcripts as text with role/tool names; do not invent missing arguments. Native `foreign_session`, `not_found`, and `stale` errors do not become empty successful snapshots.

## History and limits

- Successful asynchronous-start results in parent history point to the plugin's public `status.json`. Recovery accepts only lifecycle artifact v3 with exact run ID and parent Session ID matches. Read at most the latest 128 runs, at most 1 MiB per file, and do not follow symlinks on state files.
- State snapshots can be truncated. Missing runs/children do not imply completion, stop, or removal. Retain observed states. Disk recovery currently projects direct steps. Nested single tasks rely on live state snapshots. Internal steps of nested workflows have no links yet, to avoid associating their IDs with the outer run.
- Removed artifacts, unsupported formats, and ownership mismatches do not produce fabricated history cards. Reads of persisted child Threads still use native inspection and can return `stale` / `not_found`.
- Live discovery needs asynchronous state widgets from the plugin. With the widget disabled, live cards are not guaranteed. Public state artifacts can still restore parent history.
- New workflow children that appear after the parent Turn ends are added on the next parent-history read. Widget updates do not fabricate a new parent model Turn.
- Synchronous single-Agent calls without `workflowChildren` identity summaries, other Pi subagent plugins, and direct Host stop/resume of children are outside scope. Pi plugins retain operation ownership.

## Validation

Focused tests cover protocol versions/sizes, identity isolation, parallel children, background state after parent cancellation, no completion inference from absent snapshots, history ownership, RPC correlation, missing commands, timeout, and close. A local no-model probe verified command discovery and `not_found` inspection responses. A real user four-task session replay verified synchronous workflows: four native children mapped to four receiving Thread states, and all four native child sessions were readable. No additional paid-model task was started. Visual Codex Desktop acceptance was not performed.

Upstream references: [observability](https://github.com/nicobailon/pi-subagents/blob/main/docs/observability.md), [tool reference](https://github.com/nicobailon/pi-subagents/blob/main/docs/tool-reference.md).
