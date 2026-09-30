# Loading, release, and validation

All plugins complete runtime delivery and Host validation. Repository development, preinstalled release, remote configuration, and other branches need their corresponding additions only. `docs/architecture/harness-plugin-runtime.md` defines current rules. Read numerical limits from shared schemas; do not duplicate them here.

## Runtime delivery: minimal files and dependencies

```text
<trusted-plugin-root>/
├─ enabled.json                  Execution permission for this root, not plugin Manifest
└─ <plugin-directory>/
   ├─ manifest.json              Required
   ├─ plugin.mjs                 Required executable ESM entry; dist/plugin.js also valid
   ├─ assets/...                 Required when referenced by Manifest
   └─ ...                       Entry dependencies, packages, and runtime resources
```

One Bundle can contain factory, Adapter, and Session. Four separate runtime files are not required. For `.js`, supply package type according to Node ESM rules. The Host does not load TypeScript directly or install dependencies automatically. The Loader does not provide native Harness executables or authentication.

Validate Manifest with `packages/shared-contracts/src/harness-plugins.ts`:

- Provide protocol version, stable plugin ID, name, plugin version, Adapter API version, and entry.
- IDs satisfy their schema; `codex` is reserved. Manifest, Adapter, Session, and Native Ref identity agree.
- API version matches current Host; it differs from the plugin's own version.
- Entry/resources use plugin-relative paths. Icons/links are optional. Read path, image format/size, and link limits from schema, `plugin-files.ts`, and runtime documentation.
- Manifest describes identity, compatibility, and display only. Capabilities come from inspect, Session, and optional interfaces.

## Factory and shared resources

Read `packages/harness-adapter/src/plugin.ts`:

```ts
import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";
import { SampleAdapter } from "./adapter.js";

export function createHarnessAdapter(context: HarnessPluginContext) {
  return new SampleAdapter({ environment: { ...context.environment } });
}
```

`SampleAdapter` is implemented by the plugin, not a public-library base class. This sample shows factory invocation only, not an Adapter implementation.

- Receive base environment, platform, managedRemoteHost, and optional services from Context. The plugin handles commands, endpoints, SDK construction, and native version selection.
- Each Host connection has its own Adapter instance. Node caches modules; module-level mutable Session state is not automatically isolated.
- Return an instance promptly. Adapter close eventually manages all resources. Clean partial initialization before a factory exception; the Loader cannot clean an object not yet returned.
- Optional `warmup(adapter)` provides best-effort prefetch without blocking service. The Loader isolates failures. Do not add empty implementations or create user Turns during prefetch.
- Reuse public tools/reviewed dependencies. Do not import Host/Renderer private implementations or other Adapters' internal modules.

### Keep the two discovery responsibilities separate

| Discovery target | Owner | Plugin task |
|---|---|---|
| Plugin ESM entry | Host Loader | Provide Manifest/entry, enabled explicitly by root |
| Local native Harness executable | Plugin using public `harness-discovery` | Declare `HarnessDiscoverySpec`; do not copy search algorithms |

CLI plugins read `packages/harness-discovery/src/index.ts`, `resolve.ts`, `invocation.ts`, and `node-runtime.ts` as needed. Command names, dedicated environment variables, installation directories, and special entry rules belong to plugins. PATH, platform extensions, version-manager search, Windows shim invocation, and Node PATH additions belong to the public package. Do not silently use a different installation after explicit user configuration.

## Installation and trust

Read `packages/host-runtime/src/installed-harness-plugins.ts` and `harness-plugin-loader.ts`.

- The Host loads adjacent `plugins/` for the actual Runtime and a user root. `CODEX_Z_PLUGIN_DIRECTORY`, `CODEX_Z_DATA_DIR`, or the default data directory selects the user root.
- Each root owns `enabled.json`, for example `{"version":1,"enabled":["sample-agent"]}`. Disabled plugins do not execute or appear in the Catalog.
- User roots do not override preinstalled plugins. Reject duplicate IDs across roots. User enabled files do not control preinstalled roots.
- Host restart is required. Arbitrary project directories are not scanned; hot replacement/unload is unsupported.
- **Enablement trusts in-process code; it is not sandbox authorization.** Plugins have Host process permissions, and environment can contain credentials. Asynchronous timeout cannot stop synchronous blocking or isolate process exit.

Use temporary isolated roots for development acceptance. Do not overwrite real user plugins or enable configuration. Install, enable, or update real user files within user authorization and preserve existing plugins. Build output targets only reproducible artifact directories.

## Repository development and preinstalled release

### Repository source package

Usually use `packages/adapters/<harness>/` with package/tsconfig, Manifest, factory, implementation, and tests. Export only APIs with actual consumers from `index.ts`. Organize internals by responsibility, not reference file count.

- Depend on public `harness-adapter`, `shared-contracts`, and discovery/native SDKs as needed.
- Check root Workspace, project references, test compilation scope, and lockfile. Existing wildcard coverage may make edits unnecessary.
- Do not add concrete Adapter dependencies to Host packages/tsconfig. Public-layer source and core Bundle audits continue to prohibit static Adapter/SDK imports.
- Independent user plugins can develop outside this Workspace. Resolve public-package availability/build in the actual environment; do not assume a complete independent publication/update service.

### Preinstallation with codex-z

Read:

- `scripts/release/harness-plugins.json`: preinstalled packages and reviewed runtime dependencies.
- `scripts/release/harness-plugins.mjs`: collection build, path inventory, enable-file generation.
- `packages/harness-adapter/scripts/build-plugin.mjs`: individual ESM Bundle and resource copying.
- `scripts/release/prepare-payload.mjs`, `prepare-npm.mjs`: release assembly.
- `packages/host-runtime/scripts/build-release.mjs`, `tools/check-boundaries.mjs`: core dependency/source boundary audits.

Complete independent packaging, license/third-party notices, payload/npm allowlists, and relocation checks. The builder currently copies Manifest/icons automatically. Verify and implement packaging/file inventories for any other required runtime resources. Repository execution alone is insufficient.

Independent user installations do not change the preinstalled list. New preinstalled entries do not automatically require Harness-name branches in preparation scripts. Prefer existing list-driven paths.

`npm run build:typescript` compiles and generates preinstalled plugins. Check root `package.json` for other build commands. Launch source with `npm start`; launch without build requires existing plugin artifacts.

## Remote and special environments: verify within scope

- Ordinary Host, SSH, and Remote Control use plugins adjacent to their actual Runtime, not local source/cwd. Move plugins with Runtime.
- Factory environment and each Session-open environment reach the actual execution process. Shared services must not keep only the first Thread's private environment.
- If new command/endpoint arguments need Launcher/SSH configuration, read `run-host-runtime.ts`, `officialEnvironment()` in `app-server-host.ts`, `remote-host-install.ts`, `remote-host-lifecycle.ts`, `remote-host-cli.ts`, and the actual Launcher. Add no arguments if automatic discovery suffices.
- Claude direct/Broker selection belongs to its plugin. The specialized Broker still owns Claude protocol. Do not copy macOS Broker by default for new Harnesses. If similar needs exist, verify execution identity/resource ownership separately.

Host source files without absolute prefixes above are in `packages/host-runtime/src/`.

## Validation layers

| Layer | Required evidence | Suggested location/reference |
|---|---|---|
| Public Adapter behavior | Inspection, create, subsequent Turns, cancellation, snapshots, configuration, interactions, errors, concurrency, close; resume/derivation according to capability | Plugin tests; public Fake/contract tests are semantic references only |
| Native boundary | Arguments/environment, SDK/RPC parsing, event correlation, timeout/exit, native history, platform differences | Plugin Transport/projection tests |
| Plugin loading | Real ESM factory, identity, resources, dependencies, independent instances, close; distinguish missing CLI from broken plugin | `packages/host-runtime/test/harness-plugin-loader.test.ts`, `installed-harness-plugins.test.ts` |
| Host integration | Catalog queries, inspect, shared-route creation, Turns, persistence/recovery, supported capabilities; errors never enter official path | `packages/host-runtime/test/app-server-host*.test.ts`, affected Runtime tests |
| Preinstalled release | Bundle loads outside repository without workspace/node_modules; complete dependencies/licenses | `tests/release/host-bundle.test.mjs`, payload/npm tests |
| Desktop/delegation | Included visible behavior and target environment | [Renderer checklist](renderer-product-integration.md), [delegation checklist](cross-harness-delegation.md) |

Test new plugins through actual Loader plus Host, not only direct Adapter construction. Reuse generic duplicate-ID, resource-escape, and timeout tests. Do not copy the infrastructure suite per Harness when loading is unchanged.

All new IDs use `packages/shared-contracts/src/harness-route.ts`. Verify compatibility with `packages/protocol-core/src/model-routing.ts`. Invalid/missing plugin routes do not fall back to official Codex. Official routing remains functional. Do not extend the seven legacy codecs.

Run checks according to change scope:

- Type, ESLint, Prettier, boundary, and diff checks for added/modified code. Use actual root package scripts; format changed files only.
- Run selected files with `vitest run --config tests/vitest.config.js <test-files...>` after required compiled artifacts are available.
- For preinstallation, add build, Bundle, payload/npm, and third-party notice checks. For UI, add Renderer build and relevant tests.
- For real native acceptance, record Harness version, platform, authentication conditions, Model, permissions, local/SSH/Remote Control, and success/failure/cancellation/recovery results.

Do not run all repository tests by default. Report synthetic tests, builds, and real Harness acceptance separately. Documentation-only changes need applicable document checks; do not claim unexecuted runtime tests passed.
