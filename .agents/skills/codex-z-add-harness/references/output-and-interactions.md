# Outputs and interactions

Read output, Turn, and fault rules for all plugins. Implement Items, Interactions, autonomous Turns, and Subagents according to native capabilities. Types are defined in `packages/harness-adapter/src/text-session.ts`. Check projection constraints in `packages/protocol-core/src/codex-ui-projector.ts`.

## One ordered output stream

`HarnessSession.outputs` is an asynchronous stream with one consumer. Reuse public `HarnessOutputChannel` where applicable:

- `{ kind: "event", event }`: Session, Turn, Item, and Subagent changes.
- `{ kind: "interaction", interaction }`: Approval or Question that waits for a user response.

The plugin correlates and normalizes native requests/callbacks. The Host correlates and projects public interactions into Desktop. Do not add native event passthrough channels or make the Renderer interpret native SDK objects.

## Turn lifecycle

```text
Accept turn.start (rejected calls emit no lifecycle events)
  → turn.started
  → item.started
  → item.updated (zero or more; can interleave with other Items)
  → item.completed
  → Close all Interactions and terminate all Items
  → One turn.completed
```

- Acceptance and completion differ. An RPC response or the end of SDK text does not always mean the Agent/tools have stopped.
- A Turn starts and completes once. Item IDs are unique within the Turn. Updates/completion refer only to active Items.
- Every accepted Turn terminates, including failure, cancellation, and close. Emit no Item updates after its terminal state.
- Completed snapshots match accumulated streamed content. Avoid duplicate text when native output includes both deltas and complete messages.
- Tool failure does not automatically mean Turn failure. The Agent can recover and succeed. Use native final state to set outcome.
- See [identity and history](thread-lifecycle-and-history.md) for NativeTurnRef and checkpoint requirements.

## Cancellation and subsequent Turns

- Successful `turn.cancel` means cancellation was accepted, not that the old Turn has terminated. Use confirmed native signals to close old Interactions and terminate Items, then emit one terminal state. Do not invent completion to start the next Turn sooner.
- Ordinary cancellation preserves a usable Session and history. It can then accept another `turn.start`. Old callbacks, outputs, and cancellation markers must not affect the new Turn. If execution processes need replacement, the Adapter follows native recovery semantics.
- If cancellation cannot be confirmed or the Session is unusable, report it through public error/fault rules. Distinguish the old Turn's terminal state from the exit of all native processes, tools, and background subtasks. State which work continues and its limits.

## Native content mapping

| Native content | Public Item | Required semantics |
|---|---|---|
| Visible answers and externally observable progress | `agentMessage` | Stream text.append; completion text matches accumulated content |
| Explicitly public Reasoning/summary | `reasoning` | Convert only public native content; do not infer hidden reasoning |
| Shell/explicit commands | `commandExecution` | Command, applicable cwd, output, exit code/duration, truncation information |
| Other tools | `toolExecution` | Name, structured arguments, text/image output, actual result |
| Actual file changes | `fileChange` | Path, add/update/delete, unified diff; not tool description text |
| Automatic or manual compaction | `contextCompaction` | Start and terminal state, as for other Items |
| Native Harness sub-Agent calls | `subagentDelegation` | spawn/send, stable child identity, state, background flag, result summary |

Use the update type for each public Item. Set practical limits for tool output and diffs. Use supported truncation flags or explicit limited handling; do not buffer streams without limit. Use agentMessage for final results and text needed by delegation observers. Do not turn Reasoning/tool output into a final answer.

## Two-way Interaction

### Approval

Use `HostApprovalInteraction`. Actions express only effects that map to native decisions. Provide explicit allow/deny behavior. Provide session/always scopes only when native support exists; do not turn a one-time approval into permanent authorization.

Validate the action with public `validateHostApprovalResponse()`, call the native decision callback, then emit its close event. The plugin owns the mapping from action ID to native decision. Display text is not an unchecked protocol ID.

### Question

Use `HostQuestionInteraction`. Select choice/text, multiple selection, free input, optional, secret, prefill, and other fields according to native answer support. Do not advertise answer forms that native code cannot accept.

Use `validateHostQuestionResponse()` to check required answers, choice range, single/multiple values, and cancellation semantics. Cancellation cannot include an answer. Do not write secret answers to diagnostics.

### Shared lifecycle

```text
Active Turn
  → Emit interaction
  → Host execute(interaction.respond)
  → Validate Session/Interaction and answer
  → Native code processes response
  → interaction.closed
```

- Interaction IDs are unique and belong to the active context. Explicitly reject late, duplicate, cross-Session, or incorrectly typed responses.
- Use responded, cancelled, expired, or superseded as close reasons. A timeout is not a user answer.
- Turn cancellation, timeout, Session fault, and close terminate pending interactions and release native waits.
- Response failures and cancellation races must not deliver answers to the next interaction. Close each interaction once.
- A native system without approval does not need invented approval UI. Real native interactions must not become ordinary text or automatic answers.

## Session state, Usage, and faults

state/Usage events contain complete Session state, not ordinary Items. See [public behavior](public-adapter-contract.md) for fields. They can update independently of ordinary Turns.

Handle unrecoverable Session faults in this order:

1. Close pending Interactions and terminate active Items.
2. Emit one failure terminal state if a Turn is active.
3. Emit one session.faulted, end the output stream, and close native resources.

close must also terminate active lifecycles and be idempotent. Do not automatically turn a recoverable single-operation failure into a Session fault.

## Autonomous Turns and native Subagents

Native code can emit output without Host turn.start. Declare `autonomousTurns.observe` when the output is fully observable. Use turn.autonomous.started to allocate public Turn identity and provide native visible input. Then follow ordinary Item/Turn rules. Use an empty array if no visible input exists. Do not mix it with another active Turn.

Do not discard native background results because a capability declaration is missing. If the implementation cannot safely project autonomous behavior, record the limit and handle the applicable native modes. Do not claim full support.

Declare Subagent observe/readTranscript separately. Native background tasks can continue after the parent Turn terminates. Use stable identity and `subagent.state.changed` / `subagent.transcript.changed` notifications. Do not append Items to a completed parent Turn. Implement the Adapter's read-only subagents interface when Transcript access is supported.

Native Subagents differ from codex-z cross-Harness delegation. See the [delegation checklist](cross-harness-delegation.md).

## Acceptance

- Full order for success/failure/cancellation/fault/close; rejected Turns emit no output; duplicate starts and late events do not affect the next Turn.
- If cancellation is supported, test cancellation acknowledgement and terminal state in both orders, immediate restart, failure/timeout, and late-output isolation. Cover streaming, active tools, and pending Interactions separately.
- start/update/complete, interleaving, content consistency, and output limits for every supported Item.
- Correct final Turn outcome after recovery from native Tool failure.
- Valid/invalid/duplicate/expired/cancelled Interaction responses and response/close races.
- If supported, autonomous Turns, background Subagents, and ordinary Turns retain correct identity, preserve events, and keep one terminal state.
- The same final answer is visible in live projection and read-only history.
