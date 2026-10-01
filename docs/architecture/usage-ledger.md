# Usage ledger: per-Turn usage history

The usage ledger records one line per completed Turn so that Settings → Usage can compare Models on real work: Turns per Session, how often a Turn was stopped, and time, cost and tokens per Session. It complements the live per-Thread Usage control, which keeps nothing once a Thread unloads.

## What is recorded

`UsageLedgerRecorder` (`packages/host-runtime/src/usage-ledger-recorder.ts`) observes Turns for both kinds of Thread and appends to `<data dir>/usage-ledger/turns.jsonl` (`~/.codex-z` or `CODEX_Z_DATA_DIR`, beside the mapping store).

| Field | Source |
| --- | --- |
| `threadId`, `turnId`, `harnessId`, `cwd` | Host Thread; `harnessId` is `codex` for native Threads |
| `modelId`, `modelLabel`, `thinkingOptionId` | External: effective Session state at Turn end. Native: `thread/start`, `thread/resume` and `thread/fork` responses, `thread/started`, `thread/settings/updated`, and `turn/start` params |
| `origin` | `user`, `agent` (delegated child or native subagent Thread) or `autonomous` |
| `outcome`, `startedAtMs`, `completedAtMs` | Projected Turn terminal; native `turn/completed` |
| `usage` | This Turn's share of the cumulative Native Session counters |
| `cumulative` | The counters after the Turn, used as the next baseline |

The ledger holds identifiers, timing and counters only. It never stores prompts, Transcript text or Tool arguments. Ephemeral Threads and ephemeral Turns are not recorded.

## Deriving a Turn's share

`HostUsage` token and cost fields are cumulative per Native Session, so a Turn's share is the difference between the counters after the Turn and a baseline:

1. the counters the Session reported just before the Turn started;
2. otherwise the counters after the previous Turn recorded by this Host;
3. otherwise the last `cumulative` stored in the ledger for the Thread;
4. otherwise zero for a Thread with no earlier Turns.

When none applies (the first recorded Turn of an imported or forked Session), `usage` is omitted because earlier Turns cannot be separated; `cumulative` is still stored so later Turns work. A counter lower than its baseline means the native counter restarted, for example a resumed process that counts from zero, and the whole value is attributed to the Turn.

Native Codex Threads have no Host baseline on first sight. The first `thread/tokenUsage/updated` of a Turn gives `total` and `last`, so the baseline is `total - last`. Native Threads report tokens but no cost.

Usage that arrives after a Turn has ended and is attributed to that Turn appends a corrected line. The reader keeps the last line per Thread and Turn.

## Reading

`codex-z/usage-ledger/summary` (`packages/shared-contracts/src/usage-ledger.ts`) takes an optional `sinceMs` and returns totals per Harness, Model id and resolved Model label. The label is part of the key so that an alias which resolves to a new Model after a launch is not merged with the old one. Token and cost totals come with the number of Turns and Sessions that reported them, and the Renderer averages only over those. A Harness that reports no cost shows no cost, not zero.

The settings page always reads the local Host, like Session Import.

### Avg TPS

Settings → Usage shows **Avg TPS**: total output tokens divided by total elapsed seconds for the same measured Turns. The summary returns these totals as `timedOutputTokens` and `outputTokenDurationMs`. Each Turn must have a reported output count and positive elapsed time. A reported zero output count is a valid measurement. Turns with missing output counts or zero or negative elapsed time are excluded from both totals.

The rate includes Tool calls and other waits within a Turn. It is not a measure of generation speed alone. Input tokens, cached input tokens and separate reasoning token counts are not added to the output count. Each Harness defines its output count. The calculation uses the stored Turn records, so existing records need no migration. If no measurement is available, the page shows **—**. Older Hosts that omit the new summary fields also show **—**.

## Boundaries

- Cost is the Harness's own estimate where it reports one. Native Codex reports tokens but no cost, so `usage-pricing.ts` prices those tokens at OpenAI's published standard API rates, keyed by exact Model id (cached input inside `inputTokens` at the cached rate). This is applied when the ledger is read, so a corrected price table also fixes history. Such cost is counted in `estimatedCostTurns` and shown with a leading `~`. Models without a known price show no cost. Long-context and Fast-tier surcharges are not applied, because a line holds a Turn's totals rather than its requests.
- A Claude Code Model id encodes the alias (for example `sonnet`). The Adapter publishes the concrete Model reported by the API as the resolved Model label, which the ledger stores as `modelLabel`; a Turn recorded without one is shown by its decoded alias.
- Harnesses count tokens differently (for example whether cached input is part of input), so token totals are comparable within one Harness only.
- A delegated Thread counts as `agent` for all its Turns, including a follow-up the user types there.
- The ledger is local to the Host that ran the Turn. A remote Host keeps its own file, which the settings page does not read.
- The file is append-only and is not rotated or pruned.
- A ledger failure is diagnosed and never fails or delays a Turn.
