# Hermes native capabilities and integration boundaries

Implementation is only in `packages/adapters/hermes/`. The public Adapter, Host Runtime, and Renderer have no Hermes-specific logic.

## Native transport and compatibility

New sessions prefer official Hermes `tui_gateway` JSON-RPC stdio without requiring a specific release. Do not compare numeric release, desktop backend contract, or ACP protocolVersion values. Startup validates actual `gateway.capabilities.per_session_exclusive_submit`, using the installed Hermes Python with `-I` to prevent workspace-module overrides. New sessions without a usable gateway retain ACP fallback. Existing Native Refs without gateway locators always use `hermes acp`. Saved gateway Refs fail explicitly without a compatible backend and cannot open in ACP. Old gateway locator `contract` fields are ignored; new refs omit them. Protocols never share one Session. Each gateway Session has a dedicated process; duplicate owners are rejected.

Gateway distinguishes runtime and persisted IDs. Host saves the persisted root ID and checks the current native physical ID on resume. After compaction creates a continuation, official Hermes lineage parsing preserves prior Turn identities. Compare working directories by real path; cross-directory Fork is unsupported. Model, Provider, and Thinking use native configuration and confirmed values without global changes. YOLO is native in-process permission state. Confirmed choices are saved in Hermes Native Ref locators for derivation/resume after source close. `default` disables Session YOLO and follows global native policy. If global policy still enables YOLO, disabling the Session switch cannot be reported as restored approval. ACP-only `accept_edits` is absent from gateway modes.

## Questions, tools, Thinking, and Usage

Gateway `clarify` maps to Host Questions: single/batch questions, text, single/multiple choice, with native options and free-text semantics. Host validates answers before replying. Multiple choices use native JSON arrays, preserving commas inside options. `request.cancel` timeout maps to expired; late answers after cancel/close receive no response. Native once/session/always/deny approvals map to one-time/session/permanent/deny.

Concurrent model-catalog reads within one Adapter are combined to avoid repeated Python startup. Refreshes longer than 20 seconds reuse a catalog only if an earlier native read succeeded. Later successful refreshes replace it. First-read timeout, interpreter failure, and invalid formats remain errors. Cache exists only for the Adapter lifetime and never enters user configuration.

Thinking maps directly to `hermes_constants.parse_reasoning_effort`: none/minimal/low/medium/high/xhigh/max/ultra. Selection calls `config.set(scope=session)` and reads confirmation. none disables reasoning, unlike native display-only hide. Actual Model acceptance of effort values follows Hermes implementations.

Tool state and complete results come from `tool.start` / `tool.complete.result`, not truncated summary/result_text. The dedicated process enables native `HERMES_TUI_TOOL_PROGRESS=all` without user-configuration changes. Streaming/final reasoning and text are deduplicated. Usage projects native cumulative input/output/reasoning/total and context_used/context_max. Cancellation waits for native terminal state. Unconfirmed exclusive submission or pending compaction terminates the Session to avoid overlap with uncertain native tasks. RPC timeout, protocol fault, and close release owned process groups; Windows uses taskkill tree termination.

## Edit Diff

ACP diff blocks and gateway native `inline_diff` project `fileChange` only after tool completion, linked by `sourceItemIds`. Failure, denial, or cancellation cannot turn previews into applied changes. Gateway inline_diff is a display fragment with ANSI, arrow file headings, and line limits. Explicit hunk state guides parsing; arrows and `---`/`+++` inside bodies do not become fake filenames.

Both paths conservatively mark `diffScope: fragment`, `kind: update`. ACP skill_manage loses hunk coordinates and gateway displays can truncate, so neither is a full-file patch. Each tool allows at most 32 fragments and 1 MiB. ACP history reproduces diffs only if replay still contains diff blocks. Gateway persisted results contain no old-file render snapshot; recovery preserves complete tool input/output without reconstructing unknown Edit Diff.

## Slash commands and compaction

Gateway supports `/help`, `/tools`, `/context`, `/version` through native `slash.exec` and `/compress [focus]` through `session.compress`. ACP exposes only the matching commands actually published by `available_commands_update`. Validate arguments first; commands obey single-Turn exclusivity. Native commands do not enter chat Transcripts or create fabricated NativeTurnRef values.

Compaction creates a `contextCompaction` Item. Gateway uses structured state: compressed is success; unchanged/lock-not-acquired is a no-op with native reason; summary generation aborted fails Item and Turn. pending is not success; process close releases unfinished work. ACP uses verified native result text: explicit success succeeds, explicit failure fails Item and Turn, and no context/unconfirmed result stays no-op. No change or native-summary failure is not user cancellation. Automatic compaction lacks a fully observable lifecycle and has no claimed automatic Item.

`/model` uses the dedicated confirmed configuration interface. `/reset`, in-place undo/rewind, and queue/steer are not exposed as commands because they could corrupt Host history or bypass Turn exclusivity.

## Exact Fork and last-message revision

Native gateway `session.branch(count)` copies only visible text and discards tool relationships, so it is not used for the public history contract. The plugin reads complete message/tool rows through official `SessionDB`, using real row IDs and native display_identity for stable Turn identity. `user_originated_turn_view` and `_history_to_messages` exclude internal continuation, compaction summaries, and hidden rows while preserving original user skill-command display.

Uncompacted, fully verifiable history produces checkpoints with prefix length and complete-message digest. Fork uses official transactional export/import for exact-prefix copies. Last-message revision exports the source and retains only complete native messages before the final real user Turn. The new Session has a new ID, parent relation, and preserved model_config/profile. After copying, verify tool input/output field by field and unchanged source messages. Busy sources reject derivation. Later startup failure deletes only the newly derived Session owned by this instance, with unchanged parent relation and digest; never the source.

Compaction archives/continuation history can be viewed on recovery, but native import reactivates messages and cannot copy current model context without loss. These Sessions create no checkpoint and return unsupported for derivation. Expired checkpoints return checkpointNotFound; no approximate copy is made.

## Cross-Harness collaboration discovery

Gateway preserves `CODEX_Z_CLI_PATH`, `CODEX_Z_RUNTIME_ENDPOINT`, `CODEX_Z_RUNTIME_TOKEN`, and `CODEX_Z_THREAD_ID`. Only writable Sessions with all four create private OS-temporary Skill files and register `codex-z-runtime:delegation` in the current gateway through native `PluginContext.register_skill`, appended to existing `HERMES_TUI_SKILLS`. Native ephemeral system prompts load instructions for new and resumed-history Sessions. They only explain authorized delegate/thread command discovery via CLI --help and include no variable values or credentials. No plugins are installed, no user configuration is changed, and no temporary skills enter active home/skills. Other processes cannot discover this registration. Normal close and startup failure clean the private directory. Forced Host termination can leave only OS-temporary files, without skill-list pollution. inspection, gateway probe, and history reader create/register no skills.

Native Hermes delegate_task remains available. Old ACP sessions retain previous environment/hot-process behavior and do not yet have gateway cross-Harness CLI discovery. Native ACP subagents and cross-Harness delegation are distinct.

## Native evidence and validation scope

Implementation and native validation used NousResearch/hermes-agent `1450c7fcfb5cca740e9b76545bd2ecdec94f4aa0` (0.21.3). This is a test record, not an installation/resume requirement:

- [Official programmatic protocol and owner rules](https://github.com/NousResearch/hermes-agent/blob/1450c7fcfb5cca740e9b76545bd2ecdec94f4aa0/website/docs/developer-guide/programmatic-integration.md)
- [Gateway Session creation, recovery, compaction](https://github.com/NousResearch/hermes-agent/blob/1450c7fcfb5cca740e9b76545bd2ecdec94f4aa0/tui_gateway/methods_session.py), [configuration](https://github.com/NousResearch/hermes-agent/blob/1450c7fcfb5cca740e9b76545bd2ecdec94f4aa0/tui_gateway/methods_config_set.py)
- [Tool lifecycle and native diff](https://github.com/NousResearch/hermes-agent/blob/1450c7fcfb5cca740e9b76545bd2ecdec94f4aa0/tui_gateway/tool_progress.py), [diff display fragments](https://github.com/NousResearch/hermes-agent/blob/1450c7fcfb5cca740e9b76545bd2ecdec94f4aa0/agent/display.py)
- [Persisted database](https://github.com/NousResearch/hermes-agent/blob/1450c7fcfb5cca740e9b76545bd2ecdec94f4aa0/hermes_state.py), [import/export](https://github.com/NousResearch/hermes-agent/blob/1450c7fcfb5cca740e9b76545bd2ecdec94f4aa0/hermes_state_portability.py)
- [ACP commands](https://github.com/NousResearch/hermes-agent/blob/1450c7fcfb5cca740e9b76545bd2ecdec94f4aa0/acp_adapter/commands.py), [ACP protocol](https://github.com/NousResearch/hermes-agent/blob/1450c7fcfb5cca740e9b76545bd2ecdec94f4aa0/acp_adapter/server.py)

Protocol fixtures cover Question/approval/configuration confirmation, diff fragments, command/compaction failure and cancellation, late events, duplicate answers, process faults, old ACP routing, and owner constraints. Optional native tests use `CODEX_Z_HERMES_NATIVE_TEST_PYTHON` for the installed Hermes Python. Under isolated HERMES_HOME they execute real SessionDB derivation/rollback/compaction lineage, use a local OpenAI fixture to drive real gateway/clarify/terminal/resume, and validate in-process skill preload, retained user skills, resumed sessions without prior delegation instructions, and Host CLI environment. They call no paid models. Real external-model compaction and Desktop end-to-end acceptance were not performed.

Compatibility regressions replace only release/contract metadata inside real Hermes children and test creation, tools, history, Fork, and resume without editing installed files. ACP stdio fixtures verify commands across protocolVersion values and resume of old/new/contract-free gateway refs. Missing interfaces, invalid response formats, mismatched Session identities, and history-validation failures still error, independently of version numbers. Metadata-substitution tests do not prove all behavior of other releases.
