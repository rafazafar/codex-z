---
name: codex-z-add-harness
description: Add a Harness plugin to codex-z, or plan, review, or complete an existing Harness Adapter. Implement native capabilities through current public contracts. Keep the plugin backend, preinstalled release, and Desktop integration separate. Do not use this skill only to add a Model, Provider, or Account.
---

# Add a codex-z Harness plugin

Goal: deliver an independent plugin that uses public contracts. Do not add a separate Harness workflow to the Host. The plugin is the delivery and loading unit; `HarnessAdapter` / `HarnessSession` are runtime interfaces. A base class and ACP are not required.

Code paths in this document are relative to the repository root. `references/` links are relative to this Skill. Source code defines interface signatures, field limits, and current behavior. Reference documents give implementation and acceptance checklists, not a second interface definition.

## Current architecture boundaries

```text
Host
├─ Discover Manifest, read explicit enable configuration, call plugin factory
├─ Execute operations through HarnessAdapter / HarnessSession
└─ Own Thread mapping, persistence transactions, delegation, and Desktop protocol projection
             │ Public contract
             ▼
Plugin
├─ Manifest: identity, version, display information, entry
├─ Factory: convert Host Context to native constructor parameters
├─ HarnessAdapter: inspect, open Session, close shared resources
└─ HarnessSession: execute, outputs, state, history, close
             │ Plugin internals
             ▼
Native SDK / RPC / service / CLI
```

- The seven existing Harnesses and user plugins use the same dynamic Loader. The Host has no static dependency on concrete Adapter packages. New IDs use shared plugin routing.
- Reuse public tools where applicable. For example, `harness-discovery` owns the search mechanism; the plugin declares command names, environment variables, and installation directory rules.
- **The product is not yet fully generic.** The Renderer still has a fixed Agent list, configuration fields, and display connections. Legacy routing, some recovery rules, Credits, import, Broker, and remote configuration still have special cases. Successful plugin loading does not make the plugin appear in Desktop automatically.
- Existing special cases are compatibility obligations, not templates for new Harnesses. If the public contract cannot express a real requirement, record the gap and design a public extension within the task scope. Do not bypass the contract with a new Harness-specific Host branch.

## 1. Set delivery scope and capabilities

Use the user request to set the scope. Ask only about ambiguity that changes implementation boundaries. Do not expand the task into a full product change by default.

| Delivery scope | Required work | Not included automatically |
|---|---|---|
| Plugin backend | Native adaptation, Manifest/factory, runtime dependencies, isolated directory loading, public behavior tests | Repository preinstallation, Desktop UI |
| Preinstalled release | Plugin backend plus Workspace build, preinstalled list, independent Bundle, license and release acceptance | Renderer automatic discovery |
| Desktop integration | Plugin backend plus Picker, configuration, recovery, display, and UI acceptance | Preinstallation |

Ordinary persistent Threads and complete delegation require writable resume. If the native system cannot provide it, deliver an explicitly limited backend. Do not call it complete product integration. There is no automatic fallback to ephemeral Threads.

Read these authoritative entry points first:

- `packages/harness-adapter/src/text-session.ts`: Adapter, Session, commands, events, and optional interfaces.
- `packages/harness-adapter/src/plugin.ts`: factory and Context.
- `packages/shared-contracts/src/harness-models.ts`: Catalog, capabilities, and inspection results.
- `packages/shared-contracts/src/harness-plugins.ts`: Manifest, descriptors, and enable configuration.
- `docs/architecture/harness-plugin-runtime.md`: implemented boundaries, installation, trust, and release rules.

Check the target Harness's current native interface, version, authentication, and execution method. Prefer a native SDK, RPC, or service interface when practical. Use ACP only when a native interface is unavailable or there is a specific reason; record capability differences. Similar CLI names do not prove protocol compatibility.

Use [implementation navigation](references/current-harness-implementations.md) to select references by transport and capability. Do not copy a complete package. Provide a short plan:

```text
Delivery: plugin backend / preinstalled release / Desktop (can be combined)
Native interface and version: ...
Supported: create, resume, Turn, cancellation, history, tools, Question, ...
Unsupported or limited: Fork, permissions set only at creation, ...
Not verified: ... (do not classify as unsupported or implemented)
Reference modules: ...
Expected changes: plugin directory; explain each other location
```

Completion condition: each target capability has native evidence, a public mapping, or an explicit gap, and the delivery scope is clear.

## 2. Implement the plugin's four responsibilities

This is a responsibility checklist, not a required file count. Pi's Adapter and Session are in the same source file.

| Responsibility | Required | Optional |
|---|---|---|
| Manifest | `manifestVersion`, `id`, `name`, `version`, `adapterApiVersion`, `entry` | `icon`, documentation/installation links |
| Factory module | `createHarnessAdapter(context)` returns an instance with matching identity | `warmup(adapter)` |
| `HarnessAdapter` | `harnessId`, `inspect()`, `open()`, `close()` | `sessionImport`, `subagents`, `webUi` |
| `HarnessSession` | `harnessId`, `capabilities`, `initialState`, `initialUsage`, `outputs`, `readSnapshot()`, `execute()`, `close()` | `commands`, `refreshUsage()` |

`execute()` must dispatch public commands: `turn.start`, `turn.cancel`, `interaction.respond`, `model.select`, `thinking.select`, and `permissionMode.select`. `open()` must recognize create, resume, fork, and rollbackLastTurn. An interface does not require support for every native operation. Unsupported branches return typed `unsupported`; do not report false success.

Read and satisfy these references for every new plugin:

- [Public behavior](references/public-adapter-contract.md): inspection, configuration, concurrency, errors, environment, and optional interfaces.
- [Outputs and interactions](references/output-and-interactions.md): Turn/Item order, native output mapping, cancellation, and faults.
- [Identity and history](references/thread-lifecycle-and-history.md): identity and snapshot requirements for all plugins; resume/Fork/Rollback according to capabilities.
- [Loading, release, and validation](references/registration-and-validation.md): Manifest, factory, dependencies, and Host integration checks.

Implement the required native Transport, model conversion, history, Usage, and interaction modules. Prefer validation, output streams, and diagnostic tools exported by `packages/harness-adapter/src/index.ts`. Use `packages/harness-discovery/src/index.ts` for CLI search. Split files by responsibility. Do not add empty modules, empty `warmup`, or unnecessary wrappers for visual consistency.

Completion condition: public interfaces execute real native operations; declarations match behavior; all supported capabilities work; unimplemented items are explicit; failure and close leave no active resources.

## 3. Complete loading and product integration for the scope

- **All plugins:** build a movable plugin as specified in [loading, release, and validation](references/registration-and-validation.md), enable it explicitly in an isolated root, and verify it through the real Loader. Tests that directly call `new Adapter()` do not replace plugin loading tests.
- **Repository implementation or preinstalled release:** read the Workspace/release sections in that reference. Independent user plugins do not change the preinstalled list. Host packages must not add concrete Adapter dependencies.
- **Desktop integration:** read [Renderer integration](references/renderer-product-integration.md) and handle current static UI boundaries. New plugin routes still use the shared codec; do not add dedicated encoding. Steering uses the public path; verify [cancellation and subsequent Turns](references/output-and-interactions.md#cancellation-and-subsequent-turns) in the plugin.
- **Accept delegation, delegate further, or claim complete Agent coordination:** read [cross-Harness delegation](references/cross-harness-delegation.md). It uses ordinary writable Threads, not another execution interface.
- **New public capabilities:** check types, schema, Host projection, consumers, and tests together. Browser shared contracts remain Node-free; the Renderer does not import native SDKs or Electron private APIs.

Completion condition: each included scope has its artifacts and acceptance evidence. Do not add mechanical connections for excluded scopes. Existing Harnesses need no private information about the new Harness.

## 4. Validate and deliver

Run focused checks from [validation layers](references/registration-and-validation.md#validation-layers). Do not run the whole repository suite by default. A successful build does not replace native semantic checks. One successful conversation does not replace cancellation, interaction, recovery, and cleanup checks.

The delivery report includes:

1. Plugin location, ID, native interface, and verified version; entry, dependencies, resources, and installation/enable method.
2. Supported, unsupported, limited, and unverified capabilities; required authentication or platform conditions.
3. Each changed file outside the plugin and its reason; whether public Harness-specific branches were added.
4. Executed checks and native/target environment validation; skipped or blocked checks and reasons.
5. Separate completion status for plugin backend, preinstalled release, Desktop, and complete delegation. Mark excluded items not applicable.

Declare a scope complete only when its implementation, capability declarations, tests, and documentation agree. Report public gaps or native limits explicitly. Do not present a limited implementation as full support.
