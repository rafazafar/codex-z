# Codex Desktop update compatibility diagnosis playbook

This document gives the diagnosis procedure when codex-z features fail after a Codex Desktop update. It aims to answer two questions quickly:

1. Did the Renderer injection entry point fail, or did injection succeed before a later operation failed?
2. Which request, state transition, or private Codex API causes the `Agent` / `Model` failure seen by the user?

The procedure comes from the Codex Desktop `26.814.41407` incident. Reuse it first for later Codex updates.

Related compatibility-debt records:

- `docs/archive/codex-desktop-incidents/26.814-compatibility-debt.md`
- `docs/archive/codex-desktop-incidents/26.908-request-manager-wrapper.md` (connection checks all failed after a Fiber hook wrapped Request Manager in `{ hostId, manager, status }`)

## 1. Establish a layered model

Injection failure, Harness unavailability, and Agent-switch failure are separate problems. Distinguish at least these layers:

```text
Codex Desktop startup
    -> Main-process title policy
    -> Renderer bundle injection
    -> Draft prewarm / Request Bridge injection
    -> Renderer Adapter ready
    -> Agent menu state
    -> Agent switch action
    -> prewarm cleanup
    -> Model / Harness inspection
    -> Model menu rendering
```

Each layer has a different success signal:

| Layer | Success signal | What it does not prove |
| --- | --- | --- |
| Title policy | Title-service structural checks and Renderer readiness both succeed | Renderer injection succeeded |
| Renderer bundle | `window.__codexZRendererBindingProbeV1` exists | Request Bridge is available |
| Draft routing | Adapter is `ready / request-bridge` | Full Agent click flow works |
| Harness availability | inspection returns `status: ready` | Agent-switch cleanup succeeds |
| Agent switch | The probe's selection agent changes | Model catalog loaded |
| Model catalog | Model button shows a real Model name and is enabled | Turn submission routes to the correct Model |

**Adapter `ready` is not the final acceptance criterion.** In this incident the Adapter was already `ready`, but the old prewarm cleanup RPC still interrupted Agent clicks.

## 2. Record installed versions and launch method

Record the actual Codex Desktop and Codex Framework versions, not only the project version:

```bash
ps -axo pid,ppid,command | rg -i 'ChatGPT.app|--inspect='
```

Also confirm that the launch uses artifacts from the current workspace:

```bash
ps -axo pid,ppid,command | rg -i 'codex-z launch|host-runtime|desktop-controller|renderer'
```

Check:

- Codex Desktop version
- Codex Framework version
- Whether the Renderer bundle path points to the current workspace
- Whether Host Runtime and Desktop Controller come from the current workspace
- Whether `npm start` rebuilt the artifacts

Do not assume a fixed Inspector port. `npm start` assigns a new temporary Inspector port on every launch.

Extract the port dynamically from the running process:

```js
const { execFileSync } = require("node:child_process");
const processes = execFileSync("ps", ["-axo", "command="], { encoding: "utf8" });
const match = processes.match(
  /ChatGPT\.app\/Contents\/MacOS\/ChatGPT --inspect=127\.0\.0\.1:(\d+)/,
);
const inspectorEndpoint = `http://127.0.0.1:${match[1]}`;
```

## 3. Establish a minimal real feedback loop

First establish a loop that reproduces the user's exact symptom. Unit tests or Adapter status alone are insufficient.

The most useful loop in this incident was:

```text
Run npm start
    -> Find the app://-/index.html main window
    -> Read Renderer binding status
    -> Click an external Agent
    -> Read selection
    -> Read Model button text, aria-label, title, and disabled
```

Acceptance must check at least:

- Whether Agent selection changes
- Whether the Model button still says `Models unavailable`
- Whether the Model button is disabled
- Whether `title` contains the actual error text
- Whether the Adapter makes an abnormal state transition before or after the action

The actual root cause in this incident appeared directly in the Model button's `title`:

```text
Invalid request: unknown variant `clear-prewarmed-threads-for-host`
```

This is more useful than `availability: error` alone.

### Recommended DOM evidence

Read buttons related to Agent and Model:

```js
[...document.querySelectorAll("button")]
  .map((button) => ({
    text: (button.innerText || "").trim(),
    aria: button.getAttribute("aria-label"),
    title: button.getAttribute("title"),
    checked: button.getAttribute("aria-checked"),
    disabled: button.disabled,
  }))
  .filter((item) => /agent|model|pi|claude|deepseek|grok/i.test(
    [item.text, item.aria, item.title].join(" "),
  ));
```

## 4. Confirm that injection succeeded

### 1. Find the main Renderer

Electron can have multiple `webContents` at once. Windows such as `avatar-overlay` do not necessarily have a Composer and must not be used as the main Renderer validation target.

Read in Node Inspector:

```js
webContents.getAllWebContents().map((contents) => ({
  id: contents.id,
  type: contents.getType(),
  url: contents.getURL(),
  title: contents.getTitle(),
}));
```

Prefer:

```text
type === "window"
url === "app://-/index.html"
```

### 2. Read the codex-z binding

```js
window.__codexZRendererBindingProbeV1?.status?.()
```

Record:

```json
{
  "availability": {
    "pi": "ready",
    "claude-code": "ready"
  },
  "selections": [
    {
      "agent": "pi",
      "phase": "draft"
    }
  ],
  "adapter": {
    "state": "ready",
    "reason": "ready",
    "hook": "request-bridge"
  }
}
```

Decision rules:

- Binding absent: first check Renderer bundle execution failure, title-policy blocking, or injection timing.
- Adapter not `ready`: first check Request Bridge and draft routing.
- Adapter already `ready`: injection has progressed; continue to validate the Agent click path.

## 5. Inspect current Composer Fiber and Request Bridge

After a Codex update, do not assume old function names and closure variables still exist. Read actual objects from the current Composer React Fiber.

Record:

- Whether Composer exists
- Whether React Fiber exists
- The count and identity of request objects in Fiber
- The relation between outer manager and inner request client
- `hostId`
- `sendRequest`
- `prewarmThreadStart`
- `enqueueRequest`
- `prewarmedThreadManager`
- Whether codex-z policy exists

The actual current Codex structure is:

```text
outer manager
  - requestClient -> inner bridge
  - hostId: "local"
  - prewarmedThreadManager
  - sendRequest: delegate function

inner bridge
  - hostId: "local"
  - sendRequest
  - prewarmThreadStart
  - enqueueRequest: prototype method
```

From Codex Desktop `26.908.40834`, the outer manager above is not necessarily `hook.memoizedState`. The observed wrapper is:

```text
hook.memoizedState = { hostId, manager: outer manager, status }
```

Lookup must first check hook state against the existing API shape, then check `.manager`. The wrapper itself is not Request Manager. Zero matches do not by themselves mean that Desktop removed the bridge.

In the same version, Composer draft identity can change from a seven-slot atom to repeated `client-new-thread:` strings in a longer memo tuple. A lookup that recognizes only the old seven-slot form can allow Agent selection while Model/permission controls remain unavailable. See `docs/archive/codex-desktop-incidents/26.908-request-manager-wrapper.md`.

Two constraints:

1. `enqueueRequest` can be on the prototype and absent from `Object.keys()`.
2. Policy replacement of `sendRequest` changes its function source. Function source must not be the only identity test.

### Identification strategy

Prefer stable API shapes:

```text
hostId === "local"
has sendRequest
has prewarmThreadStart
has enqueueRequest
```

The current implementation no longer supports old `Function.prototype.toString()` signatures. Fail closed if the API shape does not match; do not fall back to function-source or closure scanning.

## 6. Validate each step in the click path

After clicking an external Agent, check these steps in order, in addition to the final UI:

```text
1. The Agent menu item exists and is enabled
2. selection agent changes after the click
3. draft prewarm policy.clear() succeeds
4. policy.select(model) succeeds
5. Harness inspection RPC is sent
6. inspection returns ready
7. Model catalog is written to the DOM
```

### Check cleanup first

Agent switches normally clean up the old prewarm Thread first. In the current version, check:

```text
prewarmedThreadManager.discardAllPrewarmedThreads()
```

These errors indicate that the old path is still used:

```text
unknown variant `clear-prewarmed-threads-for-host`
```

Repair the failed switch request before adding availability retries.

### Check real Harness inspection

If the UI shows `Models unavailable`, distinguish two cases:

#### Case A: Harness unavailable

Send directly through the real Renderer's Request Bridge:

```text
codex-z/harness/inspect
```

Test each of:

```text
pi
claude-code
deepseek-harness
grok
```

If RPC returns `status: ready`, the Harness, Account, and network are not the root cause.

#### Case B: Request Bridge lookup fails

If a direct call through the real bridge succeeds but Renderer Model client fails, check:

- Whether `findActivePrewarmTargets()` returns zero objects
- Whether policy changes to function source changed the lookup result
- Whether Model client finds the target again on every call
- Whether the injected object is still the same object in current Fiber

### Check Codex usage Gates

If Codex allowance is exhausted for a ChatGPT login, the external Agent's Send button remains disabled, and the Agent hover text says that the Harness cannot be separated from Codex usage limits, then `renderer-codex-usage-gate.ts` did not bind successfully. API Key login does not trigger this Gate and cannot reproduce it.

Perform these read-only checks in the main Renderer. Do not modify getSnapshot or subscribe to the store:

```text
1. Walk upward from the editor to the unique component with onLocalSubmitStart and boolean submitDisabled
2. Find the three-part hook chain: useMemo([store, atom]) → useSyncExternalStore inst → subscription effect
3. For each boolean candidate, replay atom.read with a tracing proxy:
   - Reads hardBlocked but not active: reserve Gate; exactly one must exist
   - Reads authMethod and rate_limit.allowed: Account Gate; exactly one must exist when allowance is exhausted
```

If any count differs, update identification for the new Desktop structure. Do not bypass the Gate by hook index, minified name, or Account-data mutation. Remove this module if Desktop exempts external Harnesses by Thread, Model, or host, or stops blocking them in the Renderer.

## 7. Common incorrect conclusions

### Error 1: Adapter ready proves the entire repair

Adapter ready proves only that routing policy is installed. Prewarm cleanup, Model inspection, and DOM rendering can still fail during Agent switches.

### Error 2: availability error proves a Harness command or Account problem

The availability state can hide the actual exception. Read the real RPC error or Model button `title`.

### Error 3: Four Harnesses fail together because of the network

If all Harnesses fail together, check the shared path first:

- Request Bridge cannot be found
- Host Runtime RPC is unavailable
- Adapter is switching
- Renderer Model client uses obsolete object-identification logic

Do not start by checking four CLIs separately.

### Error 4: Fixed Inspector port

`npm start` uses temporary ports. Discover the port again after each restart.

### Error 5: Unit tests alone are sufficient

Old mocks can still accept RPCs that Codex removed. Add a Renderer smoke test against the real version, with at least one complete Agent click path.

### Error 6: Add each new string directly to the allowlist

When title-service identity changes, first confirm:

- Service structure still meets expectations
- Ownership checks are still correct
- Title isolation still applies only to codex-z's own Renderer

Add it to the reviewed list only after the structure is confirmed.

## 8. Repair principles

### 1. Prefer stable API shapes to function source

Function names, minified variable names, function source, and closure variables are private implementation details with high change risk. The current Request Bridge recognizes only reviewed API shapes and fails closed if the shape does not match.

### 2. Define removal conditions for every fallback

Old code must not remain indefinitely. Record at least:

- The Codex version it serves
- Whether the current version can still enter it
- The minimum supported version required for removal
- The corresponding test file

### 3. Validate shared paths first

When multiple Agents fail together, test the shared Request Bridge and Host RPC before individual Harnesses.

### 4. Validate the user's action sequence

Final regression must reproduce actual user actions, in addition to internal-state checks:

```text
Click Agent
-> Wait for the switch
-> Read selection
-> Open Model menu
-> Read Model catalog
```

## 9. Recommended post-repair acceptance checklist

After a Codex update compatibility repair, complete at least these checks:

- [ ] Record Codex Desktop and Framework versions
- [ ] Discover the current Inspector port dynamically
- [ ] Select the correct `app://-/index.html` main Renderer
- [ ] Title policy has no unexplained warnings
- [ ] binding probe exists
- [ ] Adapter is `ready / request-bridge`
- [ ] Fiber has exactly one active request target
- [ ] Active request target can still be found after policy wrapping
- [ ] Current-version prewarm cleanup API is available
- [ ] Model catalog loads after clicking Pi
- [ ] Model catalog loads after clicking Claude Code
- [ ] Model catalog loads after clicking DeepSeek Harness
- [ ] Model catalog loads after clicking Grok
- [ ] Native Composer still works after switching back to Codex
- [ ] With a ChatGPT Account's Codex allowance exhausted, new and existing external Threads can send; after switching back to Codex the Send button is disabled again
- [ ] Switch validation covers new and unlocked Threads
- [ ] Locked Threads remain locked as designed
- [ ] Actual errors are not only converted to generic `Models unavailable`
- [ ] Focused tests, TypeScript, Prettier, and `git diff --check` pass

## 10. Shortest diagnosis path for this incident

If the problem recurs, use this sequence:

```text
1. npm start
2. Read the dynamically assigned Inspector port
3. Read binding status in app://-/index.html
4. Click an external Agent
5. Read Model button title
6. If unknown variant appears, check the prewarm cleanup API
7. If there is no specific error, check the findActivePrewarmTargets count
8. Call codex-z/harness/inspect directly to distinguish Harness failure from shared Bridge failure
9. After repair, click the Agent again and verify the actual Model text
```

The key failure in this incident was not:

```text
Harness unavailable
```

It was:

```text
Before Agent switching, the code still called an old prewarm cleanup RPC that current Codex had removed
```
