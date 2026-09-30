# macOS process observation and path reads

## Purpose and scope

The shim must continuously observe descendants to preserve exit cleanup for short-lived parents,
process-group escape, and reparenting to PID 1. Do not reduce resource use by lowering observation frequency or weakening identity checks.

`crates/platform/src/macos_process_observation.rs` provides `ObservedProcessTree`
with staged snapshots. This optimization applies only to macOS; Linux / Windows paths remain unchanged.

## Algorithm and invariants

1. Still enumerate all system PIDs and read parent PID, process group, and start time.
2. Build possible related-process candidates from the root PID, known PIDs, and members satisfying the original process-group timing conditions.
   This is a conservative candidate set, not final ownership. Include possibly reused known PIDs so the original algorithm
   can reject root identity changes and remove exited descendants. Exited known parents can still seed the candidate search.
3. Read executable paths only for candidates. Failed candidate path reads still discard their snapshots;
   unreadable intermediate parents cannot fabricate a new ownership chain.
4. Pass complete candidate snapshots to original `observe_snapshots`. Return values, errors, descendant ledger,
   and root identity checks follow original rules. Extra candidates are permitted; missing candidates are not.

Do not cache paths. A valid `exec` can change executable while PID and start time stay the same.
Public `process_snapshot` / `process_snapshots`, Desktop discovery, startup path validation,
and pre-signal instance checks retain their behavior. Scan frequency and termination timeouts remain unchanged.

## Validation

`process_observation_tests.rs` uses unoptimized full snapshots as reference and compares complete snapshots,
errors, and ownership ledgers for path-read failures, root changes, reparenting, and PID reuse.
A fixed-seed comparison adds 2,000 topology/failure frames and asserts that unrelated paths are not read.

Related test command:

```sh
cargo test --locked -p codex-z-platform -p codex-z-shim -p codex-z-launcher --features codex-z-shim/test-utils
```

These tests include real-process byte/signal forwarding, escalated cleanup after ignored termination, escaped-descendant
cleanup, valid exec, and Host Runtime ownership handoff. Snapshot comparison does not replace real lifecycle tests.

## Performance measurement

Compare release shims before/after the same source change, switching only the installed launcher's `--shim`
binary. Official Desktop and Host Runtime versions stay the same.
After startup, measure the shim through differences in cumulative process CPU time. Do not count native Renderer or
Harness workload as optimization gains. 100% CPU is one core; RSS is not exclusive physical memory.

2026-09-15, M5 Pro / macOS 26.4, two windows of about 22 seconds:

| Run | Shim CPU before | Shim CPU after |
| --- | ---: | ---: |
| 1 | 16.85% | 3.47% |
| 2 | 9.27% | 3.67% |

Another post-change sample was 6.80%, showing that scheduling/system load affects absolute values. No fixed percentage is guaranteed.
Paired CPU reductions were about 60%–79%; shim RSS stayed near 7 MiB. The main gain is CPU, not memory.
This is not a full-product workload benchmark or a cross-platform functional-safety guarantee.
