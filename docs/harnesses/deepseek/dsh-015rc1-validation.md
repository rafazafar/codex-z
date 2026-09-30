# DSH 012rc1 / 015rc1 / 015rc2 / 015rc3 / 017rc1 / 017rc2 integration validation

## 0.1.7-rc.2 support and validation limits

The tag commit for DSH dsh-v0.1.7-rc.2 is 477b4f420553e8a52c2fbccc464d7561b239c443. This source release still uses Session Format V4. The Adapter routes 0.1.7-rc.2 and later SemVer versions to the existing V4 profile. Modern versions below 0.1.7-rc.1 continue to use V3; the 0.1.2 series uses V0.

The source protocol audit and automated routing regressions are complete. rc2 is in Settings and the validated-version list. The real CLI lifecycle Gate has not run. Current evidence consists of the rc2 source protocol audit, V4 routing regressions, and automated repository checks. The version number only selects the protocol to try; Web Remote, history, streaming, and Fork checks remain the compatibility Gates.
## Version-extension validation (support-dsh-015rc3-017rc1)

This change added two isolated releases: `dsh-v0.1.5-rc.3` (`a4c74a91e06b00fe0b0937bde982170c526cc842`) and `dsh-v0.1.7-rc.1` (`46a7f68b0922371ce7144b668b90e377d8e799f4`). The first retains V3 Session logs and existing V3 Remote semantics. The second uses V4 Session logs. A separate Adapter profile validates V4 headers, `developer/message`, surface references, image offload, workspace changes, Assistant stream blocks, and the Fork `forked` synthetic closer.

Real CLI lifecycle Gates passed for both `0.1.5-rc.3` and `0.1.7-rc.1`. They cover managed Web startup, inspect/create, stream deltas, cancellation and HTTP stop, rollback to empty or retained history, cold restore, continued input, close while active, and requests without overlap. Both use an exact-version npm-isolated `dsh.cmd`. A successful `--version` call was not treated as integration evidence.

The real Gate environment was Windows, Node.js `v24.11.0`, npm `11.8.0`, and Vitest `4.1.10`. Use this command template, replacing `<TEMP>\rc3` or `<TEMP>\rc1` with the isolated directory for the exact version:

```powershell
$env:CODEX_Z_DSH_REAL_COMMAND = '<TEMP>\rc1\node_modules\.bin\dsh.cmd'
.\node_modules\.bin\vitest.cmd run --config tests/vitest.config.js tools/gate-dsh/lifecycle.real.test.mjs --reporter=verbose
```

Final rerun results: `dsh-v0.1.5-rc.3` passed 1/1 (Vitest 11.49 seconds); `dsh-v0.1.7-rc.1` passed 1/1 (Vitest 8.20 seconds). Both Gates use a local SSE mock Model and an isolated temporary `DSH_HOME`; they do not call a Model that bills real usage. The real Gate does not cover native V4 Fork or tool calls from a real Model. Focused regressions below check those protocol boundaries.

The V4 `session/follow` Web snapshot omits `delegationDepth` for top-level Sessions. The Adapter normalizes a missing value to `0`, as required by the actual DSH Web contract. An explicit value must still be a nonnegative safe integer.

In this run, `npm run test:deepseek:coverage` passed **all 849 tests in 23 files** for the full DSH Adapter. The scope remains `packages/adapters/deepseek-harness/src/**/*.ts`; all four 80% thresholds passed. New coverage includes V0/V3/V4 visible Thinking deltas, final revisions, abandoned attempts, step completion, and reconnect deduplication. Focused Protocol Core tests cover full `pwsh` command projection.

| Metric | Coverage | Covered / Total |
| --- | --- | --- |
| Statements | 86.44% | 5792 / 6700 |
| Branches | 82.17% | 5099 / 6205 |
| Functions | 93.23% | 923 / 990 |
| Lines | 89.14% | 5380 / 6035 |

Focused protocol/profile regressions cover valid and invalid V3/V4 history, developer tool references, Assistant streams, Fork boundaries, native `forked-tool-result` validation and projection, checkpoints across formats, control readback, pagination, and live deduplication. Protocol Core `pwsh` command-box tests ran separately. DSH Thinking stream tests also use `CodexTurnProjector` to validate delta notifications. V4 checkpoints use the `v4-turn-end:` prefix and an exact-version locator. V3/V0 or pre-migration checkpoints are rejected before mutation. DSH owns its native Sessions, credentials, and migrations; codex-z does not read or rewrite native log files.

In this run, `npm run build:typescript`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `git diff --check` all passed. No Model that bills real usage, Desktop, or browser automation was used. Real Gates for these added versions did not run on other platforms.

The implementation baseline is upstream `9d36363f`, validated on Windows with Node.js `v24.11.0`, npm `11.8.0`, and Vitest `4.1.10`. The original baseline in this section supports only exact versions `0.1.2-rc.1` and `0.1.5-rc.1`. The old DSH Legacy implementation, SDK, and dedicated tests were removed.

## Automated tests and coverage

`npm run test:deepseek:coverage` passed **all 820 tests in 22 files** for the full DSH Adapter. The scope is `packages/adapters/deepseek-harness/src/**/*.ts`, including unexecuted files. The statistics were not narrowed to new code; all four thresholds are 80%.

| Metric | Coverage | Covered / Total |
| --- | --- | --- |
| Statements | 86.52% | 5537 / 6399 |
| Branches | 81.95% | 4746 / 5791 |
| Functions | 92.98% | 888 / 955 |
| Lines | 89.01% | 5139 / 5773 |

The same command generates HTML and JSON summaries in `coverage/deepseek-harness/`, which is not tracked in Git. Function coverage above 90% is retained; valid tests are not deleted to reduce the number.

The original baseline above covers exact-version rejection (now replaced with SemVer probing and protocol validation; see the connection-version policy below), endpoint authentication diagnostics, concurrent selection/close, V0/V3 format isolation, system surfaces and replacement, PTC/feedback/team events, Assistant streams and settlement retries, reconnect, Fork/rollback, inherited queue cleanup, native persistence confirmation, and Model, permission, tool, Usage, and error boundaries. Actual Host output is also replayed through `CodexTurnProjector` to confirm visible cancellation-attempt markers and append/completion consistency.

Additional focused checks:

- Host imports, shared contracts, plugin loading, and packaging: 72 tests in 7 files passed.
- Session/Adapter and Protocol Core projection plus Renderer Settings/localization/binding regressions: 248 tests in 7 files passed. Adapter tests overlap the table above and are not added again to a combined total.
- `npm run build:typescript`, `npm run typecheck`, and `npm run lint` (including package boundaries) passed.
- Prettier for changed files and `git diff --check` passed.

## Real CLI lifecycle

`tools/gate-dsh/lifecycle.real.test.mjs` ran with `CODEX_Z_DSH_REAL_COMMAND` set to each exact version. 012 used the locally installed CLI. 015 was installed in isolation with `npm install --prefix .cache/dsh-015rc1 @deepseek-ai/dsh@0.1.5-rc.1 --no-audit --no-fund`; `--version` was checked first.

```powershell
$env:CODEX_Z_DSH_REAL_COMMAND = '<absolute path to dsh.cmd for the exact version>'
npx vitest run --config tests/vitest.config.js tools/gate-dsh/lifecycle.real.test.mjs
```

Both versions **passed their single real lifecycle Gate**. The Gate starts real DSH Web/Remote, a temporary `DSH_HOME`, and a local SSE mock Model. It uses its own probe endpoint and covers:

- Incremental text before the final message, native cancellation, and HTTP stream stop.
- Single-Turn rollback to an empty Session and multi-Turn rollback with a retained prefix; default Model/Thinking/permission remain unchanged.
- Cold restore after close and continued input; source Session history is unchanged and requests do not overlap.
- Closing an active Session must confirm the native terminal state.

The real 015 Gate found and validated two required fixes: inherited native Fork tasks must be cancelled through the native queue API; native 200 ms batched writes must be confirmed through the export HEAD flush barrier to prevent replay of rolled-back input after Windows terminates the process. Fixed delays were not used to hide persistence failures.

## Protocol source evidence

The reference is DSH tag `dsh-v0.1.5-rc.1` (`183f08e9c6dde7e36cd2318eaee70b0da08fb35e`), compared with `dsh-v0.1.2-rc.1`. Fixture `packages/adapters/deepseek-harness/test/fixtures/dsh-015rc1-empty-response-retry.v3.jsonl` was taken unchanged from that tag's `snapshots/session/empty-response-retry-current/session.v3.jsonl`. DSH recorded and sanitized it. It includes system messages, request headers, empty-response retries, separate Assistant attempts, and the final message.

Native snapshots omit event `seq`/`time` and replace machine-specific data with `{{...}}`. Regression tests only restore consecutive sequence numbers and fixed timestamps, and replace `{{tools}}` with a minimal valid tool declaration. They retain original event names, fields, order, system-message sources, and compressed Assistant streams. This fixture validates protocol parsing; it is not evidence for a real Model or Desktop.

- `core/session/src/types.ts`, `api/session-controller/src/types.ts`: V3 logs, system messages, and Assistant streams.
- `interaction/commands/src/index.ts`: 015 `submittedAttachments` argument.
- `api/session-controller/src/commands.ts`: native Fork prefixes and the different semantics of queue remove and cancel.
- `core/agent-loop/src/inbox.ts`: native persistent Inbox projection.
- `session/session-persistence-jsonl/src/storage.ts`: batched writes and flush.
- `session-query/session-log-export/src/index.ts`, `archive.ts`: wait for native flush before the authenticated HEAD response.

No browser automation, computer use, or Model that bills real usage was used. The user's Desktop was not started. Reference DSH source and user Sessions were not modified. Unaffected full Rust tests did not run. This validation does not cover all combinations of Model Providers, third-party clients, and operating systems.

## 0.1.5-rc.2 adaptation and validation limits

`0.1.5-rc.2` reuses the V3 profile. The Fork checkpoint `dshVersion` locator still requires an exact version match. V3 Session Refs can try restoration across CLI versions. Compared with rc.1 (`183f08e9`), upstream open-source tag [`dsh-v0.1.5-rc.2`](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.5-rc.2) (`fb2c4b9e`) has no changes to the Web, Session, Agent, command, or log protocols. Production-source changes outside version metadata only affect feedback-type comments. The V3 parser therefore has no new branches; future-version compatibility is not promised.

The local global `@deepseek-ai/dsh@0.1.5-rc.2` declares dependencies as `^0.1.5-rc.2`; npm installed some `0.1.5-rc.3` subpackages. A real CLI Gate with an isolated temporary `DSH_HOME` and local mock Model failed during Web startup because `@deepseek-ai/dsh-sandbox-local` could not load. It did not reach Session lifecycle assertions. Successful `dsh --version` and `dsh --help` calls do not prove Web startup. A second Gate used npm overrides in `/tmp` to install exact rc.2 DSH subpackages. Web printed a startup URL, then exited during startup with `user patch-layer watching requires the Cordis HMR service`. Pinning the HMR package to `1.0.17` did not prevent the failure. Neither run reached Session lifecycle assertions. A subsequent isolated installation in the user directory pinned rc.2 DSH subpackages, `@deepseek-ai/cordis@4.0.2`, and `@deepseek-ai/cordis-plugin-hmr@1.0.17`. DSH native `initProfile` set the Gate's temporary Web profile to `patchReload: startup`; other Gate paths were unchanged. On macOS arm64 with Node.js `v24.18.0`, the real CLI lifecycle Gate **passed 1/1**, covering streaming, cancellation, editing, restore, and close as described above. A rerun also passed 1/1. The original global installation was retained. The original `dsh` symlink was backed up, as was the user Web profile before modification. After the change, the running managed Web continued to listen on its loopback port and returned the expected unauthenticated 401 fingerprint. `startup` disables live reload of profile patches. The default `live` mode still fails locally because the HMR service is missing. Unapproved npm install scripts are not counted as test evidence. Other native-module combinations are not fully validated. Earlier Windows validation covers only rc.1/012.

## Connection-version policy

Connections are no longer rejected solely by a `--version` allowlist. A single canonical SemVer line is accepted. The `0.1.2` series tries V0; modern versions below `0.1.7-rc.1` try V3; `0.1.7-rc.1` and later try V4. Native protocol parsers still strictly validate Web Remote, history, and stream data. V3 Session Refs can try restoration across CLI versions and fail if the format differs. Fork checkpoints must still match the exact CLI version that created them, to prevent history mutation by old sequence numbers after an unknown native migration. Settings → Connections shows versions in the validated-version list, including `0.1.7-rc.2`; other untested versions are not declared compatible. Automated tests for this policy prove only version probing, routing, and simulated native protocol behavior. Real lifecycle evidence must still be recorded separately for each version.

## CodeRabbit review fixes

Integer validation now fails with existing protocol error types. Invalid chunk indices and finish `status`/`providerRetryAfterMs` remain `protocolError` and do not trigger journal reconnect. Assistant-start settlement lookup now iterates by index from `startedAfterSeq + 1`, retains the matching conditions, and does not copy the history array.

Added tests first reproduce failures in the old implementation, then verify the fixes. All 167 focused regressions and the 820 full-Adapter tests above passed. Performance regressions assert that excluded history prefixes are not accessed; they do not use timing thresholds that depend on machine speed. This round did not repeat the real CLI lifecycle Gates that had already passed.
