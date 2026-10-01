# Documentation

This index lists current documents and historical archives by feature area. Proposals, research, and archives do not describe current implementation.

## Project entry points

| Document | Content and when to read |
| --- | --- |
| [`project/README.ko.md`](project/README.ko.md) | Korean project introduction, source setup, and capabilities. |
| [`project/terminology.md`](project/terminology.md) | Harness, Model, Provider, Account, Thread, and related terms. Read before naming product or code concepts. |

## Harness architecture and public capabilities

| Document | Content and when to read |
| --- | --- |
| [`architecture/harness-plugin-runtime.md`](architecture/harness-plugin-runtime.md) | Current plugin loading, preinstalled distribution, runtime contracts, and trust boundaries. Read first for plugin changes. |
| [`architecture/harness-plugin-architecture.md`](architecture/harness-plugin-architecture.md) | Target plugin architecture and incomplete migration plan. Interface examples are not current APIs. |
| [`architecture/harness-command-integration.md`](architecture/harness-command-integration.md) | Native-command ownership across Adapter, Host, and Renderer. Read when adding commands. |
| [`architecture/harness-executable-discovery.md`](architecture/harness-executable-discovery.md) | Cross-platform CLI discovery, installation guidance, and DSH connection limits. |
| [`architecture/harness-session-import.md`](architecture/harness-session-import.md) | Local Session import contracts and recovery boundaries. |
| [`architecture/external-thread-steering.md`](architecture/external-thread-steering.md) | External steering: cancel the old Turn, then start the new input. |
| [`architecture/thread-watch.md`](architecture/thread-watch.md) | One-time Thread stop notifications, results, delivery, and limits. |
| [`architecture/usage-ledger.md`](architecture/usage-ledger.md) | Per-Turn usage ledger, how each Turn's share is derived, and the limits of the Settings → Usage comparison. |
| [`architecture/app-server-transport.md`](architecture/app-server-transport.md) | WebSocket/JSONL boundaries for large native history responses and forwarding performance. |
| [`architecture/acp-layer-follow-up.md`](architecture/acp-layer-follow-up.md) | Conditions and ownership for extracting shared ACP mechanisms. |

## Harness guides

[Capability boundaries](harnesses/capability-boundaries.md) describes integration conditions, dynamic Kimi Thinking, one-way Cursor delegation, and remaining Pi permission/Antigravity approval and compaction gaps.

### Antigravity

| Document | Content and when to read |
| --- | --- |
| [`harnesses/antigravity/antigravity-tool-approval.md`](harnesses/antigravity/antigravity-tool-approval.md) | Native permission skipping, rejected old modes, and question-bridge boundaries. |
| [`harnesses/antigravity/antigravity-subagents.md`](harnesses/antigravity/antigravity-subagents.md) | Native agy Subagent lifecycle, Transcript, and public projection. |
| [`harnesses/antigravity/antigravity-question-interaction-postmortem.md`](harnesses/antigravity/antigravity-question-interaction-postmortem.md) | Historical Ask Question failure, later Hook-bridge tests, and limits. |

### Claude Code

| Document | Content and when to read |
| --- | --- |
| [`harnesses/claude-code/claude-code-plan-mode.md`](harnesses/claude-code/claude-code-plan-mode.md) | Plan mode, plan-exit confirmation, and permission-state boundaries. |
| [`harnesses/claude-code/claude-code-edit-recovery.md`](harnesses/claude-code/claude-code-edit-recovery.md) | Independent edited Sessions, retained empty history, and close semantics. |

### CodeBuddy, WorkBuddy, and Cursor

| Document | Content and when to read |
| --- | --- |
| [`harnesses/codebuddy/codebuddy-harness-integration.md`](harnesses/codebuddy/codebuddy-harness-integration.md) | Native ACP plugin, lifecycle, and capability limits. |
| [`harnesses/workbuddy/workbuddy-harness-integration.md`](harnesses/workbuddy/workbuddy-harness-integration.md) | Public ACP integration of the bundled CLI, authentication isolation, and private Desktop runtime limits. |
| [`harnesses/cursor/cursor-cli-experimental.md`](harnesses/cursor/cursor-cli-experimental.md) | Experimental Cursor CLI ACP plugin and capability limits. |

### DeepSeek Harness

| Document | Content and when to read |
| --- | --- |
| [`harnesses/deepseek/dsh-edit-recovery.md`](harnesses/deepseek/dsh-edit-recovery.md) | Native stop confirmation, message revision, V0/V3/V4 Fork, and versioned checkpoints. |
| [`harnesses/deepseek/dsh-015rc1-validation.md`](harnesses/deepseek/dsh-015rc1-validation.md) | DSH 012/015/017 versions, real CLI lifecycle tests, and protocol evidence. |

### Hermes

| Document | Content and when to read |
| --- | --- |
| [`harnesses/hermes/hermes-capabilities.md`](harnesses/hermes/hermes-capabilities.md) | Gateway questions, Thinking, exact derivation, collaboration discovery, and old ACP boundaries. |

### OpenCode and Pi

| Document | Content and when to read |
| --- | --- |
| [`harnesses/opencode/opencode-harness-integration-analysis.md`](harnesses/opencode/opencode-harness-integration-analysis.md) | OpenCode v1/v2 compatibility, version selection, native interfaces, and validation limits. |
| [`harnesses/opencode/opencode-edit-recovery.md`](harnesses/opencode/opencode-edit-recovery.md) | Native Fork edit recovery and cancellation terminal states. |
| [`harnesses/pi/pi-edit-recovery.md`](harnesses/pi/pi-edit-recovery.md) | Empty-history editing, native file publication, and lifecycle Gate. |
| [`harnesses/pi/pi-subagents.md`](harnesses/pi/pi-subagents.md) | Asynchronous pi-subagents state, synchronous workflow children, transcript reads, and Adapter limits. |

### OMP

| Document | Content and when to read |
| --- | --- |
| [`harnesses/omp/omp-interactions.md`](harnesses/omp/omp-interactions.md) | Native questions, approval, option descriptions, and timeout semantics. |

### Grok

| Document | Content and when to read |
| --- | --- |
| [`harnesses/grok/subagent-status-and-model.md`](harnesses/grok/subagent-status-and-model.md) | Grok Subagent state, Model, Transcript, and Desktop projection. |

## Accounts and Desktop integration

| Document | Content and when to read |
| --- | --- |
| [`product/codex-accounts.md`](product/codex-accounts.md) | Native account/limits display, external-Harness submission, manual Pi imports, and import-record management. |
| [`product/codex-native-account-switching-design.md`](product/codex-native-account-switching-design.md) | Read-only boundaries after Codex multi-account switching removal. |
| [`architecture/renderer-settings-styling.md`](architecture/renderer-settings-styling.md) | Settings Tailwind boundaries, build, and authoring rules. |
| [`operations/codex-desktop-upgrade-diagnosis-playbook.md`](operations/codex-desktop-upgrade-diagnosis-playbook.md) | Diagnose Renderer, Bridge, Agent, and Model failures after Desktop upgrades. |

## Platforms, processes, and remote execution

| Document | Content and when to read |
| --- | --- |
| [`platforms/linux/linux.md`](platforms/linux/linux.md) | Linux source setup, compatibility, process ownership, and diagnostics. |
| [`platforms/remote/remote-ssh-host.md`](platforms/remote/remote-ssh-host.md) | Remote Harnesses through native Desktop SSH workspaces, setup, and diagnostics. |
| [`platforms/remote/remote-control-host.md`](platforms/remote/remote-control-host.md) | Harnesses on controlled Windows machines through Remote Control. |
| [`platforms/macos/macos-native-tools.md`](platforms/macos/macos-native-tools.md) | macOS Browser/Computer Use helper app-server routing. |
| [`platforms/macos/native-aqua-broker.md`](platforms/macos/native-aqua-broker.md) | Native remote Harness plugin Broker in macOS Aqua sessions. |
| [`platforms/macos/macos-process-observation.md`](platforms/macos/macos-process-observation.md) | Shim process-tree observation, path-read optimization, and identity invariants. |
| [`platforms/windows/windows-tool-compatibility.md`](platforms/windows/windows-tool-compatibility.md) | Windows Browser Use, Computer Use, and helper-process routing. |

## Maintenance

| Document | Content and when to read |
| --- | --- |
| [`operations/host-runtime-log.md`](operations/host-runtime-log.md) | Runtime diagnostic log locations, content, rotation, and limits. |
| [`operations/repository-maintenance.md`](operations/repository-maintenance.md) | PR labels, CI comments, and pre-release automation. |

## Proposals and investigations

These proposals are unimplemented or unapproved and must not be used as current capability descriptions.

| Document | Content and when to read |
| --- | --- |
| [`proposals/external-harness-idle-unload-proposal.md`](proposals/external-harness-idle-unload-proposal.md) | Idle-resource release/resume proposal, implementation progress, and validation limits. |
| [`proposals/reasoning-preview-and-transcript-proposal.md`](proposals/reasoning-preview-and-transcript-proposal.md) | Live Reasoning preview and durable Transcript proposal. |
| [`proposals/turn-file-change-summary-proposal.md`](proposals/turn-file-change-summary-proposal.md) | Repeated Turn file-change summaries, semantic layers, and candidate net-diff designs. |

## Historical archives

Archives preserve decision history and do not describe current implementation.

### Codex Desktop compatibility incidents

| Document | Content and when to read |
| --- | --- |
| [`archive/codex-desktop-incidents/26.814-compatibility-debt.md`](archive/codex-desktop-incidents/26.814-compatibility-debt.md) | Desktop 26.814 incident involving Renderer Request Bridge and Agent/Model routing. |
| [`archive/codex-desktop-incidents/26.908-request-manager-wrapper.md`](archive/codex-desktop-incidents/26.908-request-manager-wrapper.md) | Desktop 26.908 Request Manager Fiber wrapper incident causing connection checks to fail. |

### Harness integration and discovery

| Document | Content and when to read |
| --- | --- |
| [`archive/deepseek-integration/deepseek-harness-integration-analysis.md`](archive/deepseek-integration/deepseek-harness-integration-analysis.md) | Native-interface research and staged DeepSeek integration analysis. |
| [`archive/grok-integration/grok-cli-adapter-integration.md`](archive/grok-integration/grok-cli-adapter-integration.md) | Early ACP integration architecture and capability analysis. |
| [`archive/grok-integration/grok-build-fork-integration.md`](archive/grok-integration/grok-build-fork-integration.md) | Native Session Fork protocol, boundaries, and preimplementation validation. |
| [`archive/harness-discovery-pre-2df7058/README.md`](archive/harness-discovery-pre-2df7058/README.md) | Archive scope and usage rules for pre-discovery implementation records. |
| [`archive/harness-discovery-pre-2df7058/01-desktop-install-discovery-notes.md`](archive/harness-discovery-pre-2df7058/01-desktop-install-discovery-notes.md) | Early native installation discovery analysis for Desktop and codex-z. |
| [`archive/harness-discovery-pre-2df7058/02-per-adapter-harness-discovery-notes.md`](archive/harness-discovery-pre-2df7058/02-per-adapter-harness-discovery-notes.md) | Per-Adapter discovery implementations before the public package. |
| [`archive/harness-discovery-pre-2df7058/03-invalidated-conclusions.md`](archive/harness-discovery-pre-2df7058/03-invalidated-conclusions.md) | Invalidated or conditional early conclusions and current facts. |
