import { describe, expect, it } from "vitest";

import { summarizeUsageLedger, type UsageLedgerTurnRecord } from "../src/usage-ledger.js";
import { estimateApiCostUsd } from "../src/usage-pricing.js";

describe("API-rate cost estimate", () => {
  it("prices cached input inside input tokens at the cached rate", () => {
    // gpt-6.1-sol: $2 input, $0.10 cached, $10 output per million.
    const cost = estimateApiCostUsd("codex", "gpt-6.1-sol", {
      inputTokens: 600_000,
      cachedInputTokens: 500_000,
      outputTokens: 50_000,
    });
    expect(cost).toBeCloseTo(0.2 + 0.05 + 0.5, 6);
  });

  it("returns nothing for other Harnesses, unknown Models or Turns without tokens", () => {
    const usage = { inputTokens: 1_000, outputTokens: 10 };
    expect(estimateApiCostUsd("pi", "gpt-6.1-sol", usage)).toBeUndefined();
    expect(estimateApiCostUsd("codex", "gpt-unknown", usage)).toBeUndefined();
    expect(estimateApiCostUsd("codex", undefined, usage)).toBeUndefined();
    expect(estimateApiCostUsd("codex", "gpt-6.1-sol", { totalTokens: 5 })).toBeUndefined();
  });

  it("fills in cost for native Codex Turns and marks it estimated", () => {
    const record = (usage: UsageLedgerTurnRecord["usage"]): UsageLedgerTurnRecord => ({
      v: 1,
      threadId: "t",
      turnId: crypto.randomUUID(),
      harnessId: "codex",
      modelId: "gpt-6.1-sol",
      origin: "user",
      outcome: "completed",
      startedAtMs: 1_000,
      completedAtMs: 2_000,
      ...(usage ? { usage } : {}),
    });
    const { models } = summarizeUsageLedger(
      [
        record({ inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 0 }),
        record({ inputTokens: 10, outputTokens: 1, totalCostUsd: 1 }),
      ],
      { harnessName: () => "Codex" },
    );
    expect(models[0]).toMatchObject({ costTurns: 2, estimatedCostTurns: 1, costUsd: 3 });
  });
});
