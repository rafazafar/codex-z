# Implementation navigation by responsibility

This page locates code; it does not maintain a complete capability matrix. Current inspect, Session capabilities, actual branches, and tests define capability support. Historical descriptions or another Harness's capabilities do not guarantee target native support.

All paths are relative to the repository root. Select the closest native transport, then read required specialized modules and tests. Do not copy complete packages.

## Start with the minimal plugin shape: Pi

```text
packages/adapters/pi/
├─ manifest.json             Static plugin declaration
├─ src/plugin.ts             createHarnessAdapter factory
├─ src/pi-adapter.ts          PiAdapter + PiHarnessSession
├─ src/pi-rpc-session.ts      Native process and RPC, not public Session class
├─ src/command.ts             Pi discovery rules using public discovery
├─ src/pi-model-catalog.ts    Native Model/Thinking conversion
├─ src/pi-history.ts          Native history/boundary conversion
├─ src/pi-last-turn-rollback.ts  Rollback flow and result checks
├─ src/pi-session-file.ts     Native Session identity/cwd validation
├─ src/pi-usage.ts            Usage conversion
└─ test/                     Public behavior and native boundary tests
```

New plugins do not need this exact file list. Minimal runtime delivery consists of a Manifest plus executable factory, implementation, and dependencies. Include resources such as icons where needed. `src/index.ts` is a package export, not the Loader factory entry.

Pi demonstrates CLI/RPC, delayed start, history, Model/Thinking, Question, Usage, and close. Pi has no selectable Session Permission Mode. Accepting execution intent does not require new permission arguments.

## Transport references for seven Harnesses

Relative files below are in the corresponding `packages/adapters/<directory>/src/`.

| Directory | Native interface | Read first | Constraint |
|---|---|---|---|
| `pi` | Native CLI RPC | `plugin.ts`, `pi-adapter.ts`, `pi-rpc-session.ts` | RPC reference; Entry/Session file format belongs to Pi |
| `omp` | Native CLI RPC | `plugin.ts`, `omp-adapter.ts`, `omp-rpc-session.ts` | Permission restart, Approval/Question, Subagent, autonomous Turn |
| `claude-code` | Claude Agent SDK; managed use can go through Broker | `plugin.ts`, `claude-code-adapter.ts`, `sdk-transport.ts`, `transport.ts` | SDK, interaction, lifecycle reference; direct/Broker factory selection does not require Broker for every plugin |
| `opencode` | SDK client and native service/event stream | `plugin.ts`, `opencode-adapter.ts`, `sdk-transport.ts`, `server-connection.ts`, `protocol.ts` | Shared service/event correlation; permission writes have incremental rules, not assumed full replacement |
| `grok` | ACP plus private native extensions | `plugin.ts`, `grok-adapter.ts`, `acp-transport.ts` | Use ACP reference only without a reliable native alternative; permissions fixed at creation; private history extensions are not standard ACP |
| `deepseek-harness` | Legacy/Modern protocols selected by native version | `plugin.ts`, `deepseek-harness-adapter.ts`, `generation-selector.ts`, then `legacy/` or `modern/` | Separate baselines; read selected implementation/tests, do not mix old matrices. Modern `0.1.2-rc.1` supports last-turn rollback through Fork or empty Session replacement |
| `antigravity` | CLI stream-json | `plugin.ts`, `antigravity-adapter.ts`, `stream-events.ts`, `history.ts` | Streaming CLI and plugin-persisted history; explicitly no Fork/Rollback |

Native Codex uses the official app-server, does not implement external HarnessAdapter, and is not a template for new external plugins.

## Continue by target capability

| Target | Reference |
|---|---|
| Public errors, interaction validation, Usage parsing, output streams | Exports from `packages/harness-adapter/src/index.ts` and their tests |
| CLI search/invocation | `packages/harness-discovery/src/index.ts`, Pi `command.ts`; separate ownership for public mechanism/plugin rules |
| Opaque Model identity, Thinking, history | Pi `pi-model-catalog.ts`, `pi-history.ts`, `pi-last-turn-rollback.ts` |
| Last-Turn Rollback | Pi `pi-last-turn-rollback.ts`; DeepSeek Modern `modern/deepseek-harness-adapter.ts` (`0.1.2-rc.1`) |
| SDK Approval/Question and tool projection | Claude `claude-code-adapter.ts`, `sdk-transport.ts`, and specialized modules; select by problem rather than copying the full package |
| Native permission acknowledgement and restart recovery | OMP `omp-adapter.ts`; OpenCode `permission-modes.ts` / `opencode-adapter.ts`; Grok creation scope |
| Subagent, autonomous Turn, background result | OMP/Claude Adapter and lifecycle modules; public types in `text-session.ts` |
| Persistent Host RPC/shared subscriptions | DeepSeek `legacy/host-client.ts`; Modern `modern/remote-connection.ts`, `event-gateway.ts`, `session.ts` |
| Native protocol generation selection | DeepSeek `generation-selector.ts`, top-level Adapter; native version policy differs from plugin API version |
| Import candidates/local Web UI | DeepSeek top-level Adapter, `modern/session-list.ts`; upper Host layers still have specialized boundaries |
| Plugin factory/nonblocking prefetch | Seven `src/plugin.ts` files; use Claude/Antigravity warmup only for an actual prefetch requirement |
| Public behavior test patterns | `packages/harness-adapter/src/testing.ts`, `packages/harness-adapter/test/text-session.test.ts`; Fake is a reference, not an automatic conformance runner |
| Plugin loading/packaging | [Loading and validation](registration-and-validation.md) |
| Desktop/cross-Harness coordination | [Renderer](renderer-product-integration.md), [delegation](cross-harness-delegation.md) |

Read corresponding tests with source. Check cancellation, partial startup failure, unknown native state, resource close, and version differences, not only success paths.

## Dependencies not to copy from references

- Static Host Adapter registration is removed; new plugins load only through Manifest/factory.
- Seven legacy transport codecs are compatibility formats. New IDs use shared routing.
- Harness-name recovery checks, Credits structural checks, specialized DeepSeek import, Claude Broker protocol, and static Renderer mappings remain. They are not new required public Adapter interfaces.
- Concrete SDK/RPC, native permission recovery, and history version logic belong to plugins. Public Thread identity, mapping transactions, interaction correlation, and delegation remain Host responsibilities.

When native semantics differ from a reference, first check whether the public interface can express them. If yes, convert in the plugin. If no, record the public gap/product limit. Similar names are insufficient grounds for applying native operations.
