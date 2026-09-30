# Harness capability-table boundaries

The feature table describes capabilities actually available in current codex-z plugins. Upstream interactive-terminal features are not automatically available through plugins. Each Harness uses its own native interface. The public Adapter contract does not simulate permissions, fabricate history, or own Harness-specific protocols.

## Harness integration paths

- **OMP**: Native questions and tool approvals are integrated. Choices preserve native per-option descriptions; timeout and user cancellation return `timedOut` / `cancelled`. See [OMP interactions](omp/omp-interactions.md). Subagent projection requires RPC `set_subagent_subscription` (server default `off`). Host requests `events` at connection startup. Older OMP without this command continues without subagent projection. Transcript reads first read `<subagent-id>.jsonl` beside the parent session file. The RPC subagent registry is in memory, so a cold process cannot resolve completed children by ID. If the file is absent, fall back to RPC.
- **CodeBuddy**: Read slash commands from the dynamic ACP catalog and confirm compaction through native events and persisted results. A native appended system prompt exposes the Host delegation CLI. Fork/revision uses model-free native copy, native `/fork`, and rollback on only the new copy. It verifies the complete history prefix and unchanged source. Derived configuration restores with native refs. After success, the same temporary ACP process deletes the intermediate copy through native HTTP; early failures or forced termination can leave it behind. See [CodeBuddy integration](codebuddy/codebuddy-harness-integration.md).
- **Cursor**: Parameterized model catalogs provide Thinking combinations; native ACP command catalogs provide commands; per-session native HTTP MCP provides outbound delegation. See [Cursor integration](cursor/cursor-cli-experimental.md).
- **Hermes**: New sessions prefer an available official gateway without numeric-version blocking. Questions, Thinking, commands, compaction, native Diff, and independent Fork/revision of uncompacted history are integrated. An in-process private temporary Skill exposes Host CLI and retains parent-task environment, without writes to shared skill directories. Old ACP references still resume through ACP. See [Hermes capabilities and boundaries](hermes/hermes-capabilities.md).

These implementations belong to their Harness plugins. No Harness-specific branches enter the public Adapter, Host, or Renderer. Reference implementations across plugins do not mean a shared native protocol. Each retains configuration confirmation, cancellation, persistence, and permission semantics.

## Kimi Thinking configuration

Kimi ACP `configOptions` supplies the current Session/Model Thinking list and selection. The plugin reads these facts on create, resume, configuration responses, and `config_option_update`. It stores the list in Session-memory `availableThinkingOptions` and updates Desktop through public state events. It does not poll or cycle Models at startup inspection. Sessions and Hosts do not share mutable lists.

Startup inspection reads only the configured Model catalog and authentication. Configuration is not a Thinking capability catalog, so draft catalogs do not guess `medium` or `off/on` and do not send automatic Thinking defaults. Without an explicit selection, preserve native defaults. After Session creation, use its native list. A Model change replaces the whole old list with returned configuration, without replaying old Thinking. Clear stale lists when native data supplies none. Current-Model options do not spread to other Models.

If an explicit or restored Thinking selection is absent from the current native list, return an error. Do not map `medium` to `on` or silently replace the user's selection. Select a native supported value or clear the old choice. `off/on` is native for some Models, not a fixed capability of all Kimi Models.

## Remaining Cursor boundaries

Current Cursor ACP exposes no Usage, Fork, rollback, or compaction operation. macOS/Linux Fork uses an isolated CLI session copy with native `/fork`, then `/rewind` with the conversation-only restore option for historical positions, and finally ACP resume. Last-message revision uses this same path, including a single-Turn rollback to empty history. Content is not converted; the target needs a native rollback point. Windows Fork/revision and cross-workspace Fork are unsupported. The plugin does not rewrite native messages to synthesize rollback or count an ordinary `/compact` Prompt as compaction.

Agent collaboration is currently one-way. A normal Cursor Session can delegate, query, and follow up with other Harnesses through native MCP. Unattended inbound tasks need confirmed native Full Access. Cursor `--force` can be silently reduced by team policy, and ACP exposes only Agent/Plan/Ask, so final approval policy cannot be confirmed. Inbound support therefore returns `unsupported`. The feature table lists this separately from outbound delegation.

## Pi subagent plugin

Pi Adapter integrates the asynchronous Host state/inspection protocol of `pi-subagents` (nicobailon) and synchronous workflow `workflowChildren` summaries through public child-Thread and rendering paths. Asynchronous transcripts are bounded native windows. Synchronous workflows locate read-only child Sessions from parent results; unavailable files can show explicitly marked native-result summaries. Synchronous single-Agent calls without a supported identity protocol and other same-name plugins are not automatically compatible. See [Pi subagent mapping](pi/pi-subagents.md).

## Pi permission modes

Local Pi `0.85.1` RPC, get_state, and types have no native Session permission-mode catalog or switching operation. Default tool behavior is not a selectable Permission Mode. `--tools` / `--exclude-tools` filter loaded tools; `--approve` trusts project files. They cannot represent a common read-only/ask/full-access policy.

The plugin continues to support native extension interactions without a Host-owned Pi permission engine. Switchable modes require Pi or an explicitly installed native extension to publish policy, a setting interface, and effective-state confirmation. Do not infer Pi behavior from another Harness's permission names.

Evidence: Philosophy and Extensions in the [official Pi README](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md), plus local `pi --help` / RPC documentation. Core has no permission popups and allows extension-defined confirmation. permission-gate / plan-mode examples use command matching and tool filtering, not core permission modes.

## Antigravity tool approval and compaction

Local agy `1.2.5` `--help` and `-p /help --output-format json` were inspected. Headless input accepts Prompts, not two-way tool-permission answers. Official documentation says operations needing interactive approval are soft-denied in headless mode. Skip permissions remains a native startup option. PreToolUse Hooks allow allow/deny/ask decisions before execution, but are not a native approval request/response channel. Headless ask is still soft-denied; Hook interception must not create another permission policy. Question Hooks apply only to ask_question, not normal tool approval. Python SDK [ask_user policy](https://antigravity.google/docs/sdk/policies/) belongs to a separate runtime, not the logged-in CLI Session approval-response path.

The native headless catalog publishes neither `/compact` nor `/compress`, and has no validated compaction command or automatic start/completion events. SDK/terminal compaction does not prove equivalent CLI Session operations. Future native headless/RPC support needs a confirmed compaction action and result before the plugin maps it to commands and contextCompaction Items. An ordinary 'please summarize' Prompt is not compaction. Python SDK token_threshold sets automatic thresholds; the official [on-demand compaction request](https://github.com/google-antigravity/antigravity-sdk-python/issues/63) remained open.

Evidence: [official Hooks](https://antigravity.google/docs/hooks), [headless](https://antigravity.google/docs/cli/headless/), [permissions](https://antigravity.google/docs/cli/permissions), and [plugin permission boundaries](antigravity/antigravity-tool-approval.md). The `/help` probe returned num_turns=0 and issued no model request.
