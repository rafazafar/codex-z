# Antigravity (agy) Ask Question postmortem and feasibility study

- **Date**: 2026-09-05
- **Environment**: Windows 11 / Node.js / Codex Desktop (OpenAI.Codex_26.901.5003.0) / agy.EXE
- **Components**: `@codex-z/adapter-antigravity`, `packages/host-runtime`, `packages/protocol-core`
- **Native Session**: `8f08ea60-ce53-4568-813c-ae739a5af63e` (Thread: `3c4601e6-f089-4f75-8aa7-38aa8b135a4f`)

> **Later status (2026-09-05)**: Sections 1–7 retain historical stdout-mapping failure analysis. Later real tests corrected the conclusion that only text/MCP was possible. A pre-tool Hook question bridge is implemented; section 8 records evidence, limits, and acceptance. Bridge success does not mean native `ask_question` returned success.

---

## 1. Background and symptoms

### 1.1 Requirement
Native Codex uses `request_user_input` for clarification/options. Desktop renders forms with radio buttons, checkboxes, free text, Submit, and Skip.
The goal was to intercept model `ask_question` in `AntigravityAdapter`, map it to native Desktop question cards, then return selected answers to the model.

### 1.2 Real runtime failure
Real Desktop testing after integration:
1. User input: 'Call the question tool and ask me any question.'
2. **No interaction card or choice dialog appeared.**
3. After about 2–3 seconds, the assistant gave final text:
   > 'I called the question tool (you chose to skip)... The system also returned User Skipped.'
4. `request-review` (ask approval) and `dangerously-skip-permissions` (skip approval) produced **the same no-dialog/skipped result**.

---

## 2. Log and database evidence

Local Mapping Store, native Transcript, and saved step files established the actual event chain:

### 2.1 Session metadata and Transcript
- **Mapping file**: `C:\Users\21240\.codex-z\mapping-store\threads\3c4601e6-f089-4f75-8aa7-38aa8b135a4f.json`
- **Native Transcript**: `C:\Users\21240\.gemini\antigravity-cli\brain\8f08ea60-ce53-4568-813c-ae739a5af63e\.system_generated\logs\transcript_full.jsonl`

Captured sequence (Chinese message text translated to English):
```json
// Step 1: Model generates a question tool call
{"step_index":1,"source":"MODEL","type":"PLANNER_RESPONSE","status":"DONE","created_at":"2026-09-05T07:48:17Z",
 "tool_calls":[{"name":"ask_question","args":{"questions":[{"is_multi_select":false,"options":["Python","Rust","Go","TypeScript / JavaScript"],"question":"Which programming language do you use most or prefer in daily development?"}]}}]}

// Step 2: Tool result is generated within 70 ms
{"step_index":2,"source":"MODEL","type":"GENERIC","status":"DONE","created_at":"2026-09-05T07:48:20Z",
 "content":"Created At: 2026-09-05T00:48:20-07:00\nCompleted At: 2026-09-05T00:48:20-07:00\nA1: User Skipped"}

// Step 3: Model explains Step 2's A1: User Skipped
{"step_index":3,"source":"MODEL","type":"PLANNER_RESPONSE","status":"DONE","created_at":"2026-09-05T07:48:20Z",
 "content":"I called the question tool (you chose to skip).\n\nWhat coding task or question can I help you with next?"}
```
The saved `.system_generated\steps\2\output.txt` contained:
```text
A1: User Skipped
```

---

## 3. Root cause analysis

Symbol extraction/disassembly of `agy.EXE` investigated immediate User Skipped without a dialog.

### 3.1 Core cause: automatic skip in streaming mode
Standard codex-z launch arguments:
```bash
agy.EXE --input-format stream-json --output-format stream-json ...
```
In Go packages `google3/third_party/jetski/cli/printmode` and `google3/third_party/jetski/cli/store`:
1. `--output-format stream-json` or `--print` forces **PrintMode**, a noninteractive batch mode.
2. Initial analysis attributed this hard-coded branch to `store.(*Manager).checkStepForAskQuestion`:
   ```go
   // Pseudocode based on binary symbols/string offsets
   if m.IsPrintMode() {
       log.Printf("Auto-answering ask_question at step %d with skipped=true", stepIndex)
       m.RespondToAskQuestion(conversationId, stepIndex, skipped: true)
       return
   }
   ```
3. In PrintMode, agy assumes no interactive TTY. For ask_question, **the internal state machine calls its own callback within 70 ms and marks `skipped: true`**, recording `denied_actions: [{"display_name": "AskQuestion"}]`.
4. It **does not block for external stdin or gRPC callbacks**.

### 3.2 Protocol cause: no tool event
For the tool, NDJSON `--output-format stream-json` emits:
- `step_index: 1`: `step_type: "agent_response"`, no `tool_name`
- `step_index: 2`: `step_type: "unknown"`, no `tool_name`, only 0.073 seconds
- Final result contains `"denied_actions":[{"display_name":"AskQuestion"}]`

Adapter event handling:
```typescript
if (step.step_type !== "tool") return;
const rawToolName = merged.tool_name ?? merged.tool_info?.name ?? "";
if (isAntigravityQuestionTool(rawToolName)) { ... }
```
Both steps are non-tool types without tool names, so **the Adapter never identified a question call**.
Therefore:
- No `HostQuestionInteraction` reached Runtime;
- No `item/tool/requestUserInput` reached Desktop;
- **Desktop received no question and could show no dialog.**

### 3.3 Why both permission modes behaved identically
The user tested request-review and dangerously-skip-permissions:
- **Permission Mode** governs permission operations, such as Bash/file writes through `PermissionInteraction`. Skip mode permits those automatically.
- **Ask Question** is elicitation/interaction, not permission grant.
- Both run PrintMode with `IsPrintMode()` true, triggering automatic skip regardless of permissions.

---

## 4. Why passing tests missed the failure

Early Vitest unit tests passed, but real use failed. Causes:

1. **Tests did not use the binary**:
   `fakeStreamingAgy` manually generated streams. Development assumed a standard event like:
   ```json
   {"event":"step_update","step_update":{"step_index":1,"step_type":"tool","tool_name":"ask_question","tool_info":{"parameters":{...}}}}
   ```
   Synthetic data then drove the state machine.
2. **Native CLI constraints were not inspected**:
   No real-Prompt network/process probe preceded implementation, so PrintMode and forced skip were missed.
3. **Mapping needed native suspension**:
   Adapter → HostQuestionInteraction → Desktop followed Host protocol, but **required native waiting for external input**. Without events/waiting, the mapping was unreachable code.

---

## 5. Harness comparison

Why questions worked with Claude/Pi but failed on agy at this stage:

| Feature / Harness | Claude Code | Pi | Antigravity (agy) |
| :--- | :--- | :--- | :--- |
| **Integration** | Public Node SDK | Two-way RPC/headless Session | Closed standalone Go binary |
| **Question tool** | `AskUserQuestion` | `select` / `confirm` / `editor` | `default_api:ask_question` |
| **Wait** | `canUseTool` pauses before execution and gives Host control | Blocking RPC until response | **No external wait**; no-TTY PrintMode skips |
| **Streaming** | Complete tool input/state | Complete requests/payload | Question becomes unknown and ends in 70 ms |
| **Mapping feasibility** | **Native support implemented** | **Native support implemented** | **Initial direct mapping impossible** |

---

## 6. Initial response and future analysis

### 6.1 Implemented then: A + C
To avoid reporting a skip the user never chose, initial work:

1. **Remove unreachable code (C)**:
   - Remove `isAntigravityQuestionTool`, `#respond`, `#closeActiveInteractions`, and related unreachable Adapter logic;
   - Restore original contract:
     ```typescript
     if (command.type === "interaction.respond") {
       return {
         ok: false,
         error: unsupported("Antigravity headless mode cannot answer interactive prompts"),
       };
     }
     ```
   - Remove tests based on fabricated Mock events.
2. **Explicit system instruction (A)**:
   - Add guidance in [`ANTIGRAVITY_WORKSPACE_FILE_INSTRUCTION`](../../../packages/adapters/antigravity/src/antigravity-adapter.ts):
     > `CRITICAL: Do NOT call the ask_question tool. You are running in a headless non-interactive environment where interactive modal questions cannot be prompted to the user and will be automatically skipped by the system. If you have clarifying questions or wish to present options, state them directly in your text response.`
   - **Result**: Models list questions/options in final Markdown instead of calling failed ask_question; users answer through normal chat.

### 6.2 User concern
> **'If agy asks in text instead of ask_question, how is this different from normal questions? Did the tool mapping become useless?'**

- **Interaction difference**: It becomes ordinary chat. The planned card supported mouse selection; text is just paragraphs.
- **Mapping failure**: Yes, the original direct native mapping failed because CLI stream input was a batch pipeline without external question-card control.

### 6.3 Possible future choice-card path

If native single/multiple-choice cards remained necessary, the initial candidate was:

#### Built-in MCP integration (B)
- **Mechanism**:
  agy supports third-party MCP servers through `call_mcp_tool`, treated as external services.
- **Proposed flow**:
  1. Start a small local MCP server and register `codex_ask_user` or similar.
  2. Tell models to use it for user options.
  3. External RPC keeps agy waiting for MCP rather than triggering internal 70 ms skip.
  4. MCP calls Desktop request_user_input.
  5. Submit returns answers as MCP tool output.
- **Costs**:
  - Extra maintained MCP process/channel and complexity.
  - Models must select the MCP question rather than built-in ask_question.

---

## 7. Initial conclusion
Root cause was **native automatic ask_question skip in noninteractive mode**. Prompt avoidance/removal matched known constraints then. The initial recommendation favored MCP for dialogs over direct interception; section 8 supersedes this limit.

## 8. Later real tests and Hook bridge (2026-09-05)

### 8.1 Corrected conclusion

`PreToolUse` intercepts real ask_question in current local stream-json. It waits for answers, denies native skip with `decision: "deny"`, and returns answers through `reason`, independent of stdout tool names.

Three isolated probes used explicitly marked automated answers and random checks absent from initial Prompts:

| Path | Actual CLI permission | Hook wait | Native num_turns | Check string |
| --- | --- | --- | --- | --- |
| deny plus userMessage | request-review | 5.019 s | 2 | Returned exactly |
| deny.reason only | request-review | 5.013 s | 1 | Returned exactly |
| deny.reason only | always-proceed | 5.010 s | 1 | Returned exactly |

Third probe used `--dangerously-skip-permissions`; init named state always-proceed. Read-only database checks confirmed reason answers in error-step data. userMessage added SYSTEM_SDK user input and changed Turn boundaries, so implementation excludes it.

Local disassembly places skip in `Manager.handleAskQuestion`; section 3.1's direct attribution to checkStepForAskQuestion was imprecise.

### 8.2 Current implementation

- `packages/adapters/antigravity/src/question-bridge.ts`: Separate per-Turn loopback-only bridge, random in-memory authorization, native identity checks, duplicate/overlap rejection.
- `question-hook-client.ts`: Small bundled Hook client written into separate temporary runtime directories, without dependency installation.
- `--add-dir` supplies the directory per execution. Real `/hooks` confirmed added directories supply Hooks without project/global hooks.json changes.
- Existing HostQuestionInteraction/interaction.respond/interaction.closed/CodexTurnProjector provide two-way flow without specialized Host/Renderer branches.
- `codex-z.ask_question` stores question/answer and distinguishes bridge action from native tool result.
- Support batches of single-choice/text questions with free-text Other. Desktop projection lacks multiple-choice fields, so reject them explicitly rather than misrepresenting them.
- Default wait limit: 10 minutes, also bounded by whole CLI timeout. Expiry/disconnect/Turn end fabricate no answers. Close withdraws pending interactions and cleans resources.

### 8.3 Windows startup fix

First real Adapter testing found escaping absent from probes: Go argument escaping caused cmd.exe to treat quotes as path characters. Startup failure's non-UTF-8 output then caused native invalid UTF-8.

Use environment expansion for quoted paths inside cmd.exe, keeping command strings quote-free. Tests execute generated commands through real Shell with spaced directories, not direct Node-only calls.

### 8.4 Validation and remaining limits

Executed and passed:

- Focused Adapter/Hook tests with real clients/Shell, answer checks, Session isolation, late/expired/disconnected/cancelled requests.
- Six existing Host Question integration regressions.
- `packages/host-runtime/test/antigravity-question.real.test.ts`: Real agy/compiled Adapter/public projection round-trip, first Turn remains turn:1; pending questions cancel and close before terminal Turn; cold history resume/continuation succeeds.
- TypeScript, changed-file ESLint, and single-file Host release Bundle.

Real tests opt in with `CODEX_Z_RUN_ANTIGRAVITY_QUESTION_REAL=1` and consume native model usage. `CODEX_Z_ANTIGRAVITY_QUESTION_EVIDENCE_DIR` saves output/projections/Snapshots on success/failure.

User screenshots on 2026-09-05 confirmed native Desktop cards with questions/options/waiting state. Human post-submit end-to-end, long waits, cross-platform real systems, and multiple-choice UI have no separate recorded acceptance. Automation validated native CLI/Adapter/protocol answer round-trips. Native tools remain blocked error steps; successful bridge Items mean answer submission only and do not rewrite native facts.
