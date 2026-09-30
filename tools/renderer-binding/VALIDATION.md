# Codex Renderer Agent binding validation record

## Current conclusion

Supported Codex Desktop builds use a version-locked Renderer Adapter for Composer-level Agent binding:

- Launcher uses `codex-z launch` to start the complete Agent picker. It no longer requires or accepts process-level `--agent`. New Composers default to Codex; the page picker selects other Agents.
- The Renderer Adapter keeps independent Agent state for the target Composer of each new Thread. Submission synchronously locks the final selection.
- For external Harness selection, the Adapter writes an internal transport carrier only in the corresponding new-Thread creation path. Codex selection restores official Model state.
- The Host selects the Harness at the actual `thread/start` boundary from the transport carrier. Immutable Thread ownership routes subsequent Turns.
- Existing external Threads do not write transport carriers back into native Codex Model state. Fixed Host controls change Model, Thinking, and Permission.

Public DOM and preload APIs still have no stable generic Agent-to-create interface. Binding therefore depends on version-locked Composer Model atoms, prewarm cleanup bridges, and main-process title policy. Reject binding if structure mismatches, ownership is unclear, or assets are unsupported.

## Recorded validation status

```text
Production Renderer loads all registered Agents: PASS
Composer Agent selection, switching, and submission lock: PASS
External Agent selection to transport carrier: PASS
Pi thread/start to Pi Native Session: PASS
Subsequent Pi Thread Turns reuse the same Native Session: PASS
Codex / Pi switching in both directions and stale prewarm cleanup: PASS
Pi title requests do not enter the Codex Harness: PASS
Unconsumed Pi prewarm does not start a Pi process: PASS
```

Validation uses sanitized create, Turn, title, and Session observations. It does not require Prompts, full DOM, or full request identifiers.

## Routing relationship

```text
Page selects Agent
-> Save independent Composer state
-> Lock final selection at submission
-> External Agent writes corresponding transport carrier
-> Host decodeCreateRoute
-> selectedHarness
-> Corresponding Harness Native Session
-> Output returns to the same Codex Thread
```

Pi's default transport carrier is:

```text
codex-z/pi-native
```

This is an internal routing token, not a domain Model. It is not user-visible or persisted Codex Model configuration.

## Controlled validation focus

Creation and subsequent Turn validation must satisfy all of these:

```text
Renderer selects Pi
-> Corresponding thread/start carries a verifiable Pi transport carrier
-> Host selectedHarness == pi
-> Create or reuse the correct Pi Native Session
-> Pi output enters the same Codex Thread
```

Also cover these boundaries:

1. Stale prewarm cleanup for Codex -> Pi, Pi -> Codex, and Codex -> Pi -> Codex -> Pi.
2. Only a consumed Pi Thread starts a Pi Native Session.
3. Pi title uses Desktop local fallback without creating an official Codex ephemeral Thread.
4. Composer replacement, existing Thread visits, and ownership changes do not transfer another Composer's Agent or Model state.
5. Structure mismatch, unavailable request bridges, or unclear ownership stop binding without silent Codex fallback.

## Evidence locations

- Renderer Agent state: `packages/renderer-extension/src/agent-selection-state.ts`
- Renderer binding and Model Adapter: `packages/renderer-extension/src/renderer-binding-probe.ts`
- Versioned Renderer Adapter: `packages/renderer-extension/src/versioned-renderer-adapter.ts`
- Host route classification: `packages/host-runtime/src/app-server-host.ts`
- Model routing protocol: `packages/protocol-core/src/model-routing.ts`
- CDP / Inspector control: `packages/desktop-control/src/cdp-client.ts`
- Controlled runner: `tools/renderer-binding/run.mjs`
- Test Host entry: `tools/renderer-binding/observed-host.mjs`

Sanitized local evidence is stored in Git-ignored `.codex-z/renderer-binding/`, including Renderer state reports, Host route classifications, and staged timing reports. These local files are not committable product data.
