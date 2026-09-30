# External Thread steering

codex-z defines external steering as **cancel current Turn, wait for terminal state, then automatically execute new input**. Users retain native Desktop buttons, follow-up handling settings, and reverse actions on individual messages without manual stop/resend. Official Codex forwards native `turn/steer`, preserving same-Turn input semantics.

## Ownership and execution

- `AppServerHost` routes `turn/steer` by ownership; external Threads no longer enter official Account lookup.
- `ExternalTurnSteering` validates nonempty text and `expectedTurnId`, registers terminal-state waiting for the specified Turn, then calls existing `turn.cancel`. No private Harness interface or public `turn.steer` command is added.
- Cancellation acknowledgement is not completion. Wait for old Interaction/Item closure, terminal identity persistence, and Desktop terminal notification output. Then reuse ordinary `turn/start` startup, allocate a real new Host Turn ID, and return `{turnId}`.
- Same-Thread starts, Harness commands, and delegation cannot preempt replacement. If an autonomous native Turn starts first, replacement fails without cancelling that unexpected Turn.
- Cancellation plus terminal waiting has a 20-second limit, below Desktop's 30-second submission timeout. Timeout, Session fault, output EOF, Host close/disconnect, explicit replacement stop, old-Turn failure, or persistence failure prevents automatic restart. New-Turn startup retains Adapter admission semantics; client timeout does not prove nonacceptance.
- Deduplicate within one connection by `threadId + clientUserMessageId`, retaining bounded successful delivery receipts for outcome-unknown retries. One message ID cannot carry different old-Turn IDs/input. Exactly-once is not promised across Host restart/receipt eviction.

Ordinary stop retains Adapter cancellation. Native process/tool/child exit speed and recovery belong to Adapters. No common force-kill policy or rollback of completed file changes is added.

## Renderer integration

Host cancel/start alone is insufficient: official steer places optimistic input on the old Turn and can restore it to paused queues on interruption.

`renderer-external-steering.ts` wraps `steerTurn` on a confirmed RequestManager. Desktop Manager is also `RpcTarget`, whose cross-component RPC rejects own-instance properties, including functions. Wrap prototype methods on an instance-specific prototype layer, without `manager.sendRequest = ...` or shared-prototype mutation. Unload removes overrides and restores lookup, rather than assigning original functions as own properties, which would still break model/permission RPC.

Flow:

1. Query ownership on the current connection. Official Threads use original methods; follower windows retain native owner forwarding.
2. External input uses Desktop `startTurn` display. New input belongs to a new-Turn placeholder from the start, preserving `clientUserMessageId`, input, and attachment display context. Create no old-Turn `steeringUserMessage` or native Transcript entity changes.
3. Convert only this `threadId + clientUserMessageId` outbound `turn/start` into `turn/steer` with captured `expectedTurnId`. Convert Host `{turnId}` into the normal-start Turn envelope. Other starts/options/official steer remain unchanged.
4. On success, undo only queue pause caused by this old interruption and retain earlier paused messages. Failures do not retry or queue silently; Desktop failed-submission display preserves input.
5. Unload stops new replacements and restores methods. Pending unsent replacements must not become ordinary starts during unload.

Host and Renderer must ship together. A Host-only upgrade with old optimistic steer input is not an integrated product path.

### Current compatibility boundaries

Bindings are from Desktop **26.901.51231 / build 8109**, `app-initial-cadb12d4a15e.js`: `steerTurn`, `startTurn`, `sendRequest`, `getTurnCoordinator()` submissionHost, and queue `loadMessages` / `readMessages` / `mutate`. These version-specific JavaScript bindings are not Harness SDK contracts; recheck after upgrades.

- Public input currently supports text only. Reject images/nontext/empty/tool responses before stop, without dropping them and cancelling anyway.
- Submit new input as ordinary text `turn.start`, without interpreting it as a Harness command. Separate command paths remain.
- Without a confirmed current Turn ID, do not guess or retry stale targets against another Turn.
- Native history contains two real Turns, without reused IDs, fabricated same-Turn injection, or merged Fork/Rollback identity.

## Follow-up queue

Desktop **26.903.61454 / build 8378** uses server queues when feature flags/app-server versions allow. Follow-up input calls `thread/queue/list`, then `thread/queue/add`. Returning empty lists cannot restore enqueue. External Threads are not official app-server Threads; retain rejection, without forwarding or fabricating server queues.

`renderer-external-queue.ts` excludes external Threads in current Manager `getTurnCoordinator().serverQueue.isEnabled(threadId)`, retaining Desktop's local queue:

- Read only that Manager's `getConversation(threadId)` and check Thread ID plus reserved Host `modelProvider: "codex-z"`. Do not infer from Agent/Model, cache across Hosts, or add RPC.
- Native queues still own enqueue/edit/reorder/delete/restore/pause/automatic next-Turn execution. No Host queue or Harness command is added.
- Official, unloaded, and Thread-ID-free probes use original methods. Reread after metadata load; do not cache unknowns. Older Desktop without this backend is unchanged.
- Wrap the backend's writable ordinary method, not Manager/Coordinator RpcTarget methods. Unload restores original properties without overwriting later wrappers.

This boundary comes from code and running-feature observations. It does not prove activation timing or first introduction in this Desktop release.

## Validation

Focused tests:

- `packages/host-runtime/test/external-turn-steering.test.ts`: Delayed/synchronous terminal states, deduplication/conflicts/stale targets/prechecks, late timeout, fault/close/explicit stop, autonomous Turns, and startup failures.
- `packages/host-runtime/test/app-server-host*.test.ts`: Real Host routing, no external leakage, cancel/start order, response gates, same-Thread races, and official forwarding.
- `packages/renderer-extension/test/renderer-external-steering.test.ts`: Normal placeholders, single input, no old steer Item, deduplication, pause recovery, owner/follower, failure/unload.
- `packages/renderer-extension/test/renderer-external-steering-rpc.test.ts`: RPC-accessible class methods, model/permission reads, official/external steer, instance isolation, unload/reinstall, and pending-request cleanup.
- `packages/renderer-extension/test/renderer-external-queue.test.ts`: Production-install external enqueue, existing pauses, enqueue after clear, same-connection official queue, Manager isolation, metadata changes, old backends, unload.
- `packages/renderer-extension/test/versioned-renderer-adapter.test.ts`: Existing binding/cleanup regressions.

A Node VM replay used real Bundle helpers `lun` (start), `GS` (placeholder), and `Irn` (old-message restore). Legacy/canonical history tested success/failure, single input, no old steer restoration, and failed-input retention. Preparation/transport stayed simulated; this was not a real window/native Session test.

For RpcTarget own-property regression, real running Desktop `RpcStub` called `model/list` and `permissionProfile/list`; both succeeded after the prototype fix, including previously failed read-only queries. No new messages, permission changes, or native Harness execution were tested.

For server queues, Node VM replay used the real 26.903.61454 Turn Coordinator. It reproduced pre-fix list failure, then verified enqueue/edit/reorder/delete/restore, one next message per terminal state, and retained official server queues. Storage/transport/execution were synthetic, with no native Harness calls. Read-only running probes confirmed metadata/flags. Isolated backend objects verified external exclusion and official enablement without changing user queues or sending messages.

Synthetic tests/read-only RPC do not replace real Desktop and Harness acceptance. Release checks should cover streaming, tools, Questions/Approvals, consecutive submissions, existing queues, failed cancellation, history refresh, multiple windows, and remote connections. Typechecks/synthetic success are not all-Harness real-system compatibility proof.
