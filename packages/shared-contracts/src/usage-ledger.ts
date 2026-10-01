import { z } from "zod";

export const USAGE_LEDGER_SUMMARY_METHOD = "codex-z/usage-ledger/summary";

const countSchema = z.number().int().nonnegative();

export const usageLedgerSummaryParamsSchema = z.strictObject({
  /** Only Turns completed at or after this Unix time in milliseconds. */
  sinceMs: countSchema.optional(),
});
export type UsageLedgerSummaryParams = z.infer<typeof usageLedgerSummaryParamsSchema>;

/**
 * Totals for one Harness and Model. A Session is one Thread that completed at
 * least one Turn with this Model in the requested range. Token and cost totals
 * cover only the Turns counted in `tokenTurns` and `costTurns`; a Harness that
 * reports neither leaves them at zero.
 */
export const usageLedgerModelSummarySchema = z.strictObject({
  harnessId: z.string(),
  harnessName: z.string(),
  modelId: z.string().nullable(),
  modelLabel: z.string().nullable(),
  sessions: countSchema,
  turns: countSchema,
  /** Sessions and Turns the user drove, excluding delegated, subagent and autonomous Turns. */
  userSessions: countSchema,
  userTurns: countSchema,
  interruptedTurns: countSchema,
  failedTurns: countSchema,
  durationMs: countSchema,
  tokenSessions: countSchema,
  tokenTurns: countSchema,
  inputTokens: countSchema,
  cachedInputTokens: countSchema,
  outputTokens: countSchema,
  /** Output tokens from Turns with a reported output count and positive elapsed time. */
  timedOutputTokens: countSchema.default(0),
  /** Elapsed time for the same Turns, including Tool calls and other waits. */
  outputTokenDurationMs: countSchema.default(0),
  reasoningOutputTokens: countSchema,
  totalTokens: countSchema,
  costSessions: countSchema,
  costTurns: countSchema,
  /** Of `costTurns`, those priced from tokens at API rates because the Harness reported no cost. */
  estimatedCostTurns: countSchema,
  costUsd: z.number().nonnegative(),
  lastTurnAtMs: countSchema,
});
export type UsageLedgerModelSummary = z.infer<typeof usageLedgerModelSummarySchema>;

export const usageLedgerSummaryResultSchema = z.strictObject({
  models: z.array(usageLedgerModelSummarySchema),
  turns: countSchema,
  /** Completion time of the oldest recorded Turn, regardless of the requested range. */
  recordingSinceMs: countSchema.nullable(),
});
export type UsageLedgerSummaryResult = z.infer<typeof usageLedgerSummaryResultSchema>;
