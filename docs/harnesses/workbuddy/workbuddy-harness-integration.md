# WorkBuddy native Harness plugin

WorkBuddy runs the WorkBuddy AI bundled native CLI as independent `workbuddy` Harness. It uses public standard ACP stdio, without controlling Desktop, impersonating private identity, or renaming standalone CodeBuddy.

## Interface and inspected versions

This integration inspected **WorkBuddy AI 5.5.2** on macOS. Bundled CLI package version is **CodeBuddy 2.137.1**, at:

```text
/Applications/WorkBuddy AI.app/Contents/Resources/app.asar.unpacked/cli/bin/codebuddy
```

Bundled `product.json` configures WorkBuddy product/authentication/data. The internal entry name `codebuddy` does not make it a standalone CodeBuddy Harness. Discover App/CLI from the same installation, without PATH CodeBuddy fallback:

- macOS: Check `WorkBuddy AI.app` / `WorkBuddy.app` under `/Applications` then `~/Applications`, using `Contents/MacOS/Electron` and `Contents/Resources/app.asar.unpacked/cli/bin/codebuddy`.
- Windows: Check PATH and `%LOCALAPPDATA%/Programs` / `%ProgramFiles%` WorkBuddy AI/WorkBuddy/WorkBuddyAI. Match `WorkBuddy AI.exe`, `WorkBuddy.exe`, or newer `WorkBuddyAI.exe` with adjacent `resources/app.asar.unpacked/cli/bin/codebuddy`. Never mix installations. Standard roots follow [official FAQ](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/FAQ). Simulated Windows layouts test discovery/arguments.
- Linux: [Official platform documentation](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/FQA) lists macOS/Windows. No validated Linux layout exists; do not guess paths.

Standard layouts need only the App, without a global CLI or running window. Internal paths are not public stable contracts. `CODEX_Z_WORKBUDDY_COMMAND` accepts App directories, native `--acp` CLIs, Windows App executables, or macOS `Contents/MacOS/Electron`. Explicit Desktop entries still require the same installation's CLI. Missing layouts fail without treating EXE as bare CLI or selecting another install.

Local WorkBuddy connection details accept an installation directory such as `D:\program\WorkBuddy`, without `.exe`/script selection. Validate App/script together with no fallback for incomplete layouts. Save/clear is supported. Settings override command environment; clearing restores environment/discovery. Host stores paths and applies after restart, not to live Sessions. See [custom launch settings](../../architecture/harness-plugin-runtime.md#custom-launch-path-settings).

[Quickstart](https://www.workbuddy.ai/docs/workbuddy/Quickstart) covers installation/login; [official ACP](https://www.workbuddy.ai/docs/zh/cli/acp) specifies `codebuddy --acp`. A no-prompt/no-model probe succeeded at initialize and declared load/delegation capabilities. Public interfaces/docs also cover configuration/cancel/permissions/questions. Selected command:

```sh
ELECTRON_RUN_AS_NODE=1 "/Applications/WorkBuddy AI.app/Contents/MacOS/Electron" \
  "/Applications/WorkBuddy AI.app/Contents/Resources/app.asar.unpacked/cli/bin/codebuddy" \
  --acp
```

This is the actual macOS bundled startup. Explicit native CLI adds `--acp`; Desktop entries use paired runtime/script. Each writable Host Session owns one stdio child. Prompts enter ACP requests, not Shell arguments.

## Authentication and data isolation

Bare bundled CLI defaults can fall back to `~/.codebuddy`. Use only user `WORKBUDDY_CONFIG_DIR`, otherwise `~/.workbuddy-ai`, and force both `WORKBUDDY_CONFIG_DIR`/`CODEBUDDY_CONFIG_DIR` to that root. Ordinary CodeBuddy configuration cannot receive WorkBuddy history/auth/settings. CLI owns authentication/settings/tools/MCP; codex-z neither stores/copies/guesses credentials.

A no-Prompt `session/new` after initialize returned `Authentication required`. codex-z does not read private Desktop login, so GUI authentication may not serve independent ACP. If needed, run the bundled TUI outside Host with identical product/root and official [`/login`](https://cloud.tencent.com/document/product/1831/137046):

```sh
CODEBUDDY_CONFIG_DIR="$HOME/.workbuddy-ai" \
WORKBUDDY_CONFIG_DIR="$HOME/.workbuddy-ai" \
ELECTRON_RUN_AS_NODE=1 \
"/Applications/WorkBuddy AI.app/Contents/MacOS/Electron" \
"/Applications/WorkBuddy AI.app/Contents/Resources/app.asar.unpacked/cli/bin/codebuddy"
```

Enter `/login`, complete browser authentication, and retry. This is still App-bundled CLI, not another install. Do not use owner-runtime credentials or invent `codebuddy auth login`.

## Working directory and native history

Execution cwd always comes from Desktop, including selected worktrees. `~/.workbuddy-ai` is state, not execution cwd. History follows native `PathUtils.canonicalizeStorePath` / `compressPath`: realpath cwd, replace `/`, `\`, `:` with hyphens, trim boundary hyphens, merge repeats, and preserve case/dots/spaces/underscores/Unicode.

Profile declares this encoding. History, cross-directory bridges, and locators share it. Normal Sessions reject files only in other projects and validate each cwd/identity; no global-search ownership bypass. This is native storage behavior, not ACP guarantee. Upgrade tests use independent native samples for first Turns/resume/aliases/cross-directory Fork/wrong ownership, not only inputs generated by the tested function.

## Dynamic product snapshots and Models

App gives Hosted CLI resolved account/version/service product snapshots. Small ones use `ACC_PRODUCT_CONFIG_V3`; large ones atomically save `cache/acc-product-config-v3.json` in WorkBuddy root and pass `ACC_PRODUCT_CONFIG_PATH`. Without context, CLI uses bundled `product.json`; 5.5.2 fallback `cli` Agent exposes Fast/Balanced/Primary/Deep only.

For discovered/paired bundled CLIs, reuse existing snapshots only when callers specify neither path nor inline variables. Require nonsymlink root/cache directories and a nonempty nonsymlink regular snapshot. POSIX checks owner, non-other-writable directories, and no group/other file reads. Windows uses native ACL, not POSIX bits. Missing/invalid snapshots retain fallback. Standalone explicit CLIs do not infer private cache but retain explicit product environment.

macOS retains ACP catalogs/selection without file additions. Windows independent CLI can miss in-process snapshots, so read the passed product configuration as compensation: use resolved `agents[name="cli"].models`, joining only corresponding top-level `id`, `name`, and nonempty `credits`, not all internal-Agent Models. Deduplicate by ID/normalized name and append ACP `configOptions`, keeping native ACP first. credits is an opaque multiplier label, not a free-price inference. Ignore authentication/endpoints/features/other fields.

Windows ACP accepts CLI-catalog IDs as `currentValue` even absent from option rows. Only Windows WorkBuddy enables this compensation. Select the same native ID and wait for confirmed value. Later native Turns determine requests/auth/service/billing without Host routing/response simulation. `ACC_PRODUCT_CONFIG_PATH` is actual first-party App/Hosted CLI compatibility, not standard ACP or promised stable API, so upgrade boundary tests are required. Small snapshots stay only in App environment and delete old cache; independent codex-z cannot retrieve them, so fallback provides only bundled Models, not the complete dynamic App catalog.

## Private Desktop runtime boundaries

Desktop also has owner runtime, signed identity, leases, and admission/grants. These are not public Harness authentication. This plugin does not:

- Call `_codebuddy.ai/activateWorkbuddyOwnerRuntime` or construct private admissions/grants/signatures/leases;
- Adopt/resume Desktop tasks;
- Impersonate Desktop for Office/connectors/automation/owner-only services;
- Copy private login into ACP children.

Not every `_codebuddy.ai` extension is owner-only. Question responses use public interruption support. Follow [official extensions](https://cloud.tencent.com/document/product/1831/137025) and call only declared, necessary public capabilities.

## Capability boundaries

Reuse validated CodeBuddy ACP semantics with independent identity/commands/data. Claims cover public ACP only:

| Capability | Current behavior |
| --- | --- |
| Inspect/Create/multiple Turns/writable Resume | Implemented through WorkBuddy ACP with Harness/cwd/Session validation |
| Streaming/Reasoning/tools | Public Items; tool calls/results/permissions retain correlation |
| Cancel | Native cancellation and process/state recovery; acknowledgement alone does not admit new Turns |
| Model/Thinking/Permission Mode | macOS native ACP; Windows deduplicated snapshot supplement and confirmed selection; Thinking/permissions remain native-only |
| Question | Public native interruption/question to Host Question |
| Usage | Native request usage; no total account quota or credits-to-dollar inference |
| Native history | Isolated current parent chain with persisted user IDs; missing/ambiguous/damaged/incomplete data fails |
| Native subagents | Native states/read-only Threads from same root; derived Sessions copy exact retained child-result Transcript prefixes, not private Desktop tasks/connectors |
| Slash commands | Fixed safe `/compact` and `/init`, consistent catalogs; no Session-switching/Thread-escaping/native-UI commands |
| Context compaction | Native `/compact`, success only after persisted compaction; automatic compaction stays in triggering Turn |
| Fork | Independent writable native Session with exact complete checkpoint prefix, same/cross-directory, unchanged source |
| Revise previous message | `rollbackLastTurn` creates writable Session removing one complete final Turn; preserves source and inherited/explicit Model/Thinking/permissions |
| Cross-Harness delegation | Persistent Thread CLI discovery/environment/create/read/wait/continue/cancel wired; separate from native children. README remains unmarked until logged-in recursive acceptance |
| Images | Public input is text; CLI capability does not supply Host image input |

Implemented means protocol/public paths are wired, not paid authenticated acceptance in this change. Recheck Models/permissions/history/children against real account/version. Native responses govern; 2.137.1 observations are not permanent product guarantees.

### Fork, cross-directory Fork, and revision

2.137.1 returns `Method not found` for standard ACP `session/fork`; do not fabricate it. Combine public `--resume ... --fork-session`, native `/fork`, and `_codebuddy.ai/session/rollback`: model-free temporary copy, native Fork in target ACP, exact-boundary rollback. Final native Session owns all model work.

Persisted rollback does not prove restored process branch pointers. `resend_edit` changes live `lastMessageId`, but new `session/load` can ignore `resend-fork-notice` and choose the discarded branch tip. Before accepting Prompt, check verified history: if the latest message/rollback is still a notice, replay native rollback and confirm position (`null` for empty prefix). Normal resume/cancel rebuild share this path. Titles/summaries/file snapshots do not affect it. New message/Reasoning/tool records mean valid continuation and prevent further rollback. Failed restoration closes rather than returning writable success. No extra persisted state/Transcript rewrite/OS branch. Incorrect old continuations are not trimmed automatically; derive again from a correct checkpoint.

Model-free `--print --fork-session` with stdin EOF defaults `DISABLE_TELEMETRY=1` only for autodiscovered bundled temporary-copy processes, avoiding telemetry startup waits. Preserve explicit caller values; custom CLI overrides do not get it automatically. Normal ACP/Fork/rollback/source checks/copy deletion retain semantics. Wait for normal copy exit before persistence checks.

`session/load` searches only current-project storage. Cross-directory Fork bridges complete temporary-copy bytes into target using exclusive creation/user-only permissions. After target Fork, delete bridge only if bytes still match. Source-project temporary copies lack a public delete API and can remain in native storage; Adapter does not bypass ownership to delete them.

Neither copy/Fork copies `<sessionId>/subagents/*.jsonl`. For retained Agent results, correlate callId and use structured `subAgent.sessionId`/inclusive `lastId` for exact prefixes, exclusively copying to final Session with `0600`. No global sidecar dependency; children remain readable after source removal. Recheck source/target/type/identity/bytes/lines/SHA-256/cwd. Symlinks, ambiguity, bounds, concurrent changes, or nonidentical existing targets fail. POSIX permission checks apply only there; Windows uses native ACL, retaining path/type/content checks.

Final refs save target cwd/slug, inherited main prefix, and each child's provenance/native target binding. Resume/history revalidates them. Prefix changes, foreign-cwd append, source changes, absent checkpoint, or inexact rollback fail closed rather than approximate. Historical tools retain original cwd and are not relabeled as executed in target.

### Cross-Harness delegation and native children

Ordinary persistent ACP processes receive fixed CLI-discovery instructions through `--append-system-prompt` only with all four `CODEX_Z_CLI_PATH`, `CODEX_Z_RUNTIME_ENDPOINT`, `CODEX_Z_RUNTIME_TOKEN`, and `CODEX_Z_THREAD_ID`. Secrets stay in environment, not arguments/Prompt. Delegation creates ordinary durable resumable Threads through the common coordinator; no WorkBuddy-specific Host branch.

Native Agent tools create children in the same native system, projected read-only. They are not cross-Harness Threads and gain no other Harness identity/capability.

## Plugin, routing, and distribution

`packages/adapters/workbuddy` uses `workbuddy` for Manifest/Adapter/Session/refs. New Threads use `encodeHarnessPluginRoute`, with no dedicated Host codec/fallback.

Preinstall through `scripts/release/harness-plugins.json`. Artifacts contain Adapter/Manifest/assets, not App/CLI/login. macOS App supplies the CLI but initial configuration-root authentication may be required. Separate roots can explicitly enable via `enabled.json`, without duplicate preinstalled IDs.

Managed macOS Remote/SSH requires Broker installation/inspection in target Aqua login, like CodeBuddy, without SSH-background fallback:

```sh
codex-z broker install --harness workbuddy
codex-z broker status --harness workbuddy
```

Product identity changes no native ownership: WorkBuddy owns auth/retention/network/billing; codex-z owns mappings/events/plugin lifecycle.

## Validation status

Initial no-model probes:

- Read App 5.5.2 metadata and CLI 2.137.1 package;
- Start bundled ACP and complete initialize;
- Confirm authentication on independent `session/new`, without private login dependence;
- Confirm absent standard Fork and inspect public CLI/native Fork/rollback;
- Check public ACP/private owner boundaries.

2026-09-18 local macOS used existing auth/Auto Model for real create → empty history → first Turn → close → same Session resume → second Turn → two-Turn history. Cwd contained case/dots/Chinese characters/spaces. Both succeeded without tools/file edits. Cross-directory Fork to Turn one preserved exactly one Turn, source two, and target-cwd cold resume. Earlier failed-task empty history passed corrected read-only path validation.

2026-09-18 retesting reduced two-Turn Fork from about 6.7–7.5 to 5.3–5.6 seconds by removing telemetry wait. Exact prefix/revision/cold resume passed. Continued historical Fork still failed `Could not identify exactly one persisted Native Turn`, also without optimization. Root cause was an unrestored final-writer rollback pointer, not just display/telemetry; current logic restores uncontinued branch pointers as above.

After fixes, Windows WorkBuddy 5.5.6 (CLI 2.137.1, Auto) passed real Adapter middle/end/cross-directory Fork, last-Turn/single-Turn-to-empty revision, close-before-Prompt resume, and reread after continuation. Checks included message parents/count/terminal identity/model-visible retained/excluded markers/unchanged source bytes, not only open. Continue after cancel and first recursive-Fork continuation passed. Cancel → continue → recursive Fork → close/resume original branch saved reply but Host Turn did not end within 60 seconds; this remains unresolved, so all combinations are not stable. Fixed macOS online paths were not retested.

Dangerous permissions, real cross-Harness delegation, compaction, and children were not accepted online in this round. Automated Fork/revision/commands/delegation/Adapter/loading/bundles/routes/Desktop tests use controlled fixtures. Actual reports establish results; this document is not substitute evidence.
