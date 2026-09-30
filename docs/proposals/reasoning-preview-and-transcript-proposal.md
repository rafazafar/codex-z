# Live Reasoning preview and persistent Transcript proposal

> Status: not scheduled for implementation. This document records the current implementation, user experience, and recommended future changes.
>
> This document covers Reasoning summaries that an external Harness explicitly outputs and permits the application to display. It excludes hidden, encrypted, redacted, signed, or inferred chain-of-thought.

## 1. Background

An external Harness can output structured Reasoning Items during a Turn. codex-z projects these Items into the native Reasoning summary lane in Codex Desktop:

```text
item/started                         type: reasoning
item/reasoning/summaryPartAdded
item/reasoning/summaryTextDelta
item/completed                       type: reasoning
```

Protocol Core supplies the Codex app-server data. Codex Desktop controls the UI. The Renderer Extension does not create a Reasoning panel, set the Thinking label, or control when the native preview expands, collapses, or disappears.

Controlled Desktop validation showed that the native Reasoning summary body primarily provides temporary progress feedback during a Turn. After completion, the body leaves the DOM; only the native completion state or elapsed time remains. When a Thread is reopened, this lane cannot be relied on to restore an inspectable Reasoning body.

Two separate goals must therefore be met:

1. **Live feedback:** use the native Codex Reasoning preview while the Turn runs.
2. **A record after completion:** let users confirm that Reasoning occurred and inspect the complete summary that the Harness explicitly output.

## 2. Current implementation

The current prototype projects one Host Reasoning Item into two parallel Codex Items.

### 2.1 Native Reasoning preview

The native Codex Reasoning Item uses an ID derived from the original Item ID:

```text
<host-item-id>-summary
```

Protocol Core sends `summaryTextDelta` continuously. Codex Desktop decides how to show the preview. Observed behavior is usually a temporary single line, truncated from the start of the accumulated text. Thus users might not see the second or third sentence even after their deltas have been sent.

### 2.2 Persistent Reasoning Transcript

An additional Command Execution Item uses the original Item ID:

```json
{
  "type": "commandExecution",
  "command": "thinking",
  "aggregatedOutput": "Complete Reasoning summary"
}
```

Reasoning deltas also enter this Item through `item/commandExecution/outputDelta`. Codex Desktop displays it through the native Shell/Command Execution UI and retains its text in the completed Turn and historical `thread/read` result.

`thinking` is the `REASONING_TRANSCRIPT_COMMAND` sentinel, not a Shell command that was executed. The card uses the native Codex UI, but packaging Reasoning as Command Execution is a codex-z compatibility projection.

### 2.3 Current sequence

```text
First Reasoning text arrives
    ├─ start native reasoning preview
    ├─ start commandExecution("thinking")
    ├─ append text to native reasoning
    └─ append the same text to thinking transcript

Later Reasoning delta
    ├─ append to native reasoning
    └─ append to thinking transcript

Reasoning completes
    ├─ complete native reasoning
    └─ complete thinking transcript
```

The user can perceive this sequence as:

```text
Temporary native Thinking preview
          +
A $ thinking Shell card appears at the same time or immediately afterwards
          ↓
Native preview disappears; thinking card remains
```

## 3. Problems in the current implementation

### 3.1 The same content occupies two display areas

Once generation starts, the native Reasoning preview and `thinking` card receive the same text in parallel. Users can mistake this for a model that first thinks and then executes a Shell command named `thinking`, instead of recognizing a live preview and a persistent copy of the same Reasoning.

### 3.2 Short Reasoning immediately shows a Shell card

Even when Reasoning is one sentence and finishes quickly, the `thinking` card appears as soon as the first text arrives. This reduces the value of the native temporary preview and causes unnecessary UI movement.

### 3.3 The native preview does not guarantee sentence rotation

Sending `summaryTextDelta` continuously only guarantees delivery to Codex. It does not guarantee this display sequence:

```text
First sentence → second sentence → third sentence
```

A single Reasoning Item currently uses `summaryIndex: 0`. Codex might always show a truncated line from the start of the accumulated text. Delaying the transcript does not resolve this native display limit.

### 3.4 Command Execution is a compatibility carrier

It is not a public Reasoning transcript contract. The implementation depends on current Codex Desktop rendering of `commandExecution`, `outputDelta`, and `aggregatedOutput`. Desktop Contract Audit and real Desktop Gates must continue to validate it. TypeScript unit tests alone cannot establish a stable public API.

## 4. Future goals

Keep these product rules if this work continues:

1. Each nonempty Host Reasoning Item must leave one persistent `thinking` transcript.
2. Short Reasoning must also leave a transcript so the user can see that Reasoning occurred at that point.
3. For a short initial interval, prefer the native preview and avoid an immediate duplicate Shell card.
4. Long Reasoning can switch to a persistent transcript after a threshold so the complete text is visible while generation continues.
5. Do not add exact timer scheduling across Host Runtime for a visual delay.
6. Native Session remains the only source of historical content. Do not store Reasoning text in Mapping Store, localStorage, or a second Transcript store.

## 5. Recommended design: an event-driven delayed transcript

Use a named threshold, for example:

```ts
const REASONING_TRANSCRIPT_DELAY_MS = 5_000;
```

The threshold controls **when the transcript becomes visible**, not whether it exists. All nonempty Reasoning eventually creates a transcript.

### 5.1 Short Reasoning completes before the threshold

```text
0 ms       First Reasoning text arrives; start only the native preview
< 5000 ms  Send later deltas to the native preview
completion Start and complete the thinking transcript with all Reasoning text
```

The user first sees temporary native Thinking feedback. Completion leaves a persistent `thinking` record.

### 5.2 Long Reasoning has deltas after the threshold

Do not register an exact timer. On each Reasoning delta, use its `emittedAtMs` to check elapsed time.

```text
0–5 seconds           Send only the native reasoning preview
First delta with elapsed >= 5s
                      Start the thinking transcript
                      Add all accumulated Reasoning text once
                      Stream later deltas to the transcript only, or retain
                      the native lane if validation requires it
completion            Complete native reasoning and thinking transcript
```

Stop sending new native summary deltas after the transcript starts to reduce duplicate display. A real Desktop Gate must first establish that this does not break native Item completion. Before validation, the implementation can conservatively continue to complete the native Item, without promising its UI behavior.

### 5.3 The threshold passes without another delta

For example, the last delta arrives at 4 seconds and Reasoning completes at 8 seconds. Without an exact timer, no card appears at 5 seconds. The completion event at 8 seconds starts and completes the transcript in one step.

This is an intentional tradeoff:

- Preserve the final record.
- Keep the synchronous Protocol Core projector independent of active Host Runtime timer scheduling.
- Avoid races among timers, Item completion, Turn cancellation, and Host disconnection.

## 6. Recommended state machine

Add only the projection state needed for each projected Reasoning Item:

```text
native-preview
    ├─ completion before promotion
    │      └─ start-and-complete transcript → done
    │
    └─ delta at/after threshold
           └─ start transcript with accumulated text
                    ↓
             transcript-streaming
                    └─ completion → done
```

Fields should express actual projection semantics without a general scheduling abstraction. For example:

```ts
interface ProjectedItem {
  // existing fields...
  reasoningPreviewStarted: boolean;
  reasoningTranscriptStarted: boolean;
  reasoningFirstTextAtMs: number | null;
}
```

Accumulated text already exists in `projected.item.text`; a second text buffer is unnecessary.

Measure time from **the first nonempty Reasoning text entering the Codex projection**, not from an empty `item.started` event or the start of the Turn. The threshold then reflects the Reasoning activity that the user can perceive.

## 7. Why an exact five-second timer is not recommended

To show the transcript at exactly 5000 ms, the system must generate Codex messages without a Harness event. The existing `CodexTurnProjector.project()` boundary is synchronous and event driven. A timer would spread complexity into Host Runtime.

It would also require:

- Exactly one transcript when the timer and `item.completed` occur together.
- Timer cancellation on Turn cancellation or failure, Thread close, and Host disconnect.
- Independent timers for multiple Reasoning Items.
- Serial ordering of timer callbacks and Harness output.
- Rejection of late timers after projector completion.
- Resource cleanup when Runtime is destroyed.
- Virtual clocks and cross-package lifecycle tests.

These costs only make the card appear at exactly five seconds, with limited benefit to the core experience. Use the next delta or completion to trigger promotion instead.

## 8. Historical projection

Keep history rules simple and consistent. Every nonempty historical Reasoning Item projects to:

```text
native reasoning Item
thinking transcript Item
```

Historical snapshots need not record the original duration or whether promotion occurred during execution. Short and long Reasoning both leave a transcript after completion, as required by the product rule.

Native Session supplies the Reasoning body. Protocol Core deterministically rebuilds Codex Items during `thread/read`; it does not create a second persistent content source.

## 9. Implementation boundaries

For future implementation:

- Change only Protocol Core Reasoning projection state and its tests.
- Without an exact timer, do not add a Host Runtime Reasoning scheduler.
- Do not restore a custom Renderer Reasoning panel.
- Do not modify native Reasoning DOM through the Renderer.
- Keep the HarnessAdapter `HostReasoningItem` semantics unchanged.
- Keep the five-second threshold out of individual Harness Adapters.
- Keep `REASONING_TRANSCRIPT_COMMAND` as a shared sentinel constant.
- Continue read-only transcript DOM checks through Renderer/Desktop Contract Audit. Do not render or repair content in the checker.

## 10. Future test checklist

### Protocol Core

- Empty Reasoning creates neither preview nor transcript.
- The first text starts only the native preview.
- Completion before the threshold creates and completes the transcript once.
- The first delta after the threshold creates the transcript; previous and current text each appear once.
- Later transcript deltas are appended once.
- Events exactly at the threshold have deterministic behavior.
- Succeeded, failed, and cancelled outcomes each complete both Items once.
- Multiple Reasoning Items have independent timing and ordering.
- Reasoning remains before subsequent Tool and Agent Messages.
- Historical Turns always restore the complete transcript.

### Host Runtime integration

- `turn/completed` contains the Reasoning preview and transcript in a deterministic order.
- `thread/read` rebuilds the same completed transcript.
- Live deltas are not replayed.
- Official Codex passthrough remains unchanged.

### Real Codex Desktop Gate

- Short Reasoning briefly shows the native preview and leaves one transcript after completion.
- Long Reasoning shows no transcript before promotion and shows the complete text afterwards.
- Completion leaves no duplicate text or permanently in-progress card.
- The transcript can be restored after switching Threads or restarting Desktop.
- Failed/cancelled card state and exit information are consistent.
- After Desktop updates, Item IDs, `outputDelta`, `aggregatedOutput`, and the transcript DOM contract still work.

## 11. Known unresolved issues

1. **Native sentence rotation:** an event-driven delay cannot guarantee that the native preview shows the latest sentence. A separate Gate must investigate `summaryIndex`, multiple summary parts, or other native message shapes.
2. **Carrier semantics:** `thinking` remains a Shell/Command Execution display rather than a dedicated Reasoning transcript type. This is an explicit compatibility tradeoff unless Codex supplies a more suitable persistent native Item.
3. **Derived Item IDs:** evaluate the collision risk between `${itemId}-summary` and opaque Host Item IDs.
4. **Failure state:** keep transcript `status`, `exitCode`, and Reasoning outcome consistent. Do not unconditionally show a successful exit code for failed/cancelled outcomes.
5. **Pending snapshots:** specify whether `pendingTurn()` includes a promoted transcript to support active Turn reads or reconnection.

## 12. Related code and historical material

The current implementation is primarily in:

- `packages/protocol-core/src/codex-ui-projector.ts`
- `packages/shared-contracts/src/reasoning-transcript.ts`
- `packages/renderer-extension/src/renderer-transcript-dom.ts`
- `packages/renderer-extension/src/contract-audit.ts`
- `packages/desktop-control/src/contract-audit.ts`

The earlier custom Renderer panel design depended on Renderer subscriptions, ownership inspection, a custom DOM panel, and preferences. The current direction removes that runtime display logic and supplies only native Reasoning and Command Execution transcript data to Codex. Future work on this proposal must not unintentionally restore the old Renderer panel architecture.
