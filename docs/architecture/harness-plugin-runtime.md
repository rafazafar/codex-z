# Harness plugin runtime: dynamic loading and preinstalled distribution

> Status: Seven existing Harnesses and user-directory plugins use one dynamic loader. **Full plugin separation is incomplete.** This document describes current code and does not replace the [architecture and migration proposal](harness-plugin-architecture.md).

## Current scope

The source startup path can load previously unknown external Harness IDs, describe them through `codex-z/harness/plugins/list`, and call them through public inspection and `thread/start` interfaces.

Seven existing Adapters load through the same `manifest.json` and `createHarnessAdapter` factory. `adapter-composition.ts` was removed. Host source, dependencies, and TypeScript references no longer directly reference concrete Adapter packages. Only [`scripts/release/harness-plugins.json`](../../scripts/release/harness-plugins.json) defines preinstalled plugins. Native constructor parameters, prefetch, and Claude Code direct/Broker selection remain plugin responsibilities.

Local Session import uses public `sessionImport`, Host mapping transactions, and dynamic settings UI. Claude Code, Pi, Hermes, and DSH provide implementations. DSH uses local managed Web. `0.1.2-rc.1` / `0.1.5-rc.1` / `0.1.5-rc.2` / `0.1.5-rc.3` / `0.1.7-rc.1` passed their validation; other SemVer releases can attempt connection but must pass native protocol checks. Legacy support was removed. Full native refs flow only between Adapter and Host; see [Session import](harness-session-import.md). This does not mean the ordinary Agent Picker is fully dynamic.

Remaining goals:

- Drive all Renderer Pickers, icons, Composer state, preferences, and Sidebar from the target Host catalog. A validated connection-specific catalog client exists, but **new plugins do not automatically appear in current Pickers**.
- Remove remaining static Harness lists, old routes, and name-specific recovery policies from Renderer and other public layers. Host static Adapter imports/registration lists are removed.
- Migrate old duck-typed Session Credits paths, remote/Broker Session Import, and plugin-owned old data. Public read-only account limits exist in settings (below), but not all Credits paths are migrated.
- Independent plugin publishing/upgrades/dependency installation, plus complete removal of specialized Broker, remote-configuration, and delegation behavior. npm/Installer distributions include separate plugin Bundles and preinstalled resource directories. Broker protocol and CLI entry points still retain Claude Code semantics.
- Full acceptance for native Harnesses, historical versions, protocol generations, remote execution, and installed artifacts.

This does not prove that public layers know no external Harness names or that all prior behavior has zero regressions.

## Directories and explicit trust

Each Host connection uses the same loader for two roots:

- **Preinstalled root**: `plugins/` beside the executing Host Runtime, never inferred from project cwd. Source builds use `packages/host-runtime/dist/plugins/`; distributions use `app/plugins/`.
- **User root**: Select in this order:

1. `CODEX_Z_PLUGIN_DIRECTORY`, which must be absolute; reject a relative root.
2. If `CODEX_Z_DATA_DIR` is set, use `plugins/` under its resolved absolute path.
3. Otherwise use `~/.codex-z/plugins/`.

Directory layout:

```text
plugins/
├── enabled.json
└── sample-agent/
    ├── manifest.json
    ├── dist/
    │   └── plugin.js
    ├── assets/
    │   └── icon.svg
└── …plugin implementation and resolvable runtime dependencies
```

`enabled.json` is execution permission granted by the local administrator/user, not a discovery cache:

```json
{
  "version": 1,
  "enabled": ["sample-agent"]
}
```

Each root owns its `enabled.json`. Distribution builds generate the preinstalled enablement file as explicit trust for shipped plugins; users configure their own root. Discovered but disabled plugins do not execute or appear in queries. Missing roots/enablement files load no plugins. Invalid configuration rejects the root without hard-coded fallback. Do not scan project directories, automatically install/download dependencies, or hot-replace plugins.

The user root does not override preinstalled plugins. Duplicate IDs across roots reject both candidates. User enablement does not change preinstalled enablement.

**Enabled plugins are trusted local code, not sandboxed code.** Factories run with Host-process permissions and can read passed environment variables, including credentials. Path/metadata checks do not prevent trusted plugins from importing files, accessing networks, calling `process.exit`, or blocking the event loop. They do not isolate malicious concurrent local-file replacement.

## Manifest and factory

Minimum complete description:

```json
{
  "manifestVersion": 1,
  "id": "sample-agent",
  "name": "Sample Agent",
  "version": "1.0.0",
  "adapterApiVersion": 1,
  "entry": "dist/plugin.js",
  "icon": "assets/icon.svg",
  "links": {
    "documentation": "https://example.com/docs",
    "installation": "https://example.com/install"
  }
}
```

- IDs are portable lowercase identifiers of at most 128 characters. `codex` is reserved for the official path.
- `manifestVersion` is currently `1`. Integer `adapterApiVersion` must exactly match Host. Version-range negotiation is not implemented.
- `entry` is a plugin-local `.js` or `.mjs` ESM file. `.js` requires package declarations under Node.js ESM rules. Manifests do not install dependencies.
- Resources must use plugin-relative paths. Reject traversal and resolved symlinks outside the root.
- Links accept only HTTPS without embedded user credentials.
- `HarnessAdapter.inspect()`, Session capabilities, and optional public interfaces remain authoritative. Do not duplicate runtime capabilities in the Manifest.
- Optional static `HarnessAdapter.commandCatalog` supplies commands through `codex-z/harness/commands/inspect`. Catalog reads do not inspect native runtime, connect services, or create/resume Sessions. Without a catalog, return empty without Session-start fallback. Execution still uses `session.commands`.

The entry exports the factory defined by [`HarnessPluginModule`](../../packages/harness-adapter/src/plugin.ts), without module-global registration side effects:

```ts
import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";
import { SampleAdapter } from "./adapter.js";

export function createHarnessAdapter(context: HarnessPluginContext) {
  return new SampleAdapter({ environment: { ...context.environment } });
}
```

`SampleAdapter` is a plugin implementation of [`HarnessAdapter`](../../packages/harness-adapter/src/text-session.ts), not a repository-provided class. Its `harnessId` must match Manifest. Factories can return asynchronously; each Host connection gets its own instance. Node.js still caches modules, so module-level mutable state is not automatically isolated. Claude Code reads user Shell environment in an asynchronous child with a 3-second timeout, avoiding synchronous event-loop blocking.

Plugins can export optional `warmup(adapter): Promise<void>`. Host runs best-effort background prefetch without waiting before serving requests. Failures log stable diagnostic codes. Claude Code and Antigravity use it; others need no empty implementation. Adapter idempotent close also owns prefetched native resources. Dedicated runtimes can request cold instances without prefetch.

Context includes an environment snapshot, platform, managed-remote flag, optional Broker descriptor path, and local URL-opening service. Catalog load freezes the snapshot; it is not a credential filter. Managed remote Hosts have no local URL-opening service. Available local opening still passes Native Launcher loopback URL validation and does not expose arbitrary system URL opening.

## Custom launch-path settings

Local connection settings provide WorkBuddy path input, save, and clear in the detail card. Remote/Broker connections do not. Manifest can declare `launchCommand: true`, also present in public descriptions. Host has no Harness-specific command-variable list.

`codex-z/harness/launch-settings/get` accepts `{ harnessId }`; `set` accepts `{ harnessId, path }`, with `path: null` to clear. Return `{ path, restartRequired }`. Allow only local loaded plugins declaring this setting. Save validates absolute paths and installation-directory existence, supports saved file entries, and executes nothing. A saved path does not prove native protocol/authentication. Paths contain no arguments or surrounding quotes.

Save per-plugin configuration to `${CODEX_Z_DATA_DIR}/harness-launch-settings/<id>.json`, defaulting to `~/.codex-z`, through temporary files and atomic replacement. Do not use Renderer localStorage or mutate process-global environment. On next construction, `HarnessPluginContext.launchCommand` passes the setting to supporting factories. WorkBuddy maps it to native launch configuration ahead of inherited command variables. Clear restores environment/autodiscovery.

**Restart codex-z to apply changes.** Existing Adapters/Sessions are not hot-replaced. `restartRequired` compares persisted settings with construction-time settings. Connection refresh alone does not apply new paths. Users enter application installation directories such as `D:\program\WorkBuddy`, without finding executables/scripts. The Adapter locates `WorkBuddy.exe` / `WorkBuddy AI.exe` / `WorkBuddyAI.exe` and adjacent built-in scripts. Incomplete layouts fail without borrowing another installation or falling back to PATH/defaults. Existing file-entry override compatibility remains. Registry autodiscovery is outside this feature.

## Load and close behavior

The loader validates all discovered Manifests before importing enabled modules:

- Reject all duplicate IDs across roots, without scan-order or enablement priority. Conflicts with injected test Adapters also reject directory candidates.
- API mismatches do not execute entries but retain unavailable Adapters and public descriptions.
- Import, factory, or resource errors mark only that plugin unavailable; other plugins continue.
- Diagnostics include only stable codes/public IDs, not thrown paths, environment values, or exception bodies.
- Manifest limit: 32 KiB; icon: 128 KiB; candidates: 128; loader roots: 8. Current composition uses preinstalled/user roots.
- At most four workers load plugins. Each asynchronous import/factory has its own default 10-second timeout, not leftover time from an earlier plugin. Filesystem discovery, synchronous code, and close cannot be guaranteed interruptible.
- Host initializes official app-server first, then loads enabled plugins as one background batch. External inspection/create/resume/delegation waits for this batch, without on-demand or per-Harness loading. The synchronous Adapter registry remains.
- Desktop requests dispatch outside the read loop. Same-Thread routing/Session opening follows receipt order; other Threads and Thread-free requests are independent. Plugin waits for commands/create/resume do not block later official requests. Official initialization remains in the read loop. Turns, commands, and interruption retain asynchronous behavior; whole Turns are not queued serially.
- Close or Desktop input EOF first cancels loading, then waits for accepted routes/Session opens before taking a Session snapshot and closing resources. This avoids missing late Sessions. Late Adapters still close. Missing/unavailable external Harnesses never fall back to official Codex.
- Adapters returned after timeout are closed where possible. Plugins own resources created before returning an instance.
- Host exit closes loaded Adapters. Registry `close()` is idempotent and attempts all instances even after a synchronous close error.

Icons accept recognized PNG/JPEG/WebP or restricted SVG, converted by Host into data URLs. SVG rejects scripts, event attributes, and selected external-resource constructs. Consumers must use `img`, never inject SVG/descriptions as HTML.

Qoder appears as separate preinstalled `qoder` (international, original ID) and `qoder-cn` (China) plugins. Both share `packages/adapters/qoder` Adapter/Session code; the China package supplies only a Manifest/factory. Each fixes SDK `1.0.39`: `@qoder-ai/qoder-agent-sdk` / `@qodercn-ai/qodercn-agent-sdk`. Inspection/auth/history/Fork use the same corresponding SDK without automatic switching. International discovery uses `qodercli` / `qoder`; China uses `qoderclicn` / `qodercn`; overrides are `CODEX_Z_QODER_COMMAND` / `CODEX_Z_QODERCN_COMMAND`. Native homes are `~/.qoder` / `~/.qoder-cn`; PAT variables are `QODER_PERSONAL_ACCESS_TOKEN` / `QODERCN_PERSONAL_ACCESS_TOKEN`. Native SDKs own credentials/history. Refs use distinct Harness IDs and reject cross-variant Resume/Fork/Rollback. Desktop stores Model, Thinking, permissions, and preferences per Agent. Public contracts/routes stay unchanged.

Qoder authentication failure or unexpected message-stream end terminates the active Turn, publishes `session.faulted`, and closes the Session. Later calls return `invalidState`. Cancellation acknowledgement means acceptance only; remain busy until native Turn result, and attribute late output to the original Turn. `unattended-full-access` maps to native `bypassPermissions`; explicit conflicting permissions reject creation.

Qoder uses public Model Catalog/tool projection contracts without special groups, disabled states, or whole-file fields. Preserve SDK models/order without `isEnabled` filtering; native interfaces determine selection success. Both variants cache successful catalogs per cwd without expiry. Explicit `refresh` clears the matching cache; Adapter close clears all; failures are not cached. SDK reads still use `fetchStrategy: "cache"`; refresh bypasses Adapter cache but does not force native networking. Write/Edit uses the public Pi/OMP tool-projection path, without namespace switches/native-patch requirements or changes to other Harness history states.

The independent `workbuddy` plugin uses WorkBuddy AI's bundled CLI standard public `--acp` stdio. Exact Fork/revision combines public management arguments, native commands, and public rollback extensions; cross-directory operations use a temporary history bridge validated against source/target. It can reuse CodeBuddy ACP code but has its own ID and fixed safe command catalog. Without explicit configuration, inject `~/.workbuddy-ai` to prevent `.codebuddy` fallback. Never automatically switch to standalone PATH CodeBuddy. It does not connect private Desktop owner runtime, call private activation/admission/grant APIs, or adopt Desktop tasks/connectors/login. macOS App includes the CLI; initial ACP authentication uses that CLI outside Host when needed. See [WorkBuddy integration](../harnesses/workbuddy/workbuddy-harness-integration.md).

## Public queries and routing

Catalog queries run on the requested Host connection and accept no client filesystem paths:

```json
{
  "id": 1,
  "method": "codex-z/harness/plugins/list",
  "params": {}
}
```

`plugins` describes all loaded plugins on the connection, including the seven preinstalled Harnesses: `id`, `name`, `version`, optional data-URL `icon`, and `links`. No backend entries, paths, environment, or SDK objects are returned. Availability/capabilities still use `codex-z/harness/inspect`.

Renderer `listHarnessPlugins()` sends the fixed request through its bound RequestManager and validates results. Route proxies use current target Host; explicit `clientForHost` uses that Host client. Unsupported old Hosts return errors to callers, not fake empty catalogs.

New IDs use shared `encodeHarnessPluginRoute` / `decodeHarnessPluginRoute`, preserving ID, Model Ref, Thinking, and Permission Mode. Output is `codex-z/plugin-v1@` plus lowercase hex of canonical JSON, usable in `thread/start.params.model`. This is transport encoding, **not encryption; include no credentials**.

Invalid prefixed data fails without official fallback. Valid routes for uninstalled plugins also do not reach official app-server. Ordinary official model routes stay unchanged. Seven existing dedicated encodings remain temporarily; migration must preserve historical reads.

Native `thread/start` allows omitted/null `model` for Codex's native default Model. Host forwards the original request without adding Model or external default Agent. `ephemeral: true` without external encoding also remains official, even with official Model and Pi as default Agent. Desktop MCP helper Threads, including Codex Security, need this path. Explicit external encoding selects its Harness. Explicit official Models on ordinary non-ephemeral requests retain existing default-Agent rules. Non-string, non-null Model values are rejected.

### Read-only account limits

Optional `HarnessAdapter.inspectAccount()` returns current native-authentication `HarnessAccountSnapshot`, or `null` without actual limits. Do not treat Session costs as account limits, return stale-authentication cache, or start a model Turn. SDK/authentication/limit parsing belongs to plugins, which bound query duration and close inspection resources. Plugins without this optional capability remain compatible.

`codex-z/harness/accounts/sources` first returns supported Harness IDs/Manifest names. Renderer queries each through `accounts/inspect` in parallel. Host validates snapshots and isolates failures/timeouts without native errors/credentials. Valid results display immediately, without waiting for other Harnesses. Unsupported/no-data/invalid snapshots create no account rows. `accounts/list` remains aggregate compatibility for old Renderer; new Renderer also falls back on old Hosts. Settings displays read-only data without registering Codex accounts or multi-account routing. Claude Aqua Broker forwards `adapter.inspectAccount`; old Brokers return no data. See [account settings](../product/codex-accounts.md).

## Change Model / Thinking during execution

Adapters supporting configuration selection do not reject `model.select` / `thinking.select` merely because a Turn is active. They call native configuration or update values for the next native call. Harness determines timing; Host promises neither mid-Turn Model replacement nor common end-of-Turn queues. Native rejection returns failure. Success publishes confirmed `session.state.changed`.

Only live configuration selection is relaxed. Initialization/Turn-admission, concurrent-write, and history-consistency guards remain. Second Turns, history mutations, close/fault, and Permission Mode constraints are unchanged. Antigravity calculates current-Turn Usage from the Model used to launch its CLI; later selections do not relabel running requests.

## Steering during execution

External Thread steering uses public `turn.cancel` → wait for terminal state → `turn.start`, without new plugin steer commands. Host coordinates replacement; Renderer uses normal-send display. Official Codex retains native steer. See [external steering](external-thread-steering.md) for execution, versioned bindings, input limits, and validation.

## Build, distribution, and remote paths

`npm run build:typescript` compiles TypeScript then runs `npm run build:plugins`, generating the adjacent Host plugin directory from the release manifest. `npm start` uses this path; `--no-build` requires prior plugin artifacts. Root release builds include preinstalled plugins; core Host does not depend on their Adapter packages.

[`build-plugin.mjs`](../../packages/harness-adapter/scripts/build-plugin.mjs) bundles each entry and reviewed JavaScript dependencies into `plugin.mjs`, copying Manifest/icons. It includes no native Harness executable/login. [`harness-plugins.mjs`](../../scripts/release/harness-plugins.mjs) orchestrates distribution, file lists, and enablement. Outputs are reproducible artifact directories, never user plugin directories.

Host release Bundle excludes Adapters/Harness SDKs; audits reject renewed leakage. npm/Installer whitelists include each entry/Manifest/icon and root enablement file. Existing third-party licenses ship with distributions.

DeepSeek uses its HTTP/WebSocket implementation for supported local DSH and includes no DSH CLI. Legacy `@deepseek-ai/dsh-apiproxy` / `@deepseek-ai/dsh-session` SDKs and bundle entries are removed. Modern `schemastery` remains bundled. V0/V3/V4 profiles and Assistant parsing stay plugin-local, including V4 `developer/message`, surface refs, and Fork closer, without public-contract leakage.

Ordinary Host, Remote Control, and SSH-listener connections discover plugins beside the Runtime actually used. SSH installation references the remote package Runtime without local fallback. Manual Runtime copies must include adjacent `plugins/`. Copying only `host-runtime.mjs` yields core without preinstalled Harnesses, not implicit local-source loading. macOS Aqua Broker uses the same Loader for only needed plugins, in direct cold mode to prevent recursive Broker clients.

## Executed validation and remaining acceptance

This phase has automated coverage for:

- New-ID loading, description cloning, explicit enablement, duplicate/reserved IDs, incompatible versions, and bad-module isolation.
- Manifest/entry/icon symlink escape, sizes, active SVG rejection, factory identity, late-timeout cleanup, and idempotent close.
- Unknown-plugin Host queries/inspection/Thread creation/persistence/close; missing/invalid routes do not leak to official flow; official forwarding continues.
- Shared-route configuration round trips, canonical form, length/input checks; Renderer catalog validation/client isolation; browser-safe shared-contract Bundle.
- Real factories for seven plugins, independent instances, explicit CLI arguments, prefetch, macOS Broker without direct fallback; dynamic Session import binds Adapters and old DSH RPC shares transactions.
- Separate Host/plugin builds moved outside the repository: seven preinstalled plugins, an extra user plugin, and official forwarding after all plugins are removed.
- Focused resume, Pi/DeepSeek import, delegation, routing, and Renderer regressions.

These are synthetic tests, builds, and separate-Bundle smoke checks. They do not equal real Codex Desktop, seven native Harnesses, macOS Broker, remote SSH, or full installation/upgrade acceptance. Migration and validation still follow architecture capability baselines and release Gates.
