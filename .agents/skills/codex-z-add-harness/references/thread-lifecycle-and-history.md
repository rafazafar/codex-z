# Identity and history

Read identity, create, Turn, and snapshot requirements for every plugin. Persistent product integration also requires resume. Implement Fork and Rollback according to native capabilities. The authoritative interface is `packages/harness-adapter/src/text-session.ts`; related Ref schemas are in `packages/shared-contracts/src/ids.ts`.

## Ownership and identity

| Identity/data | Owner | Purpose |
|---|---|---|
| Host Thread ID, Host Turn ID, mapping transactions | Host | Desktop identity, live event correlation, persistence coordination |
| `NativeSessionRef` | Plugin provides; Host stores | Locate the same native Session after restart |
| `NativeTurnRef` | Plugin provides; Host aligns | Identify the same logical native Turn; does not imply Fork support |
| `NativeCheckpointRef` | Plugin with Fork support provides | Identify an exact history derivation boundary; not a file snapshot |
| Native message, branch, and Transcript formats | Corresponding Harness/plugin | Native source of truth and public snapshot projection |

Native Refs use the current Harness ID, stable native IDs, and a persistent locator when needed. Do not store process handles, credentials, or random temporary identities. Plugins do not write the Host Mapping Store directly or implement Host Thread locks, import deduplication, or replacement transactions again.

## Create and Turn

- create produces an independent writable Session without another Session's history.
- Put known identity in initialState. If native creation is delayed, emit a state event promptly after confirmation. Do not claim recovery support before identity can persist.
- Live ordinary Turn events always use the Host input turnId. Successful terminal state provides a NativeTurnRef that can align with history.
- Do not invent NativeTurnRef if failure/cancellation was not persisted. If it was persisted, return stable identity and actual outcome.
- Without a native Turn ID, align through stable message/Entry IDs or plugin-owned persistent records. See Pi/OMP history boundaries or Claude message identity. Do not generate new random IDs on each read.

## Read-only snapshots: required handling for all plugins

`readSnapshot()` returns public `HostThreadSnapshot`:

- Return logical Turns in the active native branch and history order. Do not combine all branches into one conversation.
- Turns contain stable NativeTurnRef, user input, public Items, and actual outcome. Provide checkpoints at supported exact derivation boundaries.
- Repeated reads of the same history preserve Turn/Item identity. Report corrupted history, missing pages, or unknown terminal state explicitly, or use unknown where the type permits. Do not assume success.
- Include state confirmed by that read where applicable. Its semantics match initial and live state.
- Do not send Prompts, trigger Agents, replay old history into outputs, or create another outputs consumer.
- Return sessionBusy if active operations prevent safe reads. Report unreadable history explicitly; do not return empty history as false success.

Complete ordinary Threads need reliable history. Implementations with live output only must report product limits. Missing snapshots are not harmless.

## Resume: baseline for persistent ordinary Threads

- Validate nativeRef, restore the same Native Session, and return a writable Session.
- Handle Host knownTurnRefs to align history with existing Host Turns. Do not add encoding when stable native identity is sufficient.
- Fail if native code returns a different identity. Do not create an empty Session as false recovery success.
- Propagate current environment and applicable cwd; read confirmed native configuration. Do not blindly replay stale Model/Thinking/permission values.
- Preserve source history and Host persistence records on failure, so a later retry is possible.

The capability schema has no separate resume switch and no automatic ephemeral Thread path. If native resume is unsupported, return unsupported and describe the backend as limited. Do not claim persistent product support or complete Agent coordination.

## Fork: preserve an exact prefix and continue independently

Support only when history.fork is true. forkAcrossCwd also requires fork.

- Validate sourceRef/checkpoint Harness, source Session, and position.
- Preserve history through the selected Turn boundary in a different Native Session. Do not modify source history.
- The derived snapshot matches the exact prefix, with no extra or missing last Turn. The derived Session remains writable.
- For cross-cwd Fork, verify actual native binding to the destination. A changed child-process cwd alone is insufficient evidence.
- Close new resources on failure. Remove temporary derived native data only when safe native deletion is supported; never delete source data. Report persistent side effects that cannot be removed. Do not hide the original error with cleanup failure.

Fork branches Session context. It does not roll back files, create a Worktree automatically, or change Harness.

## Rollback: remove the last complete Turn

`rollbackLastTurn` returns a usable Session after removing the last Turn. The Host performs replacement. Do not destroy the source Session still used by the caller before the Host transaction succeeds.

- Source history is nonempty and has no active operation. The result removes exactly one logical Turn, not one message.
- Preserve confirmed Model, Thinking, and Permission Mode. Reject support if native code cannot ensure this.
- Return valid identity and an exact retained prefix. A one-Turn source can produce a new empty but usable Session.
- Without a direct native operation, combine Fork/Clone operations only if they satisfy these semantics.
- Failure must not leave partially replaced Runtime state or incorrect mappings. Clean native temporary resources according to Fork rules.

This operation changes Session history, not workspace files or Git history.

## Import: optional discovery without transaction ownership transfer

For existing native Session import, read `packages/shared-contracts/src/harness-session-import.ts` and Adapter `sessionImport`. Candidate identities must support real resume. The plugin owns native discovery, versions, and locators. The Host owns mapping creation, deduplication, concurrency, and recovery from failure.

The current DeepSeek upper-layer import entry remains specialized. A candidate interface does not prove generic import UI exists for a new Harness. Do not bypass this gap with a new Harness-specific import method.

## Acceptance

1. create and successful Turns produce persistent identity; repeated snapshots preserve identity/order.
2. Ordinary product Threads resume the same history after Host restart and accept a second Turn without replaying old events.
3. Snapshots report tool failure, Turn cancellation, native exceptions, and incomplete history accurately.
4. For supported Fork, verify middle/end boundaries, source isolation, invalid checkpoints, and declared cross-cwd support.
5. For supported Rollback, verify multiple Turns, one Turn, empty history, configuration preservation, and source preservation on failure.
6. Resource cleanup tests cover missing Sessions, unreadable files/page errors, open failure, and close.

Host integration references are `packages/host-runtime/src/external-thread-runtime.ts`, `external-thread-fork.ts`, and `external-thread-rollback.ts`. Current recovery still has Grok/OpenCode/OMP special cases. Verify new Harnesses through the generic path. If generic recovery cannot express native configuration semantics, record a public gap; do not add Harness-name checks.
