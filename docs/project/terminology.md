# codex-z

`codex-z` runs multiple Agent Harnesses as independent sessions in the Codex Desktop shell. This glossary keeps UI, Harness, Model, and account routing concepts distinct.

## Language

**codex-z**:
An independent third-party product that lets non-Codex Harnesses run as sessions in the Codex Desktop shell.
_Avoid_: codex-z、codex-z、Codex++

**Codex Desktop**:
The official desktop shell that users see and operate, including projects, sessions, input fields, and interaction rendering.
_Avoid_: Harness kernel, Codex Core

**Agent**:
The name for a Harness in the user interface.
_Avoid_: Model、Provider

**Harness**:
The execution system that owns the Agent Loop, context organization, tools, permission interactions, and native session state. Examples include official Codex, Claude Code, and Pi.
_Avoid_: Model、Model Provider、Runtime Core

**Model**:
The model that a Harness calls for reasoning and generation, such as GPT, Claude, Gemini, or a local model.
_Avoid_: Harness、Agent

**Provider**:
The backend that handles model requests and supplies an Endpoint, Wire Protocol, and service capabilities. A Provider can restrict authentication and billing methods. It is distinct from the current account and actual usage-limit source.
_Avoid_: Harness、Model、Account

**Account / Authentication**:
The user identity and authentication method used to access a Provider or Harness, such as Codex OAuth, Anthropic OAuth, or an API Key. An account states whose credentials are used. It is distinct from the request backend and final billing source.
_Avoid_: Provider, actual usage-limit source

**Thread**:
A user session owned by exactly one Harness. The Harness stays fixed within a Thread, but the Model can change between Turns.
_Avoid_: cross-Agent pipeline, shared native Session

**Turn**:
One Harness execution in a Thread, triggered by one user input and ended by completion, failure, or cancellation.
_Avoid_: Thread, single Message

**Fork**:
Create a new independent Thread from the current end or a historical position of an existing Thread. Fork copies session context only. The new Thread must inherit the source Harness and use the current files in the same project. Harness capabilities and the product fidelity contract determine which Native Session context states are copied.
_Avoid_: Agent switching, cross-Harness migration, in-place source Thread rewrite, file rollback, file snapshot, automatic Worktree

**Native Session**:
Native session and execution state maintained by the selected Harness.
_Avoid_: Codex Thread

**Native Turn Ref**:
A stable, opaque native Turn identity supplied by a Harness Adapter. It identifies the same logical Turn during live execution and repeated Native Session history reads. It does not mean that the Turn supports Fork, and contains no message body.
_Avoid_: Host Turn ID、Native Checkpoint、Turn Anchor

**Native Checkpoint**:
A session-history position that a Harness identifies as available for Fork, such as a Claude Code Assistant Message UUID or Pi Session Entry ID. It is not a Turn identity, file snapshot, or separate Transcript.
_Avoid_: Native Turn Ref, Native Session, Codex Turn, file Checkpoint

**Turn Anchor**:
Location metadata saved by codex-z as `Host Turn ID → Native Checkpoint ID` for precise session operations such as Fork. It contains no message body and does not create a second source of session truth.
_Avoid_: Transcript projection, Native Session

**Adapter**:
The integration layer for one Harness. It starts or resumes Native Sessions and converts the Harness structured input, events, and interactions into stable internal `codex-z` semantics.
_Avoid_: Protocol Facade、Model Provider

**Host Interaction**:
A two-way interaction that requires a user response to continue, such as approval or an Agent question. It includes the correlation identifiers needed between Codex UI and native Harness callbacks.
_Avoid_: one-way event, ordinary message

**Permission Mode**:
The session permission baseline defined by the current Harness. It determines whether tool calls are allowed automatically, require a question, or are denied. Harnesses have different modes and semantics. Codex UI permission levels do not directly represent native Claude Code/Pi modes.
_Avoid_: single Approval Request, Sandbox

**Approval Request**:
A runtime interaction requested by a Harness before a tool call executes. The user must allow or deny it. codex-z can convert it into a Host Interaction supported by Codex UI. This does not give codex-z ownership of the native permission policy.
_Avoid_: Permission Mode、Sandbox
