# Automatic release of idle external Harness sessions: design and implementation

> Status: implemented on a separate branch according to the agreed design; see [PR #303](https://github.com/BytePioneer-AI/codex-host/pull/303). Not yet released at the time of this record. Real Desktop and per-Harness validation remain incomplete, and the PR remains Draft.
> Source: [#294](https://github.com/BytePioneer-AI/codex-host/issues/294) and subsequent design discussion.
> Evidence (2026-09-15): source inspection; analysis of the local Codex Desktop 26.908.40834 package and logs; tests of the stock `codex-cli 0.154.0-alpha.6.2` app-server; synthetic Host probes in temporary, uncommitted files. Automatic release and restore were not tested in real Desktop.
> Revision: earlier designs considered Renderer foreground reports, native Codex unsubscribe semantics, Adapter activity probes, and process-group checks. They were rejected because of complexity or limited benefit (section 6). This revision uses an explicit user setting and a configurable idle timeout, with recoverability and Host-operation coordination. The latest review limits the design to the local Host; protects active operations with per-Thread occupancy counts rather than elapsed time; shares validation through `shared-contracts`; retains settings page ID `appearance`; permits integer timeouts of 5–1440 minutes; and stores settings in Renderer localStorage before sending them to the local Host.

## 1. Background and goal

Logical external Threads, loaded Sessions, and process counts are different measures. Sessions started in the current Host usually stay loaded after a Turn finishes. Most Harnesses use a separate backend process per Session (section 5.1), so unused sessions continue to consume memory and processes.

The goal is optional automatic resource release: close backend processes for long-idle sessions, then restore the original Native Session when needed. No fixed resource saving or Token-cost reduction is promised.

The original issue proposed restoration only when the next real user message arrives, plus connection-count thresholds and an observation mode. This design is a narrower alternative and must not be described as full implementation of that issue.

All functionality is limited to the local Host. Managed remote Hosts, Remote Control connections, and other remote cases are outside the design and validation scope.

## 2. Design overview

- Rename the visible Appearance settings page to General. Keep existing appearance options and add an automatic idle-session resource-release switch and timeout input.
- The switch is **off by default**. The timeout is **30 minutes by default, configurable from 5 to 1440 minutes**. Enabling takes effect without a confirmation dialog. Explain effects in a question-mark tooltip beside the title instead of long page text.
- **Local Host only:** send settings only to the local Host. Remote Hosts are outside scope.
- When enabled, if an external Thread reaches the timeout and meets Host protection conditions, call existing `HarnessSession.close()` and remove the Thread from memory. Do not send an additional unload-state notification.
- Later requests that need an execution instance, such as open, send, or history read, restore through existing `ExternalThreadRuntime.resolve()`. Metadata-only requests retain their existing no-restore behavior.
- The design does not prove that every native child process or background task has ended. The user accepts possible interruption when enabling the setting. Host-known active tasks and operations remain protected.
- Apply the design to all Harnesses and reuse existing Adapter close/restore interfaces before adding anything else. Do not add a universal safety probe. Individual validation determines whether an Adapter needs correction; zero Adapter changes cannot be promised in advance.

## 3. Behavior

### 3.1 Settings

- Location: change the visible Appearance name to General but retain internal ID `appearance` and `appearance-page.ts`. Keep existing settings and preferences; add a Resource management group. Change the localized page name and description, which previously described only Thinking-text display. Controls, explanations, and errors use the existing localization system.
- Scope: Renderer sends the setting only to `hostId: "local"`. Add no remote Host handling.
- Layout: below the title and one-line description, show Appearance and Resource management cards. On the right of the Resource management title, show a short colored-dot status only while settings are not active: syncing, unsupported Host, or sync failed. Hide it after success. Put the local-only explanation in the tooltip. Each row has a title, one-line description, and right-aligned control.
- Controls: an “Automatically release idle sessions” switch (`role="switch"`) and numeric Idle timeout input with “minutes” inside the field. Do not use a dropdown. Default to off and 30 minutes. Show the timeout only while enabled. Disabling hides the input but retains the saved duration and discards invalid draft values.
- Range: **integer minutes from 5 to 1440**. Set `min=5`, `max=1440`, and `step=1`; retain native increment/decrement controls. State the range in the description. Reject empty, fractional, or out-of-range values, apply error styling, and show “Enter an integer from 5 to 1440.”
  - Five-minute minimum: checks occur about once per minute, so shorter timeouts have excessive relative timing error. Occupancy counts, not this lower limit, protect active operations.
  - 1440-minute maximum (24 hours): longer durations are effectively no release; users can disable the switch. The limit also avoids millisecond-conversion overflow.
- Define validation, including both limits, in one `shared-contracts` schema used by Renderer and Host. Use 30 minutes when no setting exists. Invalid saved configuration must not enable release.
- Host applies only complete, valid settings. A duration change affects the next check without resetting activity times. Explain that reducing it can release already-idle sessions on the next check.
- When disabled, start no new checks or closes. A close already in progress must complete or fail explicitly; do not cancel the wait and immediately reuse the old instance.
- Effects tooltip: the question-mark button shows `role="tooltip"` on hover or keyboard focus and closes on Esc. Use short statements:
  - A session can be released while its page is open.
  - Services such as development servers and background tasks started by the session can stop; results can be lost.
  - Reopening or sending restores the original session and waits for the Agent to restart.
  - Reducing the timeout can release existing idle sessions soon.
  - Only external Agent sessions on the local Host are affected.
- Styling: add Tailwind CSS as a build dependency. `renderer-extension/scripts/tailwind-esbuild-plugin.mjs` compiles `settings/tailwind.css`, injected as text into settings Shadow DOM. Include theme and utilities without preflight. Map colors to existing `--settings-*` variables for light/dark consistency. The plugin declares cascade-layer order and expands `@property` initial values into ordinary declarations because Chromium does not register `@property` in Shadow DOM. Move existing element-level `shell.css` base styles into `@layer base`; retain other component styles.

- Storage: **Renderer localStorage, then send to the local Host**.
  - Save `{ enabled, timeoutMinutes }` as JSON under `codex-z.idle-release.v1`, following existing preference modules. On read failure or invalid data, use off/30 minutes. Report write failure explicitly; do not present unsaved input as active or overwrite the previous valid configuration.
  - After connecting to the local Host and whenever settings change, send the complete value through `codex-z/settings/idle-release/set`. Success returns the full applied value. Repeated identical settings from multiple windows are idempotent; the last applies.
  - Reread localStorage before each actual send. Listen for `storage` events from other windows; do not replay cached window state on reconnect. Serialize sends within one connection and combine pending changes. A new connection must not wait for an old connection's unfinished request, and old replies must not overwrite the new connection's applied state.
  - Host stores settings only in memory, without another file. After restart or connection rebuild, release remains off until Renderer sends settings again.
  - Host validates with the shared schema. Invalid input returns an error without replacing valid settings.
  - If an older Host does not support the request, the existing request sender receives a method-not-supported error. The settings page must show this limit instead of silently claiming success.

### 3.2 Idle eligibility

A loaded external Thread is eligible only when all these conditions hold:

1. The setting is enabled.
2. No Turn is active: `running` is false and `activeTurnId` is empty. Approvals and questions occur within Turns.
3. No Subagent is running, using existing `#hasRunningSubagents()`.
4. No steering message is pending.
5. The Thread's Host-operation occupancy count is zero (section 3.3), with no known pending approval or question.
6. The persisted record is `ready`, `nativeSessionRef` exists, and `persistenceError` is empty.
7. The configured time has elapsed since the last activity, by default 30 minutes.

Refresh the Thread's last-activity time on any of these events:

- Thread creation or restoration.
- Any request accesses the Thread through `resolve()`, including read, execution, configuration, and delegation.
- Host handles any Harness output for the Thread.
- A Host operation on the Thread completes or fails, including lifecycle operations that do not use `resolve()`. Idle timing restarts at operation completion.

Activity time selects candidates; **it does not protect unfinished operations**. Recent access does not mean completion, and the timeout can be reduced. Condition 5 protects unfinished operations through occupancy counts.

Background reads and periodic output also reset timing and can delay or prevent release. This is an accepted conservative behavior. The design does not promise that every unused process exits within a fixed interval.

Exclude Subagent child Threads (`ReadonlySnapshotSession`), which do not occupy native processes.

Condition 2 is essential: `close()` cancels an active Turn. That is visible task interruption, not idle release.

### 3.3 Close sequence

- While enabled, Host runs a low-frequency check, for example once per minute with an `unref` timer. Stop it when Host exits or the setting is disabled.
- For each eligible Thread:
  1. Check conditions and mark it closing in one controlled entrypoint. Later requests needing an execution instance wait for the close result.
  2. Call `session.close()`, await `outputTask`, and clear interactions created during close. The closing marker covers close, output drain, interaction cleanup, persistence confirmation, and final removal. Close plus drain/cleanup has a combined 60-second limit; timeout is a close failure.
  3. Confirm again that restore identity is usable, no output or persistence error occurred, and Runtime still contains this exact instance.
  4. On success, remove the instance and clear the marker. Waiting requests use existing deduplicated restoration.
- On close failure, timeout, output-consumption failure, or persistence failure, record diagnostics and **retain the original Session reference and an explicit Host close-failure marker**. Do not retry collection or recreate automatically. Centralize failure checking in `locate()`, so every `locate()` / `resolve()` entrypoint returns a clear error instead of relying on the old Session to reject operations. Waiting requests must also receive failure rather than wait indefinitely.
- A timeout does not mean the underlying close stopped. Retain failure state; a late close result must not remove a new instance or clear failure automatically. Include restart guidance in the returned error, without another notification mechanism. Restart alone is not guaranteed to clear all residual resources.

**Operation coordination**, without a new comprehensive operation registry:

- Reuse `DesktopRequestQueue`. Run collection through `run(threadId, …)` in series with Desktop requests for that Thread. Recheck settings, activity time, and occupancy when the queued work executes. Skip occupied Threads; do not wait inside the queue for occupancy to reach zero.
- Awaited Desktop fork/rollback paths are already queued. The queue only waits for the submitted operation to return; it does not cover separately dispatched `turn/start`, `turn/steer`, command tasks, delegation-control APIs, or approval/question responses. Cover these and Desktop requests with **per-Thread Host-operation occupancy counts**, including initialization after new Thread registration:
  - `runOperation(threadId, operation)` increments synchronously before obtaining a Session reference, then calls `locate()` / `resolve()` and performs the operation. Decrement in `finally`. This avoids a gap where a reference exists but is not counted.
  - Track Host operations only. Do not probe native background work or count the whole Turn; condition 2 protects Turns.
  - Refresh last activity when the count reaches zero.
- In one synchronous segment, collection confirms zero occupancy and marks the Thread closing. New occupancy requests then wait for close. Because close begins only when nobody holds the execution instance, async operations with existing references do not interleave with it. `locate()` failure checks apply to later requests.
- Use the same coordination for collection, replacement, deletion, archival, and Host shutdown. Compare object references before removal so an old task cannot remove a new instance with the same ID.
- Do not reintroduce Adapter safety probes. Native background activity can still be interrupted during close, as disclosed when enabling the feature. This tradeoff does not permit removal of Host-known operation exclusion, output consumption, or persistence protection.

### 3.4 Restore

- Reuse the existing cold path: `resolve()` → `#restore()` → `adapter.open({ kind: "resume" })`, as when opening historical Threads after a Host restart.
- Create a new Session object; do not reuse a closed one.
- Existing `alignSnapshot()` validation preserves Native Session identity. It does not guarantee identical cwd, Model, or Thinking settings. For example, OMP and OpenCode can silently substitute a Model on restore and persist actual state. This matches current restart recovery; the proposal adds no stronger promise.
- Do not notify Desktop. Its Thread state stays unchanged. The next user operation restores the Session and waits for Harness startup.

## 4. User-visible effects and risks

| Effect | Explanation | Handling |
| --- | --- | --- |
| Session services stop | Pi, OMP, and ACP-like Harnesses signal process groups on close; Claude Code first calls `stopTask` for all background tasks | Explain before enabling |
| Background results are lost | Native work can continue after a Turn and report later as an autonomous Turn, such as Claude Code publishing an autonomous Root Turn after background completion; close prevents later output | Explain before enabling |
| Restore delay | First open/send after release waits for Harness startup | Explain before enabling |
| Release while reading | A Thread page can remain open beyond the timeout without activity; the next operation needing an execution instance restores it | Explain before enabling |
| Limited benefit for some Harnesses | Idle Antigravity holds no process; DeepSeek Harness sessions share one process | Validate per-Adapter resource scope without affecting other sessions |
| Close failure | Retain the old reference, block further use and automatic recreation in Host, and give clear recovery guidance | Record diagnostics; do not assume a failure probability |

## 5. Verified existing behavior

### 5.1 Adapter close and restore

All Adapters implement required `HarnessSession.close()` and `open({ kind: "resume" })`.

| Adapter | Idle process | `close()` behavior |
| --- | --- | --- |
| Pi | One `pi --mode rpc` process per Session | Abort an active Turn; close stdin; on timeout signal the process group with SIGTERM, then SIGKILL |
| OMP | One RPC process per Session | Same as Pi |
| Claude Code | One SDK child process per Session | Stop background tasks and end the process group |
| CodeBuddy | One ACP process per Session | Close stdin; force-stop the process tree on timeout |
| Cursor | CLI process starts when Session opens and remains loaded | Close stdin; SIGKILL on timeout |
| Grok / Hermes / Kiro | One ACP process per Session | Close stdin; SIGTERM or SIGKILL on timeout |
| OpenCode | Dedicated server process per Session | End that server process |
| Antigravity | None; starts a temporary process for each Turn | End the active Turn process and flush history |
| DeepSeek Harness | One shared `dsh web` process per Adapter | Do not end the shared process |

### 5.2 Host restore entrypoints

All entrypoints that need an execution object use `resolve()`. A synthetic Fake Adapter probe, with a stored record but no loaded Runtime instance, confirmed restoration for `thread/read` with Turns, `thread/turns/list`, `thread/items/list`, `thread/resume`, `codex-z/thread/inspect`, and `codex-z/thread/usage/inspect`. Reads without Turns, `thread/name/set`, `codex-z/thread/commands/inspect`, and `thread/unsubscribe` do not restore. Source inspection also found `resolve()` in fork, rollback, `turn/start`, `turn/steer`, `turn/interrupt`, configuration selection, command execution, and delegation CLI paths. Cold `thread/resume` restores once; `#restores` combines concurrent attempts.

### 5.3 Host data model

- `ExternalThread.session` is required. Removing a Thread from Runtime makes it unloaded; restoration needs no new state.
- `outputTask` ends only after the Session output channel ends, so it can be awaited only after `close()`. Some exceptions are caught by existing output consumption. Promise completion does not prove persistence success: release must also check `persistenceError` and explicitly observe other output-consumption failures.
- Mapping Store holds metadata, Native Session references, and Turn mappings, not a complete Transcript. Restore reads native Harness history.
- Host has no general settings persistence. Existing preferences use Renderer localStorage, and Host runtime configuration uses environment variables.
- `DesktopRequestQueue.run(threadId, operation)` serializes Desktop requests per Thread, but only awaits the submitted function. `turn/start` and `turn/steer` dispatch further async tasks inside their handlers, and delegation-control APIs bypass this queue.
- Each `AppServerHost` constructs its own `ExternalThreadRuntime`. Renderer accesses Hosts through `clientForHost(hostId)`; local Host ID is `local`.

## 6. Rejected options

| Option | Reason for rejection |
| --- | --- |
| Renderer foreground reporting plus Host timing | Depends on private Composer DOM attributes and React Fiber fallbacks; multiple windows share a connection without window identity |
| Native Codex `thread/unsubscribe` | Desktop unsubscribes after three inactive hours or above ten subscriptions; codex-z cannot adjust that policy. Implementing subscription semantics and `thread/closed`, then validating external Threads in real Desktop, is substantially more work |
| Adapter activity probes | Except for Claude Code `#backgroundTasks`, native Pi, OMP, OpenCode, ACP-like, and Cursor interfaces expose no background processes/tasks; each Adapter needs separate work |
| Process-group liveness | Simple code, but persistent MCP/language-server helpers make a Session permanently busy; Windows has no process groups; real per-Harness baselines are required |

If later evidence shows significant unintended interruption, add activity checks to individual Adapters without replacing the whole design.

## 7. Change locations and estimated effort

| Function | Main location | Complexity | Effort |
| --- | --- | --- | --- |
| Last activity, idle checks, close sequence | New `host-runtime` module and controlled `ExternalThreadRuntime` entrypoint | Low to medium | 2–3 days |
| Queue reuse and per-Thread occupancy | `ExternalThreadRuntime` and unqueued start/steer/delegation/replacement call sites | Medium | Included above |
| Settings request and shared schema | `shared-contracts` and local Host request handler, stored in memory | Low | Half to one day |
| General page name, switch, timeout, explanations | `renderer-extension` settings and localization | Low | About one day |
| Close/restore validation and necessary Adapter fixes | Per-Adapter tests; code changes determined by results | Unverified | Separate; zero changes are not promised |

**Rough estimate:** about one week for Host and settings work, plus Adapter validation. This is an unvalidated planning estimate, not a delivery commitment. Keep checks in a separate module instead of enlarging `app-server-host.ts`. Host uses public Adapter contracts without importing concrete plugins. Renderer does not decide release eligibility.

## 8. Tests and validation

Unit and synthetic tests with Fake Adapters and Fake Timers:

- No collection when disabled or settings have not arrived. Invalid settings do not enable release or replace valid configuration.
- Renderer saves and restores localStorage values; unavailable/invalid reads use defaults, and writes report failure. Send settings on local connection and change. Synchronize windows from latest storage. Ignore late responses from old connections. Show unsupported-Host state.
- Host does not collect after restart/reconnect until settings arrive. Sending identical settings again does not reset activity times.
- General retains appearance options and adds localized switch, timeout, and explanations. Defaults are off/30 minutes; saved values display correctly.
- Validate integer minutes 5–1440: accept 5 and 1440; reject 4, 1441, empty, and fractional values with guidance. Host uses the same schema. Duration increases/decreases work; disabling retains the saved duration.
- Do not close during active Turns, pending approvals/questions, running Subagents, pending steering, or nonzero Host occupancy.
- With the minimum timeout, long restore/fork/history/delegated-send operations holding a Session remain protected. There is no release gap from `resolve()` to Turn start in start/steer. Exceptions still release occupancy in `finally`.
- Renderer sends settings only to the local Host.
- Renderer and Host validate with the same `shared-contracts` schema.
- Do not close creating Threads, Threads without Native Session references, or Threads with persistence errors. Do not remove an instance if persistence/output errors arise during close.
- Do not close before the timeout. Any activity resets timing; long operations restart timing at completion.
- Close eligible Threads once and remove them from Runtime.
- Requests arriving during close wait, then restore without duplicate Session startup.
- Close/drain failure or timeout blocks all execution-instance access in Host and creates no new Session. A late underlying result cannot clear failure automatically.
- Collection coordinates with deletion, replacement, archival, setting disable, and Host shutdown. Old close tasks cannot remove new instances.
- Subagent child Threads are excluded.
- Every restore entrypoint recovers the original Native Session. Repeated release/restore cycles do not accumulate timers, callbacks, or old references.
- Host exit stops checks.

Real-environment validation:

- Every Adapter needs a create → close → original Native Session resume → send lifecycle test, plus repeated-cycle checks for references, callbacks, and resources. Method existence alone does not prove support.
- Maintain a real-Harness checklist for released resources, continued conversation after resume, and isolation from other Sessions. Dedicated-process Harnesses must exit; shared-process Harnesses must close one Session without killing the shared service.
- Verify Desktop reopen, send, and background-read behavior after silent release.
- Mark unavailable Harnesses as unverified with their blockers. Tests of one Harness do not substitute for another, and partial results are not an all-pass claim.

Choose implementation-time commands from `package.json` and repository test configuration.

## 9. Agreed decisions

- Scope: local Host only, all external Harnesses; remote Hosts excluded.
- Entry: existing Appearance page, visible name General, internal ID `appearance`.
- Switch: automatic release off by default.
- Timeout: numeric minutes with native step controls, not a dropdown; default 30, integer range 5–1440.
- Storage: Renderer localStorage, sent to local Host and held only in memory. No new configuration file under `~/.codex-z`.
- Coordination: reuse `DesktopRequestQueue` plus per-Thread occupancy to protect unfinished Host operations. Do not rely on elapsed idle time.

No product decision is outstanding. Real-environment validation remains incomplete (section 12).

## 10. Design summary

General settings provide an off-by-default automatic-release switch and configurable timeout, default 30 minutes, for the local Host only. With explicit user enablement and clear effects text, Host uses known Turn, Subagent, steering, and persistence state. Existing request queues and per-Thread occupancy protect active Host operations. Existing `close()` and `resolve()` paths perform release and restore, without Adapter safety probes or native unsubscribe semantics. Renderer localStorage persists the value; a new codex-z request sends it to the local Host. Every Adapter needs close/restore validation, with corrections based on results. Session services and background tasks may stop, and restoration takes time; the adjacent tooltip explains these costs.

## 11. Loaded-session status table

Below resource settings, General provides a compact read-only table of session name, Harness, state, minutes since last activity, and reasons release is blocked. It lists only external Threads loaded in local Host memory. Released Threads leave the list; this does not mean their chat history was deleted or all shared-service processes exited. The table is not an OS process list, shows no memory figures, and offers no immediate release or force-stop action.

On mount, request `codex-z/sessions/loaded/list`; query again about ten seconds after each request completes. Stop on page exit. Read existing runtime state and activity times only, without `resolve()`, history reads, or Adapter calls. Do not wake Sessions or refresh activity. Elapsed activity time is not time until release: execution, Host operations, subtasks/interactions, identity, and persistence problems still block it. Show explicit empty, unsupported, and failure states.

## 12. Implementation and validation progress

Implementation locations:

- `shared-contracts/src/idle-release.ts`: shared schema, defaults, and settings request name.
- `renderer-extension/src/renderer-idle-release-preference.ts`: storage, send-on-connect, multiwindow synchronization, and failure state. `settings/idle-release-controls.ts`: switch, minutes input, effects tooltip, and sync state.
- `renderer-extension/src/settings/preference-ui.ts`: grouped cards, switches, inputs with units, and tooltips using Tailwind utilities. `settings/tailwind.css` and `scripts/tailwind-esbuild-plugin.mjs`: Tailwind build integration. Renderer build moves to `scripts/build.mjs`; related E2E bundling uses the same plugin. Releases add `tailwindcss-LICENSE.txt`.
- `host-runtime/src/external-thread-idle-release.ts`: minute checks, occupancy, close/drain timeout, and failure isolation. `ExternalThreadRuntime`, `AppServerHost`, and delegation entrypoints add only required connections.
- No Adapter changes, new configuration file, native safety probe, or Desktop unsubscribe integration.
- Review fixes: close steering waiters before draining operations during abnormal exit to avoid waiting unnecessarily for old-Turn cancellation timeout. Local helper queries without policy reuse cached method support rather than clearing it on local/remote route changes; actual connection or explicit policy changes still invalidate the cache. Both have regression tests.

Validation performed at the time of implementation:

- `npm run typecheck`, `npm run lint` including dependency boundaries, and `npm run build:renderer`.
- Focused Host release/restore/delegation and Renderer settings/client/routing Vitest tests: 17 files, 367 passed. Coverage includes fake clocks, long operations, output drain, failures/timeouts, old-instance isolation, original-identity restoration, and continued sending.
- Existing close/restore tests across all 11 Adapters: 16 files, 107 passed, and 445 excluded by the name filter. These do not prove that every real Harness completed the full automatic-release flow.
- Three `renderer-idle-release.spec.ts` browser tests passed, covering tooltip display, numeric validation, enablement without a dialog, persistence/reload, multiwindow sync, and unsupported older Hosts. Three `renderer-settings-accounts.spec.ts` tests passed. After the settings redesign, temporary screenshot tests visually checked dark Chinese, light Chinese, and dark English states.
- After the settings redesign, Renderer and release Vitest tests passed except for existing failures below, including updated license-count assertions. Dependency boundaries passed.

Failed or unexecuted validation at that time:

- Five additional existing `renderer-binding-startup.spec.ts` cases failed because `installReasoningTranscriptSoftWrap()` directly read localStorage on `about:blank`, raising `SecurityError` before bindings installed. The first failure was reproduced in an isolated unchanged `7b630f6e` baseline. That PR did not expand scope to fix it.
- The same failures were reproduced in an isolated unchanged HEAD worktree and were unrelated to settings changes: four `renderer-external-queue.test.ts` cases; six combined startup/composer-isolation cases; and `renderer-usage-notification.spec.ts` could not bundle without an `.svg` loader.
- Real Codex Desktop and real-Harness/account automatic-release end-to-end tests were not started, to avoid interrupting the active session or making paid requests. Resource-release scope, repeated restore, and isolation remain unverified individually for Pi, OMP, Claude Code, CodeBuddy, Cursor, Grok, Hermes, Kiro, OpenCode, Antigravity, and DeepSeek Harness.
- Full tests and Rust build/tests were not run for that work; no Rust code changed.
