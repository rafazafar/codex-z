import type { UsageLedgerModelSummary } from "@codex-z/shared-contracts";
import { describe, expect, it } from "vitest";

import {
  formatUsageCost,
  formatUsageAverage,
  formatUsageCount,
  formatUsageDuration,
  formatUsagePercent,
  sortUsageLedgerRows,
  usageLedgerRow,
} from "../../src/settings/usage-ledger-metrics.js";

function summary(overrides: Partial<UsageLedgerModelSummary>): UsageLedgerModelSummary {
  return {
    harnessId: "pi",
    harnessName: "Pi",
    modelId: "model-a",
    modelLabel: null,
    sessions: 0,
    turns: 0,
    userSessions: 0,
    userTurns: 0,
    interruptedTurns: 0,
    failedTurns: 0,
    durationMs: 0,
    tokenSessions: 0,
    tokenTurns: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    timedOutputTokens: 0,
    outputTokenDurationMs: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
    costSessions: 0,
    costTurns: 0,
    estimatedCostTurns: 0,
    costUsd: 0,
    lastTurnAtMs: 0,
    ...overrides,
  };
}

describe("usage ledger metrics", () => {
  it("averages each metric over the Sessions that reported it", () => {
    const row = usageLedgerRow(
      summary({
        modelLabel: "Model A",
        sessions: 4,
        turns: 20,
        userSessions: 2,
        userTurns: 9,
        interruptedTurns: 5,
        durationMs: 1_200_000,
        tokenSessions: 4,
        totalTokens: 2_000_000,
        costSessions: 2,
        costUsd: 3,
      }),
    );

    expect(row).toMatchObject({
      model: "Model A",
      turnsPerSession: 4.5,
      interruptedRate: 0.25,
      msPerSession: 300_000,
      costPerSession: 1.5,
      tokensPerSession: 500_000,
    });
  });

  it("leaves a metric empty instead of showing zero when nothing was reported", () => {
    const row = usageLedgerRow(summary({ sessions: 3, turns: 6 }));

    expect(row.costPerSession).toBeNull();
    expect(row.tokensPerSession).toBeNull();
    expect(row.turnsPerSession).toBeNull();
    expect(row.avgTps).toBeNull();
    expect(formatUsageCost(row.costPerSession)).toBe("—");
  });

  it("uses output tokens and elapsed time from the same measured Turns", () => {
    const row = usageLedgerRow(
      summary({
        totalTokens: 654_000,
        outputTokens: 10_000,
        durationMs: 100_000,
        timedOutputTokens: 600,
        outputTokenDurationMs: 40_000,
      }),
    );

    expect(row.avgTps).toBe(15);
    expect(formatUsageAverage(row.avgTps)).toBe("15.0");
    expect(usageLedgerRow(summary({ outputTokenDurationMs: 5_000 })).avgTps).toBe(0);
    expect(usageLedgerRow(summary({ timedOutputTokens: 50 })).avgTps).toBeNull();
    expect(formatUsageAverage(null)).toBe("—");
  });

  it("sorts Avg TPS with missing measurements last in either direction", () => {
    const rows = [
      usageLedgerRow(summary({ modelId: "none" })),
      usageLedgerRow(
        summary({ modelId: "slow", timedOutputTokens: 5, outputTokenDurationMs: 1_000 }),
      ),
      usageLedgerRow(
        summary({ modelId: "fast", timedOutputTokens: 15, outputTokenDurationMs: 1_000 }),
      ),
      usageLedgerRow(summary({ modelId: "zero", outputTokenDurationMs: 1_000 })),
    ];
    const order = (descending: boolean): string[] =>
      sortUsageLedgerRows(rows, { column: "avgTps", descending }).map(({ model }) => model);

    expect(order(true)).toEqual(["fast", "slow", "zero", "none"]);
    expect(order(false)).toEqual(["zero", "slow", "fast", "none"]);
  });

  it("sorts by a metric with unreported rows last in either direction", () => {
    const rows = [
      usageLedgerRow(summary({ modelId: "none", sessions: 1 })),
      usageLedgerRow(summary({ modelId: "cheap", sessions: 1, costSessions: 1, costUsd: 1 })),
      usageLedgerRow(summary({ modelId: "dear", sessions: 1, costSessions: 1, costUsd: 9 })),
    ];
    const order = (descending: boolean): string[] =>
      sortUsageLedgerRows(rows, { column: "costPerSession", descending }).map(({ model }) => model);

    expect(order(true)).toEqual(["dear", "cheap", "none"]);
    expect(order(false)).toEqual(["cheap", "dear", "none"]);
  });

  it("formats cost, counts, share and time compactly", () => {
    expect(formatUsageCost(0.004)).toBe("<$0.01");
    expect(formatUsageCost(1.234)).toBe("$1.23");
    expect(formatUsageCost(250.6)).toBe("$251");
    expect(formatUsageCount(999)).toBe("999");
    expect(formatUsageCount(12_340)).toBe("12.3k");
    expect(formatUsageCount(2_500_000)).toBe("2.5M");
    expect(formatUsagePercent(0.254)).toBe("25%");
    expect(formatUsageDuration(42_000)).toBe("42s");
    expect(formatUsageDuration(185_000)).toBe("3m 05s");
    expect(formatUsageDuration(3_900_000)).toBe("1h 05m");
  });
});

describe("readableModelId", () => {
  it("decodes Claude Code Model ids and leaves others alone", async () => {
    const { readableModelId } = await import("../../src/settings/usage-ledger-metrics.js");
    expect(readableModelId("claude-model-v1.c29ubmV0")).toBe("sonnet");
    expect(readableModelId("claude-model-v1.ZGVmYXVsdA")).toBe("Default");
    expect(readableModelId("gpt-6.1-sol")).toBe("gpt-6.1-sol");
    expect(readableModelId(null)).toBe("");
  });
});
