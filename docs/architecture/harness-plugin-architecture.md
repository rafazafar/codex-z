# Harness plugin architecture and behavior-preserving migration

> Status: Target architecture proposal. Seven existing Harnesses use dynamic loading and separate bundles; full migration is incomplete. Interface examples are not current repository APIs. See [plugin runtime](harness-plugin-runtime.md) for implemented scope, contracts, and limits.
>
> Analysis baseline: Source, tests, and change history at `d2fc9391f5de076394e1b99970bb1bb2f137e5be`. No native Harness or regression tests ran for this analysis. It is not runtime compatibility evidence. Recheck source differences before implementation.

## 1. Conclusions and goals

The goal is a codex-z Host without knowledge of concrete external Harnesses. Public layers discover installed plugins; each supplies name, icon, installation information, capabilities, native implementation, and compatibility. Adding a Harness delivers a plugin/configuration without core changes or Renderer rebuilds.

This architecture is feasible. `HarnessAdapter / HarnessSession`, mostly separate native Transports, and general Renderer controls already exist. No structural obstacle was found that requires reducing existing capabilities.

Feasibility does not guarantee zero regression. Release constraints preserve every supported capability and its semantics through behavior baselines, staged migration, historical compatibility, and regression validation. Unknown problems cannot be excluded before implementation/testing.

For continuous integration and independent Harness updates, this architecture is preferable long-term. Use a small Host with strongly typed plugins, rather than universal RPC, arbitrary plugin UI, or a complex extension platform.

### 1.1 Testable goals

1. Public production code neither imports concrete external packages nor selects execution/recovery/display policy by their IDs.
2. Plugins carry metadata, assets, entries, dependencies, native integration, and private compatibility.
3. Core/Renderer maintain no external Harness list.
4. Query catalogs per target Host; local/remote installations can differ.
5. With all external plugins removed, core/Renderer still build/run and official Codex remains available.
6. A previously unknown plugin ID can be discovered/displayed/called after installation, enablement, and restart.
7. Existing Threads, native Sessions, configuration, interactions, and supported operations pass defined compatibility acceptance.

### 1.2 Scope of public layers without specialized code

Public layers include external Host orchestration, routing, shared contracts, Renderer, and general loading facilities, excluding plugin implementations.

Harness names may appear in their plugins/tests, preinstalled manifests, compatibility fixtures, and documentation. Acceptance concerns production dependencies/policies, not removal of every name. Release composition must not become static Adapter imports in core runtime.

Desktop protocol, official app-server, and Renderer compatibility remain product integration; this migration does not require a general frontend-plugin system. Follow [terminology](../project/terminology.md), keeping Harness, Model, Provider, and Account distinct.

### 1.3 Non-goals

- Do not reimplement Agent Loops.
- Do not reduce all SDK/RPC/CLI/Host APIs to ACP.
- Do not rewrite transports/history/projection solely for uniformity.
- No first-phase marketplace, downloads/upgrades, hot replacement, or live unload.
- No unrestricted plugin access to Desktop DOM, React state, private Electron APIs, or RequestManager.
- No unlimited `invoke(method, any)` or arbitrary HTML/JavaScript injection.
- Do not include new capabilities or known-defect fixes inside behavior-preserving migration.

## 2. Analysis baseline and differences

This section records pre-migration analysis. Static composition and bundled Host SDKs were later removed. See [runtime](harness-plugin-runtime.md) for current implementation.

These architecture-relevant summaries are not a complete matrix or real-system tests. Freeze capabilities by native version, protocol generation, and mode.

| Harness | Baseline characteristics | Differences to preserve |
| --- | --- | --- |
| Pi | Native RPC; Model/Thinking, commands, questions, autonomous Turns, Fork/cross-directory Fork/Rollback | No Session Permission Mode selection; do not impose another Harness's policy |
| Claude Code | Agent SDK; approval, questions, Subagents, background continuation, Credits; Fork/Rollback, no cross-directory Fork | Native callbacks/background lifecycle; dedicated macOS managed-remote Broker |
| OMP | Native RPC; permissions, approval/questions, Subagents, background Turns, cross-directory Fork/Rollback | Permission changes can restart connections; unavailable Models can change on resume, without reviving stale Thinking |
| Grok | ACP/extensions; approval, compaction, Credits, Fork/cross-directory Fork/Rollback | Permissions fixed at create; ordinary resumed configuration cannot set them later |
| OpenCode | SDK/Server events; fixed `/compact`, approval/questions/Diff/Fork/Rollback; no cross-directory Fork | Cumulative permission APIs; respect actual native state without unconditional replay |
| DeepSeek Harness | Validated 012rc1/015rc1/015rc2/015rc3/017rc1; other SemVer can attempt managed Web/protocol; confirmed control state, autonomous Turns/import; no Legacy | V0/V3/V4 logs/Assistant streams, version/profile/checkpoint isolation, confirmation, correlation, and authentication stay plugin-owned |
| Antigravity | CLI stream-json; configuration/tools/file changes/Credits; no Fork/Rollback | Private supplemental history/recovery must not move to Host or disappear |

Plugin-owned recovery does not mean every Harness exposes complete native Transcripts. Host creates no second full-body source of truth. Plugins may retain private records needed for recovery.

### 2.1 Existing useful boundaries

- [`HarnessAdapter / HarnessSession`](../../packages/harness-adapter/src/text-session.ts): Open, inspect, execute, output, Snapshot, close.
- [`HarnessId`](../../packages/shared-contracts/src/ids.ts): Branded nonempty string, not an enumerated list to expand.
- `packages/adapters/*`: Most native protocol/SDK/history code is separate.
- [`CodexTurnProjector`](../../packages/protocol-core/src/codex-ui-projector.ts): Public events without duplicate plugin Desktop projection.
- General Model/permission/Usage/Credits/command controls exist; orchestration/data sources remain the main gaps.

### 2.2 Static registration and display coupling

External Harness knowledge exists in several places:

- Baseline `adapter-composition.ts`: Static imports, constructors, prefetch, Claude Broker. Removed; see [`installed-harness-plugins.ts`](../../packages/host-runtime/src/installed-harness-plugins.ts).
- [`model-routing.ts`](../../packages/protocol-core/src/model-routing.ts): Fixed list, dedicated Transport Model constants/branches.
- [`agent-selection-state.ts`](../../packages/renderer-extension/src/agent-selection-state.ts): Fixed Agent union, `piModel`/`claudeModel` fields.
- [`versioned-renderer-adapter.ts`](../../packages/renderer-extension/src/versioned-renderer-adapter.ts): Duplicate dedicated encodings.
- [`renderer-binding-probe.ts`](../../packages/renderer-extension/src/renderer-binding-probe.ts): Ownership recovery, Credits whitelist, Claude preferences.
- [`renderer-agent-picker.ts`](../../packages/renderer-extension/src/renderer-agent-picker.ts): Installation URLs; icon modules hold names/assets.
- [`production-controller.ts`](../../packages/desktop-control/src/production-controller.ts): Another fixed Agent list.
- [`build-release.mjs`](../../packages/host-runtime/scripts/build-release.mjs): Required fixed Adapter/SDK Host bundles at baseline.

Replace these with descriptions/runtime catalogs, not another public static registry.

### 2.3 Recovery-policy leakage

[`external-thread-runtime.ts`](../../packages/host-runtime/src/external-thread-runtime.ts) selects recovery by name:

- Grok: Pass saved permissions into `open({ kind: "resume" })`.
- Some others: Call `permissionMode.select` after open.
- OpenCode: Skip permission replay.
- OMP/OpenCode: Re-encode/save actual configuration to prevent stale tokens on later resume.

These protect behavior and cannot simply be removed. See [`external-thread-runtime.test.ts`](../../packages/host-runtime/test/external-thread-runtime.test.ts). Move recovery decisions to plugins while Host retains state validation/mappings.

### 2.4 Optional capabilities are not connected end to end

**Session Import:** Local RPC/importer/settings are general; Pi/DSH share the path. DSH 012rc1/015rc1/015rc2/015rc3/017rc1 are validated; other SemVer still needs native validation. `listCandidates()` returns metadata; `resolveCandidate(id)` rechecks full refs. Host owns deduplication/concurrency/busy/provisional cleanup. Remote/Claude Broker import remains incomplete. See [contract](harness-session-import.md).

**Credits:** Host detects `credits()`/`refreshCredits()` structurally rather than as formal members. Renderer waits through Codex/Grok/Claude lists, while Antigravity also has methods. This is double capability wiring, not proof of a specific UI defect.

**Localization:** Public `permissionModeScope: "atCreate"` exists, but notices hard-code Grok. Native permission labels/descriptions also have public translations.

### 2.5 Peripheral coupling

- [`run-host-runtime.ts`](../../packages/host-runtime/src/run-host-runtime.ts): Explicit Claude/Antigravity prefetch.
- [`harness-broker`](../../packages/harness-broker/src/protocol.ts): Descriptors/client/server remain Claude-specific, not a general plugin protocol.
- [`delegation-skill.ts`](../../packages/host-runtime/src/delegation-skill.ts): `.claude` installation knowledge.
- Baseline [`remote-host-install.ts`](../../packages/host-runtime/src/remote-host-install.ts) fixed `claudeCommand`; that install/start exception is removed. Adapters still own executable discovery.
- Release scripts maintain native SDK/license sets.

Dynamic local chat alone is not complete plugin separation. Include remote execution, delegation, environment, and distribution.

### 2.6 Lessons from change history

| Commit | Topic | Architecture lesson |
| --- | --- | --- |
| `7247264` | Grok create-time permissions; 37 files | Shared scope is valid, but Host should not choose recovery by name |
| `f73214a` | OpenCode actual-permission recovery | Recovery is not unconditional replay |
| `1471d3e` | OMP permission interaction and two-sided routes | Dedicated parameter order spreads changes into public wiring |
| `8bfb946` | Optional import discovery | General lower contracts still need RPC/UI integration |
| `3865276` | Antigravity recovery moved to Adapter | Private history belongs in plugins |

A Harness-triggered public change is not always wrong. Determine whether the concept is shared product behavior or leaked native mechanics.

## 3. Target layers and dependencies

```text
┌──────────────────────────────────────────────────────────┐
│ codex-z public layers                                    │
│                                                          │
│ Desktop integration / general Renderer                   │
│ Thread / Turn / delegation / mapping / event projection   │
│ General Session Import / configuration / Usage / Credits │
│                         │                                │
│                Plugin Loader + Registry                  │
└──────────────────────────────────────────────────────────┘
                          │ stable contracts only
══════════════════════════╪═════════════════════════════════
                          │ read installed plugins
┌──────────────────────────────────────────────────────────┐
│ plugins/                                                 │
│                                                          │
│  pi/              claude-code/       another-harness/     │
│  manifest.json    manifest.json      manifest.json        │
│  entry.mjs        entry.mjs          entry.mjs            │
│  assets/          assets/            assets/              │
│ Native implementation/dependencies for each plugin       │
│ Private recovery/compatibility for each plugin           │
└──────────────────────────────────────────────────────────┘
```

Directories are logical, not fixed installation paths/single-file requirements. Source can remain in existing packages behind plugin entries, avoiding meaningless moves.

Dependency direction:

```text
Core ───────→ public plugin contracts ←─────── plugins
Renderer ──→ browser-safe display/transport contracts
Plugins ───→ own native SDK/CLI/private recovery/compatibility
```

Registry owns descriptions, identity lookup, and instance lifecycle, not Turn orchestration. Loader owns discovery/validation/import. Modules may share one package; no extra services are needed for uniformity.

## 4. Ownership

| Content | Public layer | Plugin |
| --- | --- | --- |
| Names/icons/install links/private text | General display/resource validation | Metadata/assets |
| Native Session lifecycle | Call/validate contracts | Create/resume/Fork/Rollback |
| Configuration recovery | Context/public view | Native read/restore/restart/confirm policy |
| Threads/mappings | Identity/uniqueness/transactions/cleanup | No direct store access |
| History | Read/alignment/projection | Native reads/private records/recovery |
| Approval/questions/tools | Correlation/Desktop projection | Native event/response conversion |
| Commands | Catalog/call/Turn orchestration | Catalog/validation/native execution |
| Session Import | Deduplication/concurrency/mapping commit | Candidate discovery/identity/availability |
| Credits | Typed snapshots/general controls | Native collection/cache/refresh |
| Web UI | Controlled opening/general entry | Native URL/authentication/availability |
| Old formats | General dispatch | Own parsing/migration |
| Platform processes | Rust/platform native management | Connection choice/plugin communication |

Public layers retain business behavior, not blind forwarding. Branch on create-only capability, not on the name Grok.

## 5. Discovery, description, and lifecycle

### 5.1 Discovery and enablement

Use the same load flow for preinstalled resources and user-data plugins. Determine names/configuration during implementation; one explicit root is sufficient initially.

- Do not scan arbitrary projects and execute code.
- Discovery does not grant trust or enablement.
- Require explicit enablement; reject or explicitly resolve duplicate IDs, without scan-order overwrite.
- Load on startup and apply through restart, without live replacement.
- Disable/removal preserves Thread/native/private data.
- Preinstalled plugins use the same contract, without special internal execution paths.

### 5.2 Static description example

This illustrates field responsibilities, not final APIs:

```json
{
  "manifestVersion": 1,
  "id": "example-harness",
  "name": "Example Harness",
  "version": "1.0.0",
  "adapterApiVersion": 1,
  "entry": "./entry.mjs",
  "icon": "./assets/icon.png",
  "links": {
    "documentation": "https://example.com/docs",
    "installation": "https://example.com/install"
  }
}
```

Manifest describes identity/assets/API compatibility, not every runtime capability. `inspect()`/Sessions supply installation, Model/permission catalogs, and capabilities. DeepSeek protocol generations/Model-dependent choices show why static claims are insufficient.

### 5.3 Explicit loading instead of global registration

```text
Read descriptions → validate compatibility/paths → load enabled entries
                  → call factory → validate identity → register instance
```

Entries return `HarnessAdapter` for explicit Loader registration. Import side effects must not write hidden registries. Context supplies needed configuration/environment/controlled services, not whole `AppServerHost`, mapping store, or Renderer controller.

Version plugins/public APIs separately with compatibility rules. Workspace `0.0.0` is not a mature publishing protocol. Add runtime validation, not TypeScript-only checks.

### 5.4 Instance scope and performance

Descriptions can cache, but per-Host/connection lifecycles must not become global singletons. Preserve native Session/cwd/environment/remote/close scopes.

Enumeration reads descriptions without creating user Sessions. Loading/inspection/prefetch need concurrency/time limits so one plugin cannot block official Codex/others. Existing prefetch can become nonblocking plugin initialization with observable failures/cleanup.

Catch in-process exceptions/invalid returns at boundaries. Promise timeouts do not isolate synchronous loops or crashes. Add out-of-process hosting only for real needs; do not advertise in-process fault/security isolation.

### 5.5 Trust and resources

- Plugins are trusted code. Sources/enablement must be explicit; directories are not isolation.
- Validate resolved entry/assets including symlinks against roots.
- Limit metadata/icons/text/responses and prefer validated images; never execute asset scripts.
- Renderer gets controlled resources, not arbitrary files or Node entries.
- Do not expose private environment/credentials/endpoint secrets.
- Unknown/missing/incompatible plugins are unavailable, never official fallback.

## 6. Execution contracts and configuration recovery

### 6.1 Preserve strongly typed contracts

Keep `HarnessAdapter / HarnessSession`, `HostEvent / HostInteraction`, native Session/Turn/Checkpoint refs, and errors. Do not replace typed events with arbitrary JSON.

Distinguish product constraints from native create/resume/Fork/Rollback implementation. Host can validate rollback of one Turn with configuration preserved, but must not choose steps by name.

### 6.2 Share recovery input/results, not native steps

Separate historical hints from new user instructions. Concept example:

```ts
adapter.open({
  kind: "resume",
  nativeRef,
  cwd,
  knownTurnRefs,
  configurationHint,
});
```

`configurationHint` is a design placeholder, not a current API. It is neither forced override nor permission elevation. Plugins preserve existing policies:

- Grok restores fixed permissions during open.
- OpenCode respects actual permissions without cumulative replay.
- OMP handles real Model fallback, permissions, and necessary restart.
- Claude/others take ownership of former Host recovery steps.

Host uses confirmed state for public views without invented effective values. Old reads/backfill remain compatible, not one-time bulk rewrites.

### 6.3 Explicit state completeness

Distinguish:

1. Unknown state with omitted fields;
2. Confirmed absence, such as a Model without Thinking.

Unknown is not clear; confirmed absent Thinking must not revive from saved configuration. Use minimum explicit types and check initialState/events/Snapshots, without ID-specific repair.

## 7. Routes, configuration, and old formats

### 7.1 One versioned carrier

Carry version, Harness ID, optional Model/Thinking/Permission Mode. Share browser-safe encoding between Renderer/protocol; no new Harness parameter permutations.

Decoded structure does not prove installation/request validity. Validate Registry/ownership/capabilities/native options.

Unknown/expired/invalid external carriers fail, not official fallback after decode failure. Ordinary non-project official routes retain behavior.

### 7.2 Plugin-owned old formats

Mapped `harnessId` locates the plugin, which interprets old transport/recovery data and returns public structure. Renderer no longer parses seven private formats.

Unbound old create requests may use plugin-declared prefixes/constrained decoders. Loader checks namespaces/conflicts; public routing dispatches without a list.

Do not hide special code in a public `legacy-harnesses` module. Temporary compatibility needs scope/exit conditions and must not become a new-plugin extension point.

### 7.3 Persistence and uninstall

- Preserve existing Harness/Thread/native identities.
- Core interprets public structure; plugins interpret opaque native content. Do not guess Harness from ID text.
- Missing plugins preserve records with general unavailable state; reinstall compatible versions to resume.
- Long-term `transportModelId` is Desktop transport, not sole configuration storage. Introduce structure incrementally.
- Private records use managed independent locations, without dependence on Host internal storage.
- Design format compatibility/rollback separately. Do not combine unprotected irreversible migration and execution changes.

## 8. Optional capabilities and specialized extensions

Complete existing capabilities before creating a broad general-operation engine.

| Capability | Goal |
| --- | --- |
| Commands | Static `adapter.commandCatalog` without Session/native discovery; execute through `session.commands`, preserving arguments/busy/Turn/Item/cancel/temporary-history behavior |
| Credits | Formal optional API with `AccountCreditsSnapshot`, explicit cached/refresh/unknown/failure state, no structural detection/Renderer list |
| Session Import | Plugin discovers candidates/full refs; Host imports/deduplicates/coordinates/commits |
| Web UI | Optional native address/auth/availability with controlled public opening |

### 8.1 Session Import constraints

Import happens before target Thread creation. It is not a slash command/user text Turn, and plugins must not write mappings.

Lists have browser-safe metadata only. `resolveCandidate(id)` returns fresh `{ candidate, nativeRef }`; plugins confirm full refs. Host neither guesses formats nor accepts Renderer locators. Resolution is read-only, not prepare/commit/rollback. Host owns transactions.

Preserve candidate revalidation, busy rejection, idempotence, cross-request races, and failure cleanup.

### 8.2 No promise of arbitrary UI without changes

No Renderer changes applies within existing public interactions. Private commands use catalogs; complex pages use native Web UI. New shared interactions can need contract/control evolution.

Do not achieve unlimited extensions through arbitrary JS/DOM, or flatten typed approval/import/permissions into arbitrary methods.

Commands follow [Harness Command Integration Guide](harness-command-integration.md).

## 9. Renderer, metadata, and remote catalogs

Renderer gets serializable descriptions/capabilities/state from target Host only, without scanning local roots or loading backend code.

- Pickers/names/icons/install links/private translations come from plugins.
- Drafts/configuration use Host/Harness ID, not fields such as `piModel`.
- Model/Thinking/permissions come from inspection. Fake Models cannot bypass unselectable/empty catalogs.
- Restore through Host structured ownership/configuration, not Harness decoders. Baseline Codex optional `accountId` comes from saved binding; locked notices use it. New Threads retain submitted identity until binding returns, without global fallback.
- Fixed-permission notices use general/plugin descriptions without hard-coded Grok.
- Migrate old Claude preferences with bounded compatibility, not permanent branches or arbitrary access to other browser data.
- Separate local/remote catalogs; validate response Host after switching so old requests cannot overwrite new workspace state.
- Scope icon/metadata caches explicitly. Descriptions of unavailable plugins are not execution authorization.
- Host/Renderer protocol compatibility still matters; dynamic plugins do not make every version interoperable.

## 10. Native hosting, delegation, and distribution

### 10.1 Native hosting

Plugins own Claude direct/macOS Broker and DeepSeek V0/V3/V4 profile selection. DSH starts managed Web only, without Legacy attach. Protocol differences remain private. Existing Claude Broker can remain specialized without a universal RPC rewrite.

Rust owns launch/process/install/platform work. Parameterize limited process/service descriptions if needed, without native understanding of Session/permission semantics.

### 10.2 Delegation

Public layers own independent Threads/relationships/follow-up/cancel/results. Plugins propagate environment and provide native discovery/integration.

Specific Skill-directory knowledge belongs to plugin declarations/integrations. General file installation retains conflict/path/write protection. Validate recursive delegation, read-only observation, and remote environment.

### 10.3 Distribution

- Core need not contain all SDKs.
- Plugins carry dependencies/assets/licenses/platform needs, without single-file requirements.
- Release composition owns preinstalled sets, not core compilation.
- External installation does not change core SDK whitelists; plugin audit/trust retains security/license checks.
- Test installed artifacts, not only complete Workspace symlinks/dev dependencies.
- Include SSH/Remote Control/discovery/Node environment, not local-only checks.

## 11. Behavior constraints and risks

### 11.1 Release constraints

1. Preserve supported streaming/tools/Diff/approval/questions/cancel/history/configuration/Usage/Subagent/delegation.
2. Do not alter transport, permission baselines, or policy for uniformity.
3. Do not fabricate capabilities/effective configuration/native identity/checkpoints.
4. Never route unknown/unavailable external Threads to Codex.
5. Retain one fixed Harness per Thread.
6. Plugin removal does not erase history/native data.
7. Do not change default distribution before compatibility validation.

### 11.2 Specific risks

| Risk | Evidence and control |
| --- | --- |
| Recovery becomes replay | Breaks Grok/OpenCode/OMP differences; migrate existing policy/tests |
| Incomplete capability declarations | Claude/OMP autonomous output is incompletely declared; inspect implementation before filtering |
| Hosting-mode differences | Baseline Claude direct Credits lacks Broker forwarding; freeze mode behavior, not unimplemented features |
| State-field changes | Separate unknown/confirmed absence to prevent stale Thinking/permissions |
| Plugin import transactions | Discovery belongs to plugin; mappings/races to Host |
| Lost old routes/preferences | Retain private compatibility and old-data fixtures |
| Missing artifact SDKs | Test independent packages/platform resources, not just source |
| Plugin affects whole Host | Trusted loading/checks/cleanup; no in-process crash/block isolation guarantee |
| Typed capabilities become arbitrary JSON | Preserve typed contracts/existing optional capabilities |

Preserving capability includes persistence/order/interactions/history precision/identity/cleanup/errors/startup blocking, not merely final text.

## 12. Staged migration

Verify equivalence per stage rather than waiting for complete refactoring. This is an engineering plan, not completed work or an installation wizard.

| Stage | Work | Exit condition |
| --- | --- | --- |
| 0: Baseline | Record seven Harnesses by version/protocol/mode with capabilities/limits/tests/real-system needs | Protected behavior explicit; gaps/problems recorded separately |
| 1: Description/factory | Common entries/descriptions preserving natives/distribution | Registration changes without execution changes; no immediate full moves/splits |
| 2: Recovery/capabilities | Move policies, formalize Credits, generalize import, retain transactions | No name-based Host native policy; behavior tests remain valid |
| 3: Catalog/routes | General encoding/private compatibility/Renderer state/display/Controller enablement | New IDs add no lists/switches/icons/private preference branches |
| 4: Distribution/peripherals | Independent packages/version checks/trusted roots/Broker/delegation/remote ownership | Core independent; installed/remote paths testable |
| 5: External acceptance | Unknown-source plugin, missing/conflict/incompatible/all-capability tests | No core/Renderer change; all release Gates pass |

If native projection/permission changes are required, describe reasons/risks/tests separately. Do not hide them as mechanical migration. Temporary branches need exit conditions to avoid permanent dual execution.

### 12.1 Rollback

- Prefer readable old formats over irreversible bulk conversion.
- Code rollback restores each prior stage without parallel Adapters/duplicate Turns.
- New unreadable formats need explicit downgrade plans/compatibility tests before enablement.
- Failed installation/enablement preserves previous working configuration/data.

## 13. Validation and acceptance

### 13.1 Three levels

| Level | Content |
| --- | --- |
| Adapter/contracts | Replay deterministic natives; compare admission/order/correlation/state/Snapshot/errors/close, normalizing only nonsemantic randomness |
| Host/Renderer | Routes/ownership/controls/configuration/old data/transactions/recovery/Host switching |
| Artifacts/real systems | Actual installation/dependencies/native versions/auth/platform processes/remote execution |

Do not demand identical real-Model words or rely only on mocks/final text/booleans. Existing tests are not executed evidence; record commands/results/skips/reasons.

### 13.2 Required regressions

- Every Harness inspect/create/follow-up/resume/cancel/error/close.
- Supported tools/Reasoning/Diff/approval/questions/responses.
- Grok fixed permissions during resume/history operations.
- OpenCode no false replay/effective state after failed confirmation.
- OMP fallback/absent Thinking/permission restart recovery/Subagents/background Turns.
- Claude local/Broker callbacks/background behavior.
- DSH 012rc1/015rc1/015rc3/017rc1 separately validated; rc.2 real Gate passed on macOS with fixed dependencies/startup Web profiles. Focused checks cover SemVer/state/correlation/import races/busy/V0/V3/V4 checkpoints.
- Antigravity supplemental history/restart/file changes.
- Supported exact Fork/cross-directory limits/Rollback/stable Turn/checkpoint identity.
- Usage/Credits unknown/refresh/failure and Thread/Host isolation. Baseline Codex cache/refresh/invalidation isolates Account: existing Threads use saved identity; drafts query `codex-z/account/usage/inspect` by selected `accountId`. Switching clears stale data; expired responses cannot overwrite it. Unknown/unavailable accounts do not query global defaults.
- Command catalogs/text arguments/execution/cancel/temporary Turns/history differences.
- Delegation create/follow-up/cancel/observe/recursive environment.
- Readable old Threads/routes/preferences and clear missing-plugin states.
- SDK resources/Node/SSH/Remote Control/process exit/cleanup.

### 13.3 Architecture acceptance

- [ ] Public production has no concrete Adapter/SDK dependency.
- [ ] Public policies do not select by external Harness ID.
- [ ] Renderer has no external lists/private fields/install links/old encodings.
- [ ] Plugins own old-format/preference compatibility, not a shared table.
- [ ] Core/Renderer work without external plugins.
- [ ] External plugin configuration requires no core/Renderer edits/rebuild.
- [ ] Duplicate/invalid/incompatible/unknown/missing/load failures are explicit.
- [ ] Failure neither misroutes nor deletes data; resources close by contract.
- [ ] Local/remote catalogs and protocol compatibility are explicit.
- [ ] Native baselines/installed artifacts are validated; incomplete checks are not reported passed.

Use dependency graphs/import rules/focused source/external tests, not a repository-wide Harness-name ban.

## 14. Benefits, costs, and tradeoffs

| Area | Benefit | Cost/risk |
| --- | --- | --- |
| New Harness | Changes local to plugin | Loader/runtime validation |
| Native upgrade | Independent SDK/plugin release | API/plugin/native compatibility |
| Diagnosis | Policies/tests colocated, fewer package traces | Loading errors beyond static compilation |
| Renderer | General metadata/interactions | Catalog/assets/cache/async scope work |
| Remote | Capabilities reflect each installation | More hosting-mode validation |
| Trust/distribution | Explicit boundaries, fewer core SDKs | Independent audit/install responsibility |
| Migration | Less long-term coupling/missed wiring | Short-term cross-package work, not simple line reduction |

Static integration is a validated migration starting point, not final extensibility. One static registry cannot enable zero-core-change integration. Universal hooks/RPC weaken typing/lifecycle/security; mandatory process separation adds serialization/hosting costs and is not the first prerequisite.

Recommendation: Declarative discovery/registration, stable typed Sessions, limited real optional capabilities, and plugin-native policy. Product semantics may evolve contracts, but ordinary new Harnesses/commands must not repeatedly change public wiring.

## 15. Decisions still needed before implementation

These interface/validation tasks do not reject the target:

1. Final roots/enablement/conflict formats.
2. Manifest/API compatibility and public-package publishing.
3. Minimum hint/unknown/confirmed-absence types.
4. Candidate/full-ref confirmation.
5. Credits refresh/cache/state semantics.
6. Bounded old routes/preferences/resources compatibility.
7. Per-connection instances/initialization performance.
8. Claude Broker/delegation/remote plugin interfaces.
9. Seven-Harness real-system conditions by protocol/mode/version.

Until resolved, promise no file count/schedule/zero regression. Completion requires consistent implementation/contracts/tests/artifacts/docs.

## 16. Related documents

- [Terminology](../project/terminology.md)
- [Harness commands](harness-command-integration.md)
- [Harness CLI discovery](harness-executable-discovery.md)
- [ACP extraction boundaries](acp-layer-follow-up.md)
- [SSH Host](../platforms/remote/remote-ssh-host.md)
- [Remote Control Host](../platforms/remote/remote-control-host.md)
