# OpenCode message-edit recovery

Message edits replace only the session history linked to the current Thread. OpenCode Adapter uses native Fork to create an independent Session before the specified message. It preserves the source Session and current workspace files. Removing chat history does not undo file changes.

- The derived candidate must have a different Native Session ID and preserve inputs, outputs, results, and file-change records exactly. Model, Thinking, and Permission Mode are persisted with the candidate, including when the user edits the first message and exits before sending it again.
- An edit fails when the source is busy, file history is incomplete, concurrent changes occur, or configuration or identity does not match. The original record remains the recovery source. The Adapter does not fabricate empty history or use an untrusted candidate.
- Cancellation acknowledgement means that native execution received the request. The Adapter waits for native idle before emitting a terminal Turn state, so later input follows the upstream cancellation → terminal state → new Turn path. If v1 saved no Assistant terminal state, a cold read reports unknown. v2 uses the persisted idle result succeeded/failed/interrupted, rather than inferring execution completion from the Assistant finish field.
- Interrupted v2 text blocks may have sent only a transient delta, without durable text.ended. Completion and cold-read snapshots use native persisted content and may omit some text that was shown live.
- Both v1 and v2 can rebuild message/Part IDs during Fork. Candidate-history comparison ignores these Session-local identities but checks input, result, and patch changes. Source history is still checked with complete identities.
- A v2 Session locator records protocol: 2. Old v1 references remain unchanged. Cross-major-version recovery is rejected; there is no automatic migration. See [dual-version integration](opencode-harness-integration-analysis.md#dual-version-integration-and-maintenance-scope).

Real CLI validation runs an isolated Gate through an explicit command. Other native versions, Windows, remote shared services, and third-party client concurrency require separate validation.

For focused native validation, run `npm run build:typescript`, set `CODEX_Z_OPENCODE_REAL_COMMAND` to the CLI path, then run the Vitest cases in `packages/adapters/opencode/test/opencode-adapter.rollback.real.test.ts` and `tools/gate-opencode/cancel.real.test.mjs`. They do not use real model accounts.
