# ACP layer follow-up

> Status: Not triggered. At this document's baseline, only Grok used production ACP Transport.

## Background

codex-z integrated Grok CLI through ACP v1. Call chain:

```text
Host Runtime
  -> HarnessAdapter
    -> GrokAdapter
      -> GrokAcpTransport
        -> @agentclientprotocol/sdk
          -> grok agent --no-leader stdio
```

`HarnessAdapter` remains Host Runtime's only domain interface. ACP is internal Grok transport. ACP types and Grok `_meta` never enter Host Runtime, Protocol Core, or Renderer.

## Current state

No independent general ACP package or registrable `GenericAcpAdapter` exists at this baseline.

ACP implementation:

```text
packages/adapters/grok/src/acp-transport.ts
```

It encapsulates:

- Grok ACP stdio process lifecycle
- ACP initialize/version validation
- Session create/load/close
- Prompt, streaming Update, and terminal response
- Permission request/response
- Cancel
- Timeout, exit, and startup-error classification
- Inspection initialize/list flow

These mechanisms support later extraction, but interfaces/events/errors remain Grok-named and are not stable shared contracts.

## Grok-owned behavior

Keep in `packages/adapters/grok`:

- Executable lookup and `grok agent --no-leader stdio` arguments
- Login-state/error-text recognition
- `_meta.modelState`, `reasoningEfforts`, and `totalTokens`
- Grok `session/set_model` extension
- Model/Thinking/Usage projection
- Native Session ID/history rules
- Tool-content compatibility
- Grok-specific RPC and future `x.ai/*` extensions

A shared layer must not hide differences behind many Grok callbacks. Concrete Adapters own Harness semantics.

## Why not extract now

Only one production ACP Harness existed at this baseline. Extraction would guess variation and risk a shallow parameterized Grok module.

Principle:

> One Adapter suggests shared interfaces; two real Adapters reveal stable common parts.

Wait for the second minimum production implementation, compare both, then extract shared mechanisms.

## Extraction conditions

Start shared-layer design when:

1. A second Harness uses official ACP in production, not only tests/compatibility.
2. Both use major Session/Prompt/Streaming/Permission/Cancel/close lifecycle parts.
3. Capability/error/configuration/history/exit differences are validated.
4. Concrete Adapters still implement `HarnessAdapter`; Host need not know ACP.

A second client file is insufficient. Confirm shared protocol mechanisms rather than similar mappings with different semantics.

## Suggested shared scope

Possible future package:

```text
packages/acp-transport/
```

It owns transport mechanisms only:

- Official SDK connection
- Configurable stdio startup/close
- initialize and negotiation
- Session new/load/close
- Prompt/Update/Permission/Cancel correlation
- Timeout, connection close, and child faults
- Unchanged/lightly normalized standard payloads

Keep the interface small, for example:

```text
inspect
open
prompt
cancel
close
requestExtension
```

Derive final interfaces from two actual callers, not this draft.

## Excluded responsibilities

Shared ACP does not:

- Implement `HarnessAdapter` or generate Host Events
- Decide codex-z capabilities
- Interpret Harness `_meta`
- Generate Model/Thinking/Permission catalogs
- Build history Snapshots/stable Turn identities
- Infer Unified Diff/Fork/Rollback
- Read local Harness Session files
- Generalize one Harness's error text

These remain Adapter responsibilities.

## Persistent-history identity Gate

ACP Session/Prompt/Update support does not prove durable identities needed for Thread recovery. Each Harness must prove:

1. Native Session ID survives process restart.
2. Each User Turn has a durable, opaque, unique native key.
3. Live `turn.completed.nativeTurnRef` equals resumed Snapshot `nativeTurnRef` after creating a new Adapter.
4. Snapshots use authoritative Harness history, not a second in-memory Transcript.

Item 3 is an integration Gate; Session load or text replay alone is insufficient.

### Stable identity sources

Choose Native Turn keys in this order:

| Harness fact | Adapter action |
| --- | --- |
| Live ACP and `session/load` share a stable Turn ID | Use directly |
| Stable ID appears in Harness extension or `_meta` | Validate/map inside concrete Adapter |
| Replay lacks IDs but native history has them | Read native history inside concrete Adapter |
| Neither provides stable IDs | Do not claim reliable cross-restart recovery |

Do not use:

- Per-execution random UUIDs
- `replay-1`, array indices, or position numbers
- Current-process request IDs
- Message bodies, timestamps, or temporary combinations

Live uniqueness does not ensure the same identity after restart.

### Turn completion

Without a verifiable stable terminal ID, use Pi-style before/after history differences:

```text
Read/map authoritative native history
  -> Save pre-Turn native keys
  -> Execute Prompt
  -> Reread the same history after terminal response
  -> Require exactly one new native Turn
  -> Publish turn.completed with its NativeTurnRef
```

`readSnapshot()` must use the same mapper. Live/recovery paths must not use different key rules. If a successful Prompt cannot confirm exactly one new Turn, return protocol/recovery error rather than guessed successful identity.

### Old-data compatibility

Unstable-key compatibility must be bounded and provably unambiguous:

- Native Session ID must match.
- Persisted/native Turn counts must meet expected relations.
- Turn order/boundaries must be determinable.
- Preserve Host Turn IDs.
- Do not weaken global Host alignment for one Harness.

Compatibility belongs to Adapter/Mapping recovery, not generic ACP. New Adapters use stable identity from the first version and do not copy Grok's old random-key compatibility.

### Required tests

Each new Adapter needs this identity regression:

```text
Execute one Turn
  -> Record turn.completed.nativeTurnRef
  -> Close Adapter
  -> Create a new Adapter instance
  -> Resume the same Native Session
  -> readSnapshot()
  -> Assert identical NativeTurnRef
```

Also test multi-Turn ordering, cancellation/failure terminal identity, and rejection for missing history/multiple new Turns. Reusing one instance or memory replay cannot prove cross-process persistence.

No generic ACP history package is required. Interfaces/extensions/files/formats stay Harness-owned. Reassess extraction after two implementations share semantics and mechanisms.

## Recommended migration

For a second ACP Harness:

1. Implement minimum Transport in its package without Grok changes.
2. Compare real CLI/fixtures for initialize, Session, Update, Permission, Cancel, close, and faults.
3. List identical mechanisms and Adapter-specific differences.
4. Run candidate contract tests on both transports.
5. Create shared package; migrate simpler caller first.
6. Migrate Grok; confirm real create/Turn/Cancel/resume smoke behavior.
7. Remove fully replaced code without dual compatibility paths.

## Validation requirements

Before extraction completion, verify:

- Focused tests for both Adapters
- ACP Transport contract tests
- Permission/concurrency correlation
- One terminal result after cancellation
- Child faults and bounded close
- create/load Session identity
- Equal live/restarted Snapshot native Turn identity
- One real synthetic-Prompt smoke test per Harness
- No ACP types/event branches added to Host, Protocol Core, or Renderer

## Reference files

- `packages/adapters/grok/src/acp-transport.ts`: Connection/process mechanisms
- `packages/adapters/grok/src/grok-adapter.ts`: ACP to domain events
- `packages/adapters/grok/src/grok-models.ts`: Model/Thinking metadata
- `packages/adapters/grok/src/grok-usage.ts`: ACP/Grok Usage mapping
- `packages/adapters/grok/src/grok-history.ts`: Native history/Snapshot/stable identity
- `packages/adapters/grok/test/grok-adapter.test.ts`: Adapter tests
- `docs/archive/grok-integration/grok-cli-adapter-integration.md`: Archived integration/capabilities

## Decision summary

- Baseline: Grok-private ACP Transport, no general layer.
- Preserve: `HarnessAdapter` as Host's only domain abstraction.
- Trigger: Second production Harness with validated differences.
- Goal: Share transport mechanisms, not Harness semantics.
