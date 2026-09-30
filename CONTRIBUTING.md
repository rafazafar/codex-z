# Contribute to codex-z

Report problems that you encountered. Small, complete fixes are welcome. Discuss large new capabilities first to prevent duplicate implementations and unnecessary maintenance costs.

## Issue

Use the Bug, Feature, or Question form when you create an Issue. A blank Issue is also available. Select the main affected area. If you cannot determine the area, select `Other / Unknown`. Keep Harness, Model, Provider, and Account distinct.

Where possible, include these details in a bug report:

- codex-z version, installation method, and the full Codex Desktop version / build;
- OS / architecture, Harness name and native CLI version, and local / SSH / Remote Control connection;
- Expected behavior, actual behavior, minimum reproduction steps, or observed conditions for an intermittent problem;
- Relevant errors, logs, or screenshots with sensitive data removed.

State when information is unknown, not applicable, or cannot be reproduced. These suggestions help communication. Automation does not check historical reports or request missing details. Do not upload Tokens, Cookies, authentication files, full account directories, or private project content without removing sensitive data. Do not publicly disclose attack details for security vulnerabilities that have not been fixed.

## Pull Request

- Use `main` as the target branch. Recommended title formats include `fix(scope): ...`, `feat(scope): ...`, and `docs: ...`.
- Describe the purpose, linked Issue (`N/A` if none), scope, and validation that you actually ran. Do not write only 'tests passed'.
- Follow [AGENTS.md](AGENTS.md) and the [terminology](docs/project/terminology.md). Preserve native Harness semantics and the Rust / TypeScript ownership and package boundaries.
- Select focused tests for the risk. Validate behavior changes. Low-risk documentation and comment changes do not require new tests by default.
- For Desktop, Renderer, or real Harness changes, record automated tests and real-system results separately. State the version, platform, and unverified areas. Include screenshots with sensitive data removed for UI changes where possible.
- The author must understand the change, respond to feedback, add validation, and maintain the branch. Maintainers do not automatically take ownership of the full fix.

## Automated notices and human decisions

`Repository maintenance` performs only two actions:

- For clear `fix:` / `feat:` / `docs:` PR titles, add `bug` / `enhancement` / `documentation`. Skip ambiguous titles and preserve manual selections.
- After CI for the current commit completes, update one short result comment. For failures, include identifiable original errors with sensitive data removed. Do not add comments while CI is queued or running. Approval waiting, cancellation, and skipped jobs do not mean all checks passed.

It does not process Issues, request template completion or a manually entered validation SHA, repeat AI review summaries, or automatically close, approve, merge, or change Draft status. Use `automation:ignore` to disable processing for a PR.

Existing CI and pre-release checks remain in effect. See [repository maintenance automation](docs/operations/repository-maintenance.md) for details.
