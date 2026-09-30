# Thread watch: one-time notification when a Thread stops

`codex-z thread watch` lets one Thread receive **one notification when another Thread stops running**. Registration returns immediately. The caller can continue work or finish its Turn without waiting or polling.

This capability is opt-in. Without a call, Host submits no input to any Thread because a child reached terminal state. The busy-state fix in the same change (see Implementation and boundaries) is independent of watch and also applies to ordinary `thread read`, `wait`, and `send`.

## Model

- Exactly two Threads: observed Thread and notified Thread. Delegation parent-child relationships are irrelevant; any two different Threads can be used.
- One-time. The first of observed stop or watch expiry causes one notification, then the watch is removed. A change to another running Turn does not notify. No cancellation/unsubscription exists; register again to wait longer.
- Each registration is fulfilled independently. Re-registering the same pair during observation returns the existing watch. If its observation ended but delivery remains pending, another registration (such as after a new Turn starts) creates a new watch for the next stop. The old notice still delivers without replacement or loss.
- Notices report execution state only: Thread link and result, with the terminal Turn identity to distinguish notifications across Turns. No Session body/summary is included, and notification does not mean work acceptance. The recipient should use `thread read`.

Entry points:

| Command | Purpose |
| --- | --- |
| `thread watch <thread> [--notify <thread>] [--timeout-ms <n>]` | Observe an existing Thread |
| `delegate start ... --watch true` | Observe after delegation and notify the initiator resolved by Host |
| `thread watches` | List undelivered watches |

`delegate start` completes delegation first. Watch-registration failure does not fail the command; its `watch` field reports `notRegistered` with a reason. `thread send` has no `--watch`; register `thread watch` separately for a notification after sending.

## Results

| Result | Meaning |
| --- | --- |
| `completed` / `failed` / `interrupted` | Terminal state when Thread stopped |
| `timedOut` | Thread had not stopped at expiry, including a Harness stop that was not reported |
| `unreadable` | Reads failed continuously for 60 seconds; state is unknown |
| `notFound` | Thread no longer exists |

Default observation is 29 minutes; use `--timeout-ms` to change it. Expiry reports `timedOut`. Register again to keep waiting.

If already terminal at registration, return `alreadyTerminal` with no registration or notice. The caller can read directly.

## Delivery

- Ordinary `send` starts a new Turn in the recipient. External Harnesses and native Codex use the same path. No same-Turn input injection occurs.
- If the recipient is busy, delivery remains pending and retries for up to 6 hours. `THREAD_BUSY` never counts as delivery. Ordinary `thread send` remains nonqueued.
- Delivery failure retries only when the call chain proves no Turn started:
  - `THREAD_BUSY` detected before start, or an error with `notStarted` (such as native Codex resume validation failure or explicit `turn/start` error): retain pending state and retry;
  - Missing or read-only recipient: immediately mark `undeliverable`;
  - Other failures have unknown outcome, including `DELEGATION_FAILED` wrapped around a Harness start-confirmation timeout. Native execution may already have started. To prevent duplicate wakeups, do not retry; mark `undeliverable` with an explanation.
- Each delivery combines all currently pending notices for the same recipient, including those accumulated by earlier polling, into one message and one Turn.
- Missing/read-only recipients or undelivered notices after 6 hours become `undeliverable` with retained reasons, visible through `thread watches`. Keep at most the latest 50 undeliverable records.

## Relation to Stop

- Stopping the observed Thread produces one `interrupted` notice. Steering's stop-and-resend does not count as stopped and sends no notice.
- Stopping the recipient's current Turn does not cancel registered watches. Once idle, a due notice still starts a new Turn. Watches cannot be cancelled; registration selects this behavior.
- This is consistent with nonqueued `thread send` and [steering](external-thread-steering.md) without failure retries or hidden queues. Pending notifications exist only for explicitly registered watches; ordinary-message behavior remains unchanged.

## Recipient identity

Resolve identity once. Watch makes no independent inference:

1. `delegate start --watch`: Use the resolved delegation parent Thread. If none, report `notRegistered`.
2. `thread watch`: Use explicit `--notify`, otherwise the `CODEX_Z_THREAD_ID` supplied by Host to external Harnesses.
3. With neither (native Codex), return `INVALID_ARGUMENT` and require explicit `--notify`. Native Codex can use the parent returned by `delegate start` as its own Thread.

## Implementation and boundaries

- `packages/host-runtime/src/delegation-watch.ts` depends only on public `read` and `send`. It polls 2 seconds after each completed iteration, like existing `thread wait`. It does not depend on concrete Harnesses, Desktop, Renderer, or delegation lineage.
- `DelegationControlRegistry` owns the service above individual Host sessions. The two Threads can belong to different Host sessions.
- Watches exist only in Host Runtime memory and are lost on restart. Delegation relationships remain persisted, so watches can be registered again.
- Native Codex `thread/read` reports `notFound` only for Thread-missing errors. Other read errors count as failures; 60 continuous seconds yields `unreadable`.
- Busy state is `running || pending steering`. It applies to ordinary `thread read`/`wait`/`send` and delegation status, so the stop-and-resend gap is not read as `interrupted`.
- Abnormal exit relies on the Adapter contract: process/protocol faults first fail the active Turn. If the Harness is dead and cannot refresh history, `thread read` returns the projected terminal Turn. These failures notify promptly as `failed` instead of waiting for timeout.
