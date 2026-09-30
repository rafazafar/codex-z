# External Harness Turn file-change summaries: findings and next steps

> Status: sections 1–10 retain the original investigation. Section 11 describes the current implementation. The shared layer now groups file cards by path, but local fragments still cannot guarantee precise net Turn statistics. Real Desktop UI validation is not complete.
>
> Related: [Issue #218](https://github.com/BytePioneer-AI/codex-host/issues/218) and [#134](https://github.com/BytePioneer-AI/codex-host/issues/134). Terms follow the [terminology guide](../project/terminology.md).
>
> Legacy source paths, the DSH `0.1.1-rc.2` environment, and validation results below retain the facts at the time of investigation. Legacy has since been removed; only `0.1.2-rc.1` / `0.1.5-rc.1` are supported. See [message revision and recovery](../harnesses/deepseek/dsh-edit-recovery.md). That version integration does not mean that the net-diff design below was implemented.

## 1. Background

Issue #218 reported repeated paths in the Codex Desktop end-of-Turn file-change card when DSH edited the same file multiple times. The card said “Edited 18 files”, although only two files were involved. The reported environment was codex-z 0.6.0, Codex Desktop 26.901.6511.0, DSH 0.1.1-rc.2, and Windows.

This is more than a title problem. The current projection mixes three meanings:

| Level | Meaning | Comparison or grouping source |
| --- | --- | --- |
| Operation file changes | What one tool call changed | Native tool call and result |
| Turn net file changes | What a Turn triggered by one user input ultimately changed | Trusted file baseline and final state for that Turn |
| Workspace or branch changes | What the current workspace or branch changed relative to a selected base | Git HEAD, merge-base, and similar references |

Three edits to one file are three operations, not three distinct files. The sum of insertions and deletions in three operation diffs is not the net Turn change. Each Turn normally owns its own baseline; changes must not accumulate across Turns without a reason. A native Pi model-response/tool-call cycle must not be treated as equivalent to a Host Turn.

## 2. Current implementation and root cause

### 2.1 Adapters usually emit file changes for each operation

DSH creates `HostFileChange` values from `meta.diffs` in successful tool results. Each result produces a separate fileChange item. Four live and historical paths are relevant:

- `packages/adapters/deepseek-harness/src/legacy/deepseek-harness-adapter.ts`
- `packages/adapters/deepseek-harness/src/legacy/history.ts`
- `packages/adapters/deepseek-harness/src/modern/session.ts`
- `packages/adapters/deepseek-harness/src/modern/history.ts`

The conversion function is `structuredDiffs()` in `packages/adapters/deepseek-harness/src/projection.ts`.

Pi and Claude Code also have paths that create fileChange items for individual operations:

- `packages/adapters/pi/src/pi-adapter.ts`: `reliableFileChange()` and tool-completion handling.
- `packages/adapters/claude-code/src/tool-lifecycle.ts`: file-change projection after tool completion.
- `packages/adapters/claude-code/src/file-change.ts`: native structured-patch parsing and projection.

Recording each operation is valid. Do not delete native operation history merely to reduce summary rows.

### 2.2 The shared projection concatenates operation diffs

`#fileChangeUpdates()` in `packages/protocol-core/src/codex-ui-projector.ts` emits both:

- `item/fileChange/patchUpdated`: updates changes for the current item.
- `turn/diff/updated`: sends the current Turn diff.

The latter flattens item changes with `#allFileChanges()`, then directly concatenates unified diffs through `diffText()`. It does not calculate the net Turn change.

```text
File states:     A → B → C → D

Current output:  diff(A, B) + diff(B, C) + diff(C, D)
Correct net diff: diff(A, D)
```

The shared layer therefore has a risk across Harnesses. Deduplicating DSH paths alone is insufficient. This finding does not prove that every Harness has reproduced the problem in a real run.

### 2.3 The exact Desktop card consumption path still needs validation

The Desktop code cited in the issue shows that fileChange data is stored by itemId. It does not, by itself, prove that the final summary title counts items. One item can contain multiple files, and one tool result can contain several fragments for the same path.

Repeated paths and non-net statistics in the Turn diff sent to Desktop are confirmed. Notifications, derived state, and cards have not yet been mapped one by one on the reported Desktop version. The 19 changes in the report and 18 screenshot rows also lack an exact per-Turn correspondence.

## 3. Validation performed and its limits

The probes below used the workspace source available at that time. Temporary probes were not committed as regression tests and must not be treated as established test coverage.

### 3.1 DSH: real native diff function with the current projection

The probe called the real `computeHunkDiffs()` from locally installed `@deepseek-ai/dsh-tool-fs` 0.1.1-rc.2, then passed the result through DSH `structuredDiffs()` and shared `CodexTurnProjector`. It was not a complete DSH session and did not start Desktop.

| Case | Correct net change | Current projection |
| --- | --- | --- |
| One file: a → b → c → d | One file, +1 -1 | Three diffs for one path, +3 -3 |
| One file: a → b → a | No net change | Two diffs for one path, +2 -2 |
| One operation changes two distant positions in a 40-line file | One file, two changed positions | Two file diffs for one path |

In the third case, native output had two hunks. Their `oldText` values contained only five and six lines. The only fields were `path`, `oldText`, and `newText`; no original file line numbers were present. This proves that they are local fragments with context, not complete file snapshots.

The existing focused tests for the shared projector and DSH Modern Session passed 82 tests. Those tests did not cover the net-change problem above.

### 3.2 Pi: real file edits through the local SDK tool

Using local Pi 0.85.1 `createEditTool()`, the probe edited one temporary file in sequence: `alpha → beta → gamma → delta`. Results passed through the current Pi Adapter and shared projection.

- Final disk content was `delta`.
- The native tool returned `details.diff`, `details.patch`, and `details.firstChangedLine`.
- Expected: one file with net +1 -1. Actual shared projection: three diffs for the same path, +3 -3.

This validates native SDK tool execution and projection. It is neither a complete model-driven Pi RPC session nor a Desktop end-to-end test.

### 3.3 Claude Code: projection reproduction; full SDK session blocked

Three Edit results with valid SDK structure reproduced three same-path diffs and +3 -3 through the current native parser and shared projection. This used constructed data, not results from native Claude Code execution.

A separate attempt started local Claude Code 2.1.133 through the SDK to perform three edits in an isolated temporary directory. It was cancelled after a 75-second timeout. No edit occurred and the file stayed unchanged. The timeout cause was not investigated further. A successful reproduction through a complete Claude Code session cannot be claimed.

Four existing test files for the Pi Adapter, Pi RPC Session, Claude Code file-change parser, and native messages passed 138 tests. These results must be distinguished from the targeted probes for this issue.

## 4. Native data available from each Harness

### 4.1 Claude Code: the SDK has full baseline data, but conversion discards it

Inspection of installed `@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts` found:

- `FileEditOutput` includes `originalFile`, `structuredPatch`, `oldString`, `newString`, and `replaceAll`.
- `FileWriteOutput` includes `originalFile`, complete `content`, `structuredPatch`, and a `type` that distinguishes creation from overwrite.

The `originalFile` contract describes complete pre-edit content, but its type permits null. Missing data must be handled according to tool semantics; it must not always imply a newly created file.

`parseClaudeNativeFileChange()` currently retains only paths, kinds, and hunks, discarding the complete original content. For Edit/Write results that actually provide a full baseline, the Adapter can retain it and reconstruct current state from the structured patch or write content. Whether historical messages retain these fields also needs confirmation.

The SDK also provides `enableFileCheckpointing` and `rewindFiles(messageId, { dryRun: true })`. Type declarations permit `filesChanged`, `insertions`, and `deletions` results, but this is not a complete net-diff query. It was not tested in this investigation. Do not confuse SDK file backups with Host Native Checkpoints.

### 4.2 Pi: Edit provides a standard patch; no Turn net-diff query was found

The local SDK documentation agrees with actual tool output:

- `details.diff` is display text for the TUI.
- `details.patch` is a standard unified patch for SDK use.
- RPC `tool_execution_end` carries tool results. The inspected SDK/RPC interfaces exposed no separate Turn net-diff query.

Standard patches are more suitable for composition than fragments without positions, but they are not complete file baselines. General, reliable net-change calculation still requires a trusted baseline or separately validated patch composition. Only Edit was tested. The finding cannot be extended to Write, overwrite, delete, or custom tools.

### 4.3 DSH: the current projection uses local display data

Native `tool/result.meta` is display metadata owned by the tool. Session core treats it as persistable opaque data. `DiffResultView` permits local hunks with context. The names `oldText/newText` must not be interpreted as complete before/after file snapshots.

Do not merge results by taking the first `oldText` and last `newText` for a path. If the first edit changes the beginning and the last edit changes the end, this method invents a change that never occurred.

Native file tools do process complete before/after content internally. That does not prove that existing Session interfaces expose it to the Adapter. Check whether a public native interface can provide or retain this content. Private internal functions are not a production integration solution.

## 5. Existing Codex Desktop capabilities and interface limits

The confirmed reusable capabilities are native display channels:

| Interface | Direction and responsibility |
| --- | --- |
| `item/fileChange/patchUpdated` | Backend notification that updates a file-change item in Desktop |
| `turn/diff/updated` | Backend supplies an already calculated cumulative Turn diff to Desktop |

The inspected integration paths exposed no request that accepts multiple external Harness edits and asks Desktop to calculate their net diff. Native Codex can produce cumulative diffs, but this does not establish that the calculation is available as an external service.

This is not exhaustive proof about every private interface in the installed version. No full Desktop private-code audit was completed. Depending on undocumented Renderer functions to avoid backend accumulation is not recommended.

## 6. Paseo reference: separate operation records and workspace summaries

Related code in local reference project `reference/paseo` uses different data sources:

1. Chat Edit/Write entries show individual tool details and do not promise net Turn changes in that path.
2. The workspace changes panel gets file lists, diffs, and statistics through separate Git queries.
3. Uncommitted mode compares the workspace with HEAD and handles untracked files separately. Branch mode compares merge-base with HEAD.
4. Codex notification handling explicitly identifies `turn/diff/updated` as the cumulative diff for the entire Turn, not an individual tool call. That branch returns without creating another tool record.

Reference source:

- `reference/paseo/packages/server/src/server/agent/providers/tool-call-detail-primitives.ts`: `toEditToolDetail()` and `toWriteToolDetail()`.
- `reference/paseo/packages/app/src/components/tool-call-details.tsx`: individual tool details.
- `reference/paseo/packages/app/src/git/use-working-diff.ts`: workspace diff data entrypoint.
- `reference/paseo/packages/server/src/utils/checkout-git.ts`: `resolveCheckoutDiffRefs()` and `getCheckoutDiff()`.
- `reference/paseo/packages/server/src/server/agent/providers/codex-app-server-agent.ts`: `diff_updated` handling.

The useful reference is the division of responsibility, not a ready-made Turn patch-composition algorithm. A Git workspace diff can include changes made before the Turn, manually by the user, or by another Harness. It must not be inserted directly into this Turn's card. It also does not apply to non-Git directories. This investigation read Paseo source but did not run it.

## 7. Candidate implementation: retain baseline and current state, then recalculate the diff

### 7.1 Core model

Prefer trusted per-file state within the Turn over an arbitrary patch-string concatenator:

```text
Native tool result / native cumulative result
             ↓
Adapter interprets native semantics
             ↓
Trusted Turn accumulation source
  ├─ Native Turn diff: use directly
  └─ Full baseline + current content / applicable patch: calculate net change
             ↓
One net diff per path
             ↓
turn/diff/updated
```

Each path conceptually needs its existence state and content before the first trusted edit, plus its current existence state and content. The first pre-edit state is a valid baseline for observed changes only when the change chain is continuous. It cannot unconditionally cover unobserved writes during the Turn.

After every successful edit, update current state and use the existing diff library to compare it with the baseline. Do not wait until normal completion to emit the first result: that would lose live feedback and changes made before abnormal termination.

### 7.2 Keep operation records and express Turn summaries independently

The preferred candidate keeps existing operation items and gives cumulative Turn results an explicit, separate public representation. They must no longer be derived unconditionally from all operation items.

`HostFileChange` currently contains only `path`, `kind`, and `unifiedDiff`, which cannot express a complete baseline. Adding snapshot input or independent Turn diff output requires coordinated changes to public types, schemas, Adapters, protocol projection, historical reads, and tests. Exact fields and event names are not designed here.

Existing `fileChanges.replace` can replace changes in an open item. This is not equivalent to retaining all operation items and providing an independent cumulative result. Adding a summary fileChange item could cause `#allFileChanges()` to count it again. Maintaining one stable item per Turn would instead change operation-card semantics and must be evaluated with Desktop consumption behavior. A completed item must not simply be reused.

### 7.3 Ownership

- Adapter: parse Harness-private fields, establish their actual meaning, and retain necessary native information.
- Shared accumulation logic: handle only well-defined full states or patches, without DSH/Claude Code-specific field checks. If a common abstraction is not yet justified, first implement it in an Adapter with sufficient native data.
- `protocol-core`: project trusted results into Desktop. Do not add Harness-specific protocols or read the workspace by default to guess a baseline.
- Host Runtime: integrate through public contracts without direct dependencies on concrete Adapters.
- Renderer: reuse native display. Do not start by changing private UI, titles, or counts.

Read `tools/check-boundaries.mjs` before changing cross-package dependencies. Place new logic by responsibility; do not keep extending already oversized Adapter or projection modules.

### 7.4 Insufficient data and broken continuity

Check that the previous current state matches the next native pre-edit state. Mismatches can come from user edits, other processes, concurrent tools, path aliases, newline normalization, or missing write events.

Do not silently combine discontinuous states and call the result an accurate net Agent change. On degradation, retain native operation records without inventing a net diff. Validate the consumption path before deciding how to avoid misleading Desktop summaries or clear an already published result that loses credibility. Merely stopping notifications can leave stale results displayed.

Reading disk only at Turn completion cannot reconstruct the earlier baseline. File watchers, Git snapshots, backups, or private file-history reads are not default remedies.

## 8. Next implementation steps

1. Use an isolated three-edits-to-one-file case to map Desktop operation cards, Turn summaries, counts, and notifications. Verify whether an independent cumulative diff is sufficient to correct display.
2. Define separate shared representations for operation records and Turn summaries. Replace direct concatenation and specify UI degradation when data is insufficient.
3. First verify that Claude Code exposes complete original content in both live and historical data, then implement trusted accumulation. Repeat the real SDK test that previously timed out.
4. For Pi, establish how to obtain the Edit baseline and interpret Write/overwrite results. For DSH, find a public source of complete native state. Do not invent support without evidence.
5. Save redacted native event sequences as focused test fixtures. Routine regression tests should replay deterministic data rather than repeatedly call models.
6. Keep live output, history, cancellation, errors, disconnection recovery, documentation, and regression tests consistent. Check the DeepSeek Adapter's successful tool-result and File Change completion behavior when this lifecycle changes.

## 9. Acceptance checklist

- Three successive edits to one file produce one summary path and net insertion/deletion counts, while preserving operation history.
- Edits at different positions do not turn local fragments into assumed full-file snapshots.
- Reverting to original content reduces net change to zero and updates or clears a published summary.
- Create then edit remains an addition; create then delete has no net change; edit then delete compares against original content.
- Empty and nonexistent files remain distinct. Empty replacements, missing final newlines, and CRLF are handled correctly.
- Alternating edits to multiple files, absolute/relative paths, and Windows path aliases do not cause duplicate counts. Do not lowercase paths on every platform.
- Cancellation, failure, and disconnection retain confirmed changes. If a failed tool partly wrote a file, use only reliable native results; failure does not prove that nothing changed.
- Broken continuity, missing baselines, binary files, and large files have explicit degraded behavior without false precise net statistics.
- Unobserved shell or custom-tool writes are not claimed as fully covered.
- Historical and live output agree. Different Turns do not share baselines.
- Operation diffs and Turn diffs are not counted twice. Item lifecycles remain valid.
- Review and undo capabilities are validated separately. A native button or available diff does not prove that the Harness supports the corresponding native file operation.

## 10. Decision record

The missing capability is trusted Turn accumulation, not simple deduplication or wording changes. Prefer comparison of a file baseline and current state through the existing diff library. Use native cumulative results directly where available; state limits where data is insufficient.

At this investigation stage, no production code is implemented, no global watcher/backup system is added, and Paseo workspace Git diffs are not copied into Turn results. No claim is made that Desktop exposes a merge service for external Harnesses. Establish Desktop consumption behavior and native data sources before selecting public contracts and implementation details.

## 11. Current implementation: shared file summaries for all external Harnesses

`CodexTurnProjector` in `protocol-core` retains one open file-summary Item in each Host Turn. It recalculates by file path on each native change or tool-result update, then completes the Item when the Turn ends. `pendingTurn`, completed snapshots, and `projectHistoricalTurn` use the same summary rule. The native Codex path remains unchanged. Plugins using the public Harness Item contract receive this behavior without registration by Harness name.

- Repeated edits to one file, or multiple same-path fragments in one result, produce one path in Desktop `changes`.
- `HostFileChangeItem.sourceItemIds` links native results to their tool Items, preventing double counting of argument previews and native results. Claude Code, DeepSeek, Grok, Kiro, and OpenCode supply these links. Pi/OMP prefer standard patches in tool results and then replace argument previews.
- Failed/cancelled previews are removed. Later Turn failure or cancellation does not remove earlier successful changes. This uses published Item outcomes only; it does not infer partial disk writes by failed tools.
- Windows absolute/relative aliases are grouped as one file. POSIX path case distinctions are preserved.
- For standard unified patches with file coordinates and continuous content, the shared layer composes operations and calculates net change through the existing `diff` library. Restoring original content clears the path. Missing patch context is not guessed from disk.
- `HostFileChange.diffScope: "fragment"` explicitly identifies local fragments without file coordinates. DeepSeek `meta.diffs` and fragments synthesized from ordinary tool arguments use this marker. Matching text in adjacent fragments does not establish the same file position.
- For fragments or patches with unconfirmed continuity, original differences are retained under one path. **Insertion/deletion counts describe the retained operation differences; they do not promise net Turn statistics.** The implementation neither combines the first `oldText` with the last `newText` nor discards edits at other positions. Display patches are not claimed as validated undo patches.

This work therefore provides cross-Harness file-card deduplication and net patch composition where coordinates are reliable. It does not claim precise net diffs for every write by every Agent. Shell writes, unreported custom writes, binary files, external concurrent changes, and fragments without coordinates remain limited by native evidence.

Regression coverage is in `packages/protocol-core/test/file-change-summary.test.ts`, existing projector tests, and DeepSeek `test/projection.test.ts`. It covers live/history agreement, source replacement, preview withdrawal, distant positions and line offsets, create/delete/revert, path aliases, missing final newlines, and preservation of fragments without coordinates.
