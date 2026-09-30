# Public Adapter behavior

Use current types from `packages/harness-adapter/src/text-session.ts`. Do not copy public interfaces or schemas into the plugin.

## Core implementation and optional capabilities

| Object | Core responsibility | Unsupported behavior |
|---|---|---|
| Adapter | Stable `harnessId`; inspect, open, complete close | Expected inspection failure uses inspection state; open failure uses `HarnessResult` |
| Session | Actual capabilities, initial state/Usage, ordered outputs, execute, read-only snapshots, close | Keep public methods; unsupported operations return `unsupported` |
| Native configuration | Model, Thinking, Permission Mode according to capability | Set capability false; do not invent Catalog or effective values |
| History derivation | Fork, cross-cwd Fork, Rollback according to capability | Set applicable history capability false; open branch returns `unsupported` |
| Optional interfaces | See the table below | Do not provide meaningless empty interfaces |

If native code provides required tools, interactions, or autonomous execution, map the actual behavior. Do not reduce it to text echo to reduce work. Capabilities without a typed capability field must still appear in the delivery capability list.

## Inspection: `inspect({ cwd, refresh })`

- Check installation, authentication, availability, Catalog, and capabilities without creating a user Session or submitting a Prompt.
- Respect cwd. Partition successful caches by actual configuration scope; refresh bypasses caches. Close temporary inspection Transports.
- Expected failures return `notInstalled`, `unavailable`, or `error`, not arbitrary exceptions.
- ready results pass `harnessInspectionSchema`. Permission Mode Catalog agrees with `selectPermissionMode`.
- Model Refs retain native Provider/Model identity but remain opaque to the Host and satisfy the shared transport-safe schema.
- Catalog references, defaults, and per-Model Thinking options agree. Represent fixed Models or empty Catalogs as real capabilities. Do not invent selectable Models to satisfy UI.

See `packages/shared-contracts/src/harness-models.ts`; for permissions, also read `packages/shared-contracts/src/harness-permission-modes.ts`.

## Open: `open(input)`

Recognize all `OpenSessionInput` branches. See [identity and history](thread-lifecycle-and-history.md) for identity/history requirements.

- Validate cwd, input, and Native Ref Harness ownership. Reject unsupported branches before side effects.
- Propagate `input.environment` through every actual open path, including resume and supported derivation. Factory environment is the base; Session environment contains current Thread overrides and must take precedence.
- Return typed expected failures. Clean new connections, subscriptions, and temporary resources on failure. Plugins do not modify source history or Host mapping transactions without authority.
- Returned Sessions remain executable. A read-only native Subagent Transcript is not an ordinary writable Session.

### Execution intent and permissions

`create.executionPolicy` is Host execution intent, not native Permission Mode. For `unattended-full-access`:

1. If native configuration is supported, map equivalent permission/sandbox/interaction policy and confirm success.
2. If a verified native baseline already satisfies it, allow a deliberate no-op supported by tests. For example, do not pass nonexistent permission arguments to Pi.
3. If it cannot be ensured, reject with a typed error. Do not ignore it silently or invent approval responses.

`permissionModeScope: "atCreate"` permits selection only at creation. `selectPermissionMode` true does not guarantee live changes. Explicitly reject unsupported Session changes. Grok provides an example of creation-time permissions; do not copy its Host recovery special case.

## Configuration and state: requested differs from effective

- `initialState`, `session.state.changed`, and snapshot state report confirmed native state only.
- Native identity can be published later, but remains stable within the same public Session after establishment.
- Preserve omitted Model/Thinking fields so native configuration selects defaults. Do not substitute Renderer preferences.
- Wait for native configuration acknowledgement before returning completed and publishing state. Do not publish requested values after acknowledgement failure.
- A Model change can change Thinking too; publish a complete consistent state. State/Usage events are not undeclared field patches.
- On recovery, distinguish configuration not read this time from confirmed absence. Do not restore cleared Thinking/permission from old persisted values.
- If configuration requires Transport restart, verify same identity, failure recovery, rebuilt subscriptions, and resource close. See OMP without copying its private protocol.

## Commands, concurrency, and errors

- Successful `turn.start` means acceptance only; outputs provide terminal state. Rejection emits no Turn lifecycle events.
- An active Turn excludes a second Turn and history operations. Conflicts return retryable `sessionBusy`; do not queue or preempt implicitly.
- During active Turns, Model/Thinking selection follows [runtime configuration rules](../../../../docs/architecture/harness-plugin-runtime.md#change-model--thinking-during-execution). An active Turn alone is not a rejection condition. Test native acceptance, rejection, and subsequent Turns.
- `interaction.respond` must work within its Turn. Native semantics determine whether permissions can change during activity; still control configuration concurrency.
- Validate empty input, Turn ID, Interaction ID, and configuration references. Cancel only the matching active Turn.
- Return `invalidState` after close or fault. Do not treat a usable Session after cancellation as faulted.
- Normalize native errors as `HarnessError`. Distinguish missing installation, authentication, missing Session, protocol error, process exit, and operation failure. Set retryable appropriately.
- Use public diagnostic sanitization. Credentials must not appear in errors, logs, Refs, routes, or test artifacts. Factory Context is not itself a credential filter.

See [outputs and interactions](output-and-interactions.md) for event order and close terminal state. Adapter and Session close are idempotent. End outputs and close processes/streams/connections/subscriptions/timers. Closing one instance must not affect independent instances on other connections.

## Optional interfaces according to native capability

| Interface | Implementation requirement | Current upper-layer boundary |
|---|---|---|
| `session.refreshUsage()` | Query reliable statistics and publish complete Usage; unknown is null; collection failure does not fail a healthy Turn by default | Verify initial values, refresh, and notifications through public Usage |
| `session.commands` | Validate Catalog/arguments; use Host turnId and normal Turn/Item outputs; reject unknown commands | Reuse public command UI, such as compact |
| `adapter.subagents.readSnapshot()` | Stable native Subagent identity and read-only Transcript; matches capability declaration | Different from cross-Harness delegation |
| `adapter.sessionImport.listCandidates()` / `resolveCandidate(id)` | list returns browser-safe metadata; resolve validates again and returns `{ candidate, nativeRef }`; Adapter confirms full locator; no Host mapping writes | Local Host/RPC/Settings are generic; Pi and DSH Modern are integrated. Legacy list-only plugins are excluded. Remote and CC Broker are not extended |
| `adapter.webUi.open()` | Matches inspection webUi; local opening prefers Context service | managed remote has no local opener; report missing service as unavailable, do not bypass Native Launcher |

Related schemas: `packages/shared-contracts/src/harness-commands.ts`, `harness-session-import.ts`, and `thread-usage.ts`. Parse Usage with `parseHostUsage()`. See [`docs/architecture/harness-session-import.md`](../../../../docs/architecture/harness-session-import.md) for import contracts, unknown runtime state, and acceptance.

**Credits is not yet an official Adapter field.** The Host uses structural `credits()` / `refreshCredits()` checks and Renderer special cases. For a new Harness quota display, check public extensions and consumers separately. Do not invent Manifest capabilities or promise automatic integration.

## Acceptance

Prove through public interfaces: inspection has no user Session side effects; input/capability validation is accurate; create, subsequent Turns, cancellation, and close work; every supported configuration write has native acknowledgement; Session environment overrides work; failures leak no resources. Add rejection tests for unsupported and limited branches, not only success tests.
