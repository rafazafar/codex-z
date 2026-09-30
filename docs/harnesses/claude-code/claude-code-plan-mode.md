# Claude Code plan mode and plan confirmation

Claude Code SDK supports native `permissionMode: "plan"` and live `setPermissionMode("plan")`. codex-z uses these interfaces directly. It does not simulate permission modes with prompts.

## Visible behavior

Plan mode explores, prepares a plan, then requests confirmation to execute. It does not disable all tools. Claude can read, search, and write plan files. Claude Code continues to enforce tool permissions.

When Claude calls `ExitPlanMode`, codex-z shows a separate **Review plan** choice confirmation instead of the normal tool 'allow once' approval:

- Show the complete plan supplied by the SDK callback. Do not apply the 500-character description limit used for normal tool approval.
- **Stay in plan mode** is the first option and denies this request to leave plan mode.
- **Approve plan and exit plan mode** explicitly approves the plan and permits the native exit operation. Claude Code then restores the permission mode from before plan mode and can continue execution.
- Cancelling the confirmation denies exit. Arbitrary text, undeclared options, multiple selections, and missing answers cannot approve exit.
- If the SDK supplies no nonempty plan, offer only 'Stay in plan mode'. codex-z does not read a file path from tool arguments or approve a plan it cannot show.

Normal `Write`, `Edit`, and `Bash` approvals retain allow-once, deny, and session or persistent authorization options explicitly supplied by the SDK. Plan-exit confirmation offers no session or permanent authorization and does not apply bulk permission updates from SDK suggestions.

## Ownership and projection

- `packages/adapters/claude-code/src/sdk-transport.ts` identifies native `ExitPlanMode` and preserves the association between plan content and native callback. Approval returns `allow`; staying in plan mode or cancelling returns `deny`.
- `packages/adapters/claude-code/src/plan-review.ts` converts plan approval into a closed Host Question and validates the answer before converting it to a native permission decision. It is not Claude's `AskUserQuestion` tool call and does not write choices into native tool `answers` arguments.
- The normal Codex Desktop MCP approval panel always shows 'allow once'. The existing `item/tool/requestUserInput` choice interaction therefore expresses the explicit exit decision, without changes to `HostApprovalAction.label` or private DOM.
- SDK native state notifications remain authoritative for mode changes. The Adapter does not call `setPermissionMode` on approval, denial, or cancellation, and does not force plan mode after Claude exits it.

Confirmation text is in English, consistent with other fixed Adapter interaction text. The permission-mode menu supplies localized descriptions.

## Validation

Focused regression coverage includes SDK callback classification, full plan preservation, no approval without a plan, approve/stay/cancel responses, invalid and duplicate responses, and unchanged normal tool approval:

```sh
npx vitest run --config tests/vitest.config.js \
  packages/adapters/claude-code/test/sdk-transport.test.ts \
  packages/adapters/claude-code/test/claude-code-adapter.test.ts \
  packages/renderer-extension/test/renderer-permission-mode-picker.test.ts
```
