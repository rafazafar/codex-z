# Desktop integration: a separate delivery scope

Read this page when delivery includes Desktop selection, Thread creation/recovery, and configuration/state display. A backend plugin can explicitly exclude this scope. Preinstalled release does not automatically complete UI integration.

## Current state and constraints

The Host has a plugin Catalog and generic routing. The Renderer is not yet fully Catalog-driven:

- `packages/renderer-extension/src/renderer-model-client.ts` provides `listHarnessPlugins()` with target-Host queries and result validation.
- `agent-selection-state.ts` still derives a union type from `KNOWN_RENDERER_AGENTS` and stores some configuration per Harness.
- `versioned-renderer-adapter.ts`, Picker, icons, preferences, ownership, and Desktop Control still have static connections.

Renderer files without directory prefixes below are in `packages/renderer-extension/src/`. Check these sources again before implementation. If an area is now dynamic, verify the generic path; do not restore fixed branches.

**New UI connections and full public-layer dynamism are separate tasks.** Complete current product integration within user scope. If correct support requires broader public interfaces or UI state changes, report the gap. Do not silently expand a new plugin task into a full-repository migration.

## New plugin routing: always use shared encoding

```text
Select Harness/configuration on target Host
  → Renderer writes shared plugin Transport Model carrier
  → Desktop thread/start
  → protocol-core decodes
  → Target Host Adapter Map
```

Read `packages/shared-contracts/src/harness-route.ts`, `packages/protocol-core/src/model-routing.ts`, and Renderer `versioned-renderer-adapter.ts`.

- New IDs use `encodeHarnessPluginRoute` / `decodeHarnessPluginRoute`. Do not add an eighth Harness-specific prefix/codec.
- Seven legacy formats remain for compatibility. Preserve existing reads; do not copy them for new plugins or remove them during integration.
- Model Ref, Thinking, and Permission Mode satisfy shared schema and complete round trips. Shared codec defines field constraints.
- Creation, configuration updates, and ThreadInspection recovery agree. Invalid/missing plugin identity is explicitly unavailable; do not fall back to official Codex.

## Check current connections by responsibility

| Responsibility | Current source | Completion condition |
|---|---|---|
| Agent selection/configuration draft | `agent-selection-state.ts` | New Agent selectable; Model/Thinking/permissions isolated per Agent; Composer switches/remounts do not mix state |
| Target Host, Catalog, ownership, diagnostics | `renderer-binding-probe.ts` | Catalog, availability, recovery identity, configuration belong to correct Host/Thread; old asynchronous results cannot overwrite new target |
| Carrier writes/recovery | `versioned-renderer-adapter.ts` | Shared codec compatible with Host; create/recovery configuration agree |
| Picker/installation entry | `renderer-agent-picker.ts`, `renderer-agent-icon.ts` | Consistent name, icon, installation link, availability; distinguish loading from native ready |
| Sidebar/new Thread preferences | `renderer-sidebar-agent-icons.ts`, `renderer-new-thread-preference.ts` | Existing Threads retain Harness identity; missing plugins unavailable; unknown preferences do not restore as Codex |
| Permission preferences/display | `renderer-permission-mode-preference.ts`, `renderer-harness-localization.ts` | Real native modes/scopes only; do not copy old special cases mechanically |
| Settings | `settings/pages.ts` | Consistent Connections state, installation entry, refresh, errors |

Current integration can require extending fixed Renderer unions/mappings. List actual locations and reasons instead of inserting names across the repository mechanically. Do not extend Host loading/delegation lists or specialized codecs.

Plugin Manifest supplies new display metadata. Catalog icons are validated data URLs; display them with img. Do not insert SVG/description strings as HTML. If static UI still needs build-time assets, identify that transitional connection and keep it consistent with the plugin declaration.

## Capabilities and runtime state

- Target Host inspect supplies Catalog/capabilities; confirmed native Thread state supplies effective values.
- selectModel, selectThinkingOption, and selectPermissionMode control applicable widgets. Do not display atCreate permissions as arbitrary live changes.
- Update Thread configuration through public select requests. Failure does not make requested values effective.
- Fixed Models/empty Catalogs are valid native states, but Composer readiness may not support them yet. Verify submission is not permanently disabled. Do not invent Models as a workaround.
- Initial Usage, refresh, notifications, Commands, and compaction use existing public paths. Verify Thread/Host switches leave no previous-instance data.
- Credits still uses Host structural checks plus UI policy, not official Manifest/Adapter capability. Check interfaces/consumers separately for new quota needs.
- Session Import candidates do not imply generic import UI. Integrate current DeepSeek import/local Web UI paths according to actual support and report limits.

Catalog descriptions can correspond to unavailable Adapters. Catalog presence does not prove native installation, authentication, or readiness. Explicitly display compatibility limits when old Hosts lack Catalog methods; do not present errors as empty Catalogs.

## Steering during execution

External Thread steering reuses public Host/Renderer paths: `turn.cancel` → wait for old terminal state → `turn.start`. Plugins provide [cancellation and subsequent Turn](output-and-interactions.md#cancellation-and-subsequent-turns) behavior. Do not add steer commands, capabilities, or Harness-specific Renderer branches. Official Codex Threads keep native steer.

Verify the target Harness displays/executes new input once and supports follow-up after success. Retain input on failure. Existing queues and old messages must not be restored incorrectly or sent twice. Verify cancellation failure, timeout, and unconfirmed delivery separately. Client timeout does not prove input rejection. See [external Thread steering](../../../../docs/architecture/external-thread-steering.md) for shared implementation, input limits, and versioned binding. Do not copy coordination logic into plugins.

## Desktop Control and release

For product integration, also check:

- Enable lists/injection arguments in `packages/desktop-control/src/production-controller.ts` and `renderer-control-session.ts`.
- Lists that claim production Agent coverage in `tools/renderer-binding/run.mjs`, `renderer-observer.mjs`, and `tools/codex-desktop-contract-audit/run.mjs`.
- `tests/release/production-renderer.test.mjs`, relevant Renderer/Desktop Control tests, and actual Renderer build.

Maintain tool lists for their actual purpose. Diagnostic tools do not all need production lists. The Renderer is a browser package; do not import Node.js built-ins, Harness SDKs, or Electron private APIs.

For shared Desktop method bindings, preserve cross-component RPC access according to real `RpcTarget` contracts. Instance function properties do not replace exportable class methods. Cover installation, removal, pending-request cleanup, Model/permission list reads, and new Session submission readiness. Direct ordinary-object tests do not replace RPC tests. If shared bindings are unchanged, reuse existing regressions; do not copy infrastructure tests per Harness.

## Product acceptance

1. The Harness is visible/selectable and creates Threads on the correct Host; carrier uses shared format.
2. Missing installation, authentication failure, unavailable state, old-Host incompatibility, refresh/retry state are accurate.
3. New/existing Threads agree on Model, Thinking, permissions, ownership, Sidebar, and preferences.
4. Host/Thread switches, Composer remounts, and out-of-order asynchronous responses do not mix configuration/icons.
5. Real UI verifies supported tools, approvals, questions, cancellation, [steering](#steering-during-execution), Usage, Commands, and history operations.
6. Missing plugins do not assign original Threads to Codex. Verify history recovery after reinstallation according to native capability.
7. Desktop Control, production Renderer build, and browser boundary checks pass. Screenshots apply only to visible UI changes.

If only the backend is complete, report “Plugin backend available; Desktop integration incomplete.” Do not mark this checklist passed. If UI is complete without real native acceptance, keep that check explicitly unverified.
