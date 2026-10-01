# Repository maintenance automation

PR maintenance has two tasks: **label clear titles automatically and update one short comment after CI ends**. It does not call Models, execute PR code, or rerun CI.

## 1. Automatic labels for clear titles

| Title | Label |
| --- | --- |
| `fix: repair Session restore` | `bug` |
| `feat: add a Harness` | `enhancement` |
| `docs: update installation instructions` | `documentation` |
| `change Session handling` | Skip; do not infer a type |

Conventional Commit `(scope)` and `!` syntax are supported. Type is not inferred from the body, commit list, file paths, or historical discussion. Other prefixes are ignored. Issues, including historical Issues, are not processed.

Only the three type labels with label-event evidence of ownership by this bot are synchronized. Automatic synchronization stops if a person or another tool changes these labels. Existing labels with unknown ownership are not overwritten. Labels are left unchanged if the title becomes unrecognizable. The automation does not delete existing repository labels in bulk or create domain labels.

## 2. Short comment after CI completes

Success example:

> ✅ All CI checks passed for commit abc1234.

Failure example:

> ❌ Windows CI failed. [View logs](https://github.com/rafazafar/codex-z/actions)
>
> ```text
> src/foo.ts(42,5): error TS2322: Type 'string' is not assignable to type 'number'.
> ```
>
> Commit abc1234.

- Read only trusted `.github/workflows/ci.yml` runs for the PR's current HEAD. Wait for the workflow and all jobs to finish. Do not post a new comment when the run is queued, active, or absent.
- Report all checks passed only if the workflow and all jobs succeed, with unique success evidence for each of the four baseline jobs: `Check ubuntu-22.04`, `Check macos-14`, `Check windows-latest`, and `Check Linux ARM64`.
- Report pending approval, cancellation, skips, timeout, and incomplete results separately. They are not success. Do not publish inferred results if the CI API cannot be read.
- Update only one comment owned by `github-actions[bot]` per PR, with support for the previous summary marker. Do not take over human comments that imitate the marker. Do not rewrite an unchanged result. Replace failure with success after recovery.
- Show the short commit SHA and link the full SHA so that a previous result is not mistaken for a new commit while its CI runs. Authors do not have to enter SHAs manually.
- Show at most four failed jobs, with at most five excerpt lines per job and 500 characters per line. Retain the original error text; do not translate it or infer a root cause. Prefer recognizable TypeScript, Rust, test, npm, and similar diagnostics. If failed-step timestamps are available, extract only that interval.
- Remove log timestamps and control characters. Redact credential lines, common Tokens, long strings that resemble credentials, URLs, and user directories. Redaction uses conservative pattern matching and cannot guarantee detection of all unknown secrets. CI itself must not print secrets.
- If logs are unavailable, exceed 8 MiB, time out during download, or contain no recognizable error, show only job status and GitHub log links. Do not copy full logs or temporary signed download URLs.

The automation no longer publishes information-completeness reports, template reminders, review summaries, specification risks, check exceptions, or long-wait reminders. It does not close PRs, convert them to Draft, approve, or merge.

## Triggers and security

Entry point: `.github/workflows/repository-maintenance.yml`. Logic belongs to `packages/repository-automation/`. The trusted workflow loads public `index.mjs` directly, without dependency installation or a build.

- Synchronize when a PR is opened, edited, reopened, receives commits, or has label changes. On CI `workflow_run: completed`, find the target using the current PR HEAD.
- Do not listen for Issues, discussion comments, or CodeRabbit status. Do not run scheduled patrols. Missed events can be rerun manually.
- Manual execution must use the default branch. `number` selects a PR; an empty value processes open PRs. The default `dry_run=true` does not write comments or labels. With a PR number, Actions Summary shows the comment draft.
- Skip closed or locked PRs and PRs labeled `automation:ignore`.
- Use trusted default-branch code, pinned Action SHAs, and minimum permissions. Do not checkout or execute PR HEAD, install PR dependencies, execute log contents, or send credentials to log download sites.
- Do not write if comment or label history cannot be read. Recheck the PR and CI run/attempt before writing; discard stale snapshots. GitHub APIs do not provide a transaction across endpoints. This is not branch protection or a merge lock.
- Local code changes do not re-enable a workflow paused manually in GitHub. Maintainers must explicitly decide to re-enable it or perform bulk writes.

## CI execution scope and release validation

`ci.yml` runs on PRs and provides reusable checks for `Release packages`. Pushes to `main` do not start a separate CI run. The release workflow checks the fixed tagged commit before it builds or publishes packages. The four baseline jobs remain; these workflows do not configure branch protection. Checks run as follows:

| Check | Linux x64 | macOS / Windows / Linux ARM64 |
| --- | --- | --- |
| Formatting, ESLint, package boundaries, full TypeScript typecheck (including tests) | Run | Do not repeat |
| TypeScript build and preinstalled plugin build | Run | Run |
| TypeScript tests | All | All except the Linux-x64-only tests below |
| Rust Clippy, build, and tests | Run | Run |
| Linux npm installation-package smoke | Run for PRs; run in packaging for releases | Same on ARM64; not applicable to macOS / Windows |

These tests run only on Linux x64 and are not repeated on the other three platforms:

- `packages/repository-automation/test/**`: repository governance logic that runs in Linux GitHub Actions.
- `packages/shared-contracts/test/**`: schemas, serialization, and browser bundle boundaries.
- `packages/renderer-extension/test/**`: browser logic, simulated DOM, and explicitly mocked platform data. This is not real Desktop UI validation.
- `tools/gate-claude-code/run.test.mjs`: entry-point tests launch nested Vitest to rerun Gate tests already in the full suite. Other Gate tests still run across platforms.

All other tests retain cross-platform regressions for filesystems, processes, paths, locks, SQLite, plugin loading, and release artifacts. Linux ARM64 installation-package smoke does not replace those tests. TypeScript builds on each platform still check production-code types. Rust formatting runs once in Linux x64 `format:check`; every platform retains full Clippy and Rust tests.

Checks use `CARGO_INCREMENTAL=0` to disable incremental state. Cargo can reuse unchanged dependencies within a job, and the Rust cache restores compiled dependencies between runs. Only release checks save the cache; PRs can read it. `CARGO_PROFILE_DEV_DEBUG=0` and `CARGO_PROFILE_TEST_DEBUG=0` disable Rust dev/test debug symbols. Debug assertions and overflow checks remain enabled, but stack traces contain less source-location information. Local Cargo configuration and release profiles are unchanged. Pinned npm installation and `npm ci` use `--prefer-offline` to prefer cached data and still fetch missing data. Lockfile constraints and dependency audit remain enabled.

New commits cancel old CI for the same PR. Release checks use a separate concurrency group and do not cancel a release in progress. Tests are not retried and timeouts are not relaxed globally. TypeScript tests require a TypeScript build; Rust tests require compilation. Release binaries and installers still require separate packaging builds. Linux package smoke tests run once during release packaging instead of also running in the release check jobs.

Local `npm run check` and `npm run check:rust` remain unchanged and are not affected by the reduced CI scope. Reproduce the CI TypeScript scope with:

```bash
# Linux x64: build and run all tests
npm run test:typescript
# Other platforms: build and exclude tests that run only on Linux x64
npm run test:typescript -- \
  --exclude 'packages/repository-automation/test/**' \
  --exclude 'packages/shared-contracts/test/**' \
  --exclude 'packages/renderer-extension/test/**' \
  --exclude 'tools/gate-claude-code/run.test.mjs'
```

The workflow separates formatting, Lint, typecheck, TypeScript, and Rust into steps to make bottlenecks visible. Use actual Actions run results to measure duration after scope changes.

Release validation in `release-packages.yml` remains separate from PR comments:

1. The tag must be a valid SemVer annotated tag with Release Notes in its body. Its commit must be in `main` history.
2. Root versions in `package.json` and `package-lock.json`, plus the Cargo workspace version, must match the tag.
3. Call the reusable checks with the resolved release commit SHA. All four baseline jobs must succeed in the release run before packaging starts. No previous PR or `main push` CI run is required.
4. Build and publish the fixed commit SHA. Job dependencies require successful release checks and package builds. Before npm and GitHub publication, revalidate the remote annotated tag object SHA and commit membership in `main`. Release evidence records the source metadata and release run ID/attempt.
5. Stop publication if validation fails. Do not change versions automatically or relax conditions. Maintainers must investigate and prepare the release again manually.

macOS release builds support Apple Silicon (`arm64`) only. The release workflow does not build or publish macOS x64 installers or npm packages.

### npm authentication for the fork

Before the first npm release, obtain publish access to the `@codex-z` scope. The workflow publishes `@codex-z/cli` and five platform packages: `cli-darwin-arm64`, `cli-win32-x64`, `cli-win32-arm64`, `cli-linux-x64`, and `cli-linux-arm64`, all under that scope.

For initial publication before package-level trusted publishers exist, create a short-lived granular npm token with read/write publish permission for the scope and Bypass 2FA enabled for unattended publication. Store it as the `NPM_TOKEN` Actions secret in `rafazafar/codex-z`. See [npm access-token configuration](https://docs.npmjs.com/creating-and-viewing-access-tokens/).

The workflow passes this optional secret as `NODE_AUTH_TOKEN` only to the npm publish step. Dependency installation, builds, and release validation do not receive it. `id-token: write` and provenance remain enabled; npm tries OIDC before token authentication. An absent secret does not require token setup when trusted publishing is configured.

After the packages exist, configure a GitHub Actions trusted publisher in **each package's** npm settings:

| Field | Value |
| --- | --- |
| Organization or user | `rafazafar` |
| Repository | `codex-z` |
| Workflow filename | `release-packages.yml` |
| Environment name | Leave empty; this workflow does not use a GitHub environment |
| Allowed actions | Permit direct `npm publish` |

Enter only the workflow filename. The workflow uses GitHub-hosted runners and npm `11.8.0`, which supports trusted publishing. After a successful OIDC release, remove the repository's `NPM_TOKEN` secret and revoke the token. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). Authentication does not bypass the tag, version, release checks for the fixed commit, or pre-publication checks above.

If npm publication is blocked, run `Release packages` manually from the default branch, specify the original annotated tag, and enable `skip_npm`. This mode skips npm publication but builds installation packages from the tag's fixed commit. It retains version and tag validation, runs the shared checks for the fixed commit, and publishes only the GitHub Release after they pass. Tags do not need to move or be recreated. Default publication still requires npm publication to succeed.

Tag pushes use the workflow definition in the tagged commit. New validation does not rewrite release logic for old tags. This is not an unbypassable permission control; branch, tag, and release-environment protection are not configured.

## Validation

```bash
npm run test --workspace=@codex-z/repository-automation
```

Focused tests cover title and label ownership, CI completeness, waiting/failure/recovery, log extraction and redaction, pagination, read-only previews, stale snapshots, and release validation. Real Actions write tests require deployment to a trusted branch and explicit enablement.
