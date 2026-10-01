import { describe, expect, it } from "vitest";

import { usageLedgerModelSummarySchema } from "../src/usage-ledger.js";

const summary = {
  harnessId: "codex",
  harnessName: "Codex",
  modelId: "model-a",
  modelLabel: null,
  sessions: 1,
  turns: 1,
  userSessions: 1,
  userTurns: 1,
  interruptedTurns: 0,
  failedTurns: 0,
  durationMs: 10_000,
  tokenSessions: 1,
  tokenTurns: 1,
  inputTokens: 1_000,
  cachedInputTokens: 0,
  outputTokens: 100,
  reasoningOutputTokens: 0,
  totalTokens: 1_100,
  costSessions: 0,
  costTurns: 0,
  estimatedCostTurns: 0,
  costUsd: 0,
  lastTurnAtMs: 10_000,
};

describe("usage ledger TPS totals", () => {
  it("defaults missing totals from older Hosts without inferring a rate", () => {
    expect(usageLedgerModelSummarySchema.parse(summary)).toMatchObject({
      timedOutputTokens: 0,
      outputTokenDurationMs: 0,
    });
  });

  it("accepts measured totals and rejects invalid counts or timing", () => {
    expect(
      usageLedgerModelSummarySchema.parse({
        ...summary,
        timedOutputTokens: 100,
        outputTokenDurationMs: 10_000,
      }),
    ).toMatchObject({ timedOutputTokens: 100, outputTokenDurationMs: 10_000 });
    for (const field of ["timedOutputTokens", "outputTokenDurationMs"]) {
      for (const value of [-1, 1.5, Infinity]) {
        expect(
          usageLedgerModelSummarySchema.safeParse({ ...summary, [field]: value }).success,
        ).toBe(false);
      }
    }
  });
});
