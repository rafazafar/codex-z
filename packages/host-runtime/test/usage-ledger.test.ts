import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  UsageLedgerStore,
  defaultUsageLedgerFile,
  summarizeUsageLedger,
  usageDelta,
  type UsageLedgerTurnRecord,
} from "../src/usage-ledger.js";
import { UsageLedgerRecorder } from "../src/usage-ledger-recorder.js";

let directory: string;
let store: UsageLedgerStore;
let clock: number;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "codex-z-usage-ledger-"));
  store = new UsageLedgerStore(path.join(directory, "usage-ledger", "turns.jsonl"));
  clock = 1_000_000;
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function recorder(agentThreads: readonly string[] = []): UsageLedgerRecorder {
  return new UsageLedgerRecorder({
    store,
    harnessName: (harnessId) => (harnessId === "codex" ? "Codex" : `name:${harnessId}`),
    isAgentThread: async (threadId) => agentThreads.includes(threadId),
    diagnose: (error) => {
      throw error;
    },
    now: () => clock,
  });
}

function turn(overrides: Partial<UsageLedgerTurnRecord>): UsageLedgerTurnRecord {
  return {
    v: 1,
    threadId: "thread-1",
    turnId: "turn-1",
    harnessId: "pi",
    modelId: "model-a",
    origin: "user",
    outcome: "completed",
    startedAtMs: 1_000,
    completedAtMs: 61_000,
    ...overrides,
  };
}

const completion = {
  threadId: "thread-1",
  harnessId: "claude-code",
  cwd: "/work/project",
  modelId: "opus",
  modelLabel: "Opus 5",
  outcome: "completed",
  durationMs: 30_000,
} as const;

describe("usage ledger store", () => {
  it("keeps the ledger beside the mapping store", () => {
    expect(defaultUsageLedgerFile({ CODEX_Z_DATA_DIR: directory })).toBe(
      path.join(directory, "usage-ledger", "turns.jsonl"),
    );
  });

  it("returns the latest line per Turn and skips unreadable lines", async () => {
    await store.append(turn({ usage: { totalCostUsd: 1 } }));
    await store.append(turn({ turnId: "turn-2" }));
    writeFileSync(store.file, `${readFileSync(store.file, "utf8")}{"torn":\nnot json\n`);
    await store.append(turn({ usage: { totalCostUsd: 3 } }));

    const records = await store.read();

    expect(records.map(({ turnId }) => turnId)).toEqual(["turn-2", "turn-1"]);
    expect(records[1]?.usage).toEqual({ totalCostUsd: 3 });
  });

  it("hides Turns before a reset but keeps them as baselines", async () => {
    await store.append(turn({ cumulative: { totalTokens: 10 } }));
    await store.reset(100_000);
    await store.append(turn({ turnId: "turn-2", completedAtMs: 200_000 }));

    expect((await store.readVisible()).map(({ turnId }) => turnId)).toEqual(["turn-2"]);
    expect((await store.read()).map(({ turnId }) => turnId)).toEqual(["turn-1", "turn-2"]);
  });

  it("reads a missing ledger as empty", async () => {
    expect(await store.read()).toEqual([]);
  });
});

describe("usage delta", () => {
  it("subtracts the baseline and treats a lower counter as restarted", () => {
    expect(
      usageDelta(
        { inputTokens: 150, outputTokens: 20, totalCostUsd: 0.4 },
        { inputTokens: 100, totalCostUsd: 3.2 },
      ),
    ).toEqual({ inputTokens: 50, outputTokens: 20, totalCostUsd: 0.4 });
  });
});

describe("usage ledger summary", () => {
  it.each(["codex", "claude-code", "pi"])(
    "pairs output counts with positive Turn durations for %s",
    (harnessId) => {
      const records = [
        turn({
          turnId: "short",
          completedAtMs: 11_000,
          usage: { outputTokens: 100, inputTokens: 654_000 },
        }),
        turn({
          turnId: "long",
          completedAtMs: 31_000,
          outcome: "interrupted",
          usage: { outputTokens: 900 },
        }),
        turn({ turnId: "zero-output", completedAtMs: 11_000, usage: { outputTokens: 0 } }),
        turn({ turnId: "missing-usage" }),
        turn({ turnId: "input-only", usage: { inputTokens: 1_000 } }),
        turn({ turnId: "total-only", usage: { totalTokens: 5_000 } }),
        turn({ turnId: "zero-time", completedAtMs: 1_000, usage: { outputTokens: 5_000 } }),
        turn({ turnId: "negative-time", completedAtMs: 500, usage: { outputTokens: 5_000 } }),
      ].map((record) => ({ ...record, harnessId }));
      const summary = summarizeUsageLedger(records, { harnessName: (id) => id });

      expect(summary.models[0]).toMatchObject({
        timedOutputTokens: 1_000,
        outputTokenDurationMs: 50_000,
        outputTokens: 11_000,
      });

      const filtered = summarizeUsageLedger(records, { sinceMs: 20_000, harnessName: (id) => id });
      expect(filtered.models[0]).toMatchObject({
        timedOutputTokens: 900,
        outputTokenDurationMs: 30_000,
      });
    },
  );

  it("groups by Harness and Model and separates user Turns from agent Turns", () => {
    const summary = summarizeUsageLedger(
      [
        turn({ usage: { totalTokens: 100, totalCostUsd: 0.5 } }),
        turn({ turnId: "turn-2", outcome: "interrupted", usage: { inputTokens: 40 } }),
        turn({ threadId: "thread-2", origin: "agent", usage: { totalCostUsd: 1.5 } }),
        turn({ threadId: "thread-3", modelId: "model-b", outcome: "failed" }),
        turn({ threadId: "old", completedAtMs: 10 }),
      ],
      { sinceMs: 1_000, harnessName: (id) => id.toUpperCase() },
    );

    expect(summary.turns).toBe(4);
    expect(summary.recordingSinceMs).toBe(10);
    expect(summary.models).toHaveLength(2);
    expect(summary.models.find(({ modelId }) => modelId === "model-a")).toMatchObject({
      harnessName: "PI",
      sessions: 2,
      turns: 3,
      userSessions: 1,
      userTurns: 2,
      interruptedTurns: 1,
      durationMs: 180_000,
      tokenSessions: 1,
      tokenTurns: 2,
      totalTokens: 140,
      costSessions: 2,
      costTurns: 2,
      estimatedCostTurns: 0,
      costUsd: 2,
    });
    expect(summary.models.find(({ modelId }) => modelId === "model-b")).toMatchObject({
      failedTurns: 1,
      costTurns: 0,
      estimatedCostTurns: 0,
      costUsd: 0,
    });
  });

  it("keeps one alias apart when it resolves to different Models", () => {
    const summary = summarizeUsageLedger(
      [
        turn({ modelId: "opus", modelLabel: "Opus 4" }),
        turn({ threadId: "thread-2", modelId: "opus", modelLabel: "Opus 5" }),
      ],
      { harnessName: (id) => id },
    );

    expect(summary.models.map(({ modelLabel }) => modelLabel).toSorted()).toEqual([
      "Opus 4",
      "Opus 5",
    ]);
  });
});

describe("usage ledger recorder: external Threads", () => {
  it("records each Turn's own share of the cumulative Session counters", async () => {
    const ledger = recorder();
    ledger.externalTurnStarted({
      threadId: "thread-1",
      turnId: "turn-1",
      usage: null,
      hasPriorTurns: false,
    });
    clock += 30_000;
    ledger.externalTurnCompleted({
      ...completion,
      turnId: "turn-1",
      usage: { inputTokens: 100, outputTokens: 10, totalCostUsd: 0.25, contextUsagePercent: 4 },
    });
    ledger.externalTurnStarted({
      threadId: "thread-1",
      turnId: "turn-2",
      usage: { inputTokens: 100, outputTokens: 10, totalCostUsd: 0.25 },
      hasPriorTurns: true,
    });
    ledger.externalTurnCompleted({
      ...completion,
      turnId: "turn-2",
      outcome: "interrupted",
      usage: { inputTokens: 180, outputTokens: 30, totalCostUsd: 0.75 },
    });
    await ledger.settled();

    const [first, second] = await store.read();
    expect(first).toMatchObject({
      harnessId: "claude-code",
      modelId: "opus",
      modelLabel: "Opus 5",
      origin: "user",
      startedAtMs: 1_000_000,
      completedAtMs: 1_030_000,
      usage: { inputTokens: 100, outputTokens: 10, totalCostUsd: 0.25 },
    });
    expect(first?.usage).not.toHaveProperty("contextUsagePercent");
    expect(second).toMatchObject({
      outcome: "interrupted",
      usage: { inputTokens: 80, outputTokens: 20, totalCostUsd: 0.5 },
      cumulative: { inputTokens: 180, outputTokens: 30, totalCostUsd: 0.75 },
    });
  });

  it("counts a restarted native counter in full instead of going negative", async () => {
    const ledger = recorder();
    ledger.externalTurnStarted({
      threadId: "thread-1",
      turnId: "turn-1",
      usage: null,
      hasPriorTurns: false,
    });
    ledger.externalTurnCompleted({ ...completion, turnId: "turn-1", usage: { totalCostUsd: 3 } });
    // The Session was released and resumed: no usage is known before the Turn.
    ledger.externalTurnStarted({
      threadId: "thread-1",
      turnId: "turn-2",
      usage: null,
      hasPriorTurns: true,
    });
    ledger.externalTurnCompleted({ ...completion, turnId: "turn-2", usage: { totalCostUsd: 0.4 } });
    await ledger.settled();

    expect((await store.read())[1]?.usage).toEqual({ totalCostUsd: 0.4 });
  });

  it("uses the last recorded counters as the baseline after a Host restart", async () => {
    const before = recorder();
    before.externalTurnStarted({
      threadId: "thread-1",
      turnId: "turn-1",
      usage: null,
      hasPriorTurns: false,
    });
    before.externalTurnCompleted({ ...completion, turnId: "turn-1", usage: { totalTokens: 500 } });
    await before.settled();

    const after = recorder();
    after.externalTurnStarted({
      threadId: "thread-1",
      turnId: "turn-2",
      usage: null,
      hasPriorTurns: true,
    });
    after.externalTurnCompleted({ ...completion, turnId: "turn-2", usage: { totalTokens: 800 } });
    await after.settled();

    expect((await store.read())[1]?.usage).toEqual({ totalTokens: 300 });
  });

  it("omits usage when earlier Turns cannot be separated from the first recorded one", async () => {
    const ledger = recorder();
    ledger.externalTurnStarted({
      threadId: "imported",
      turnId: "turn-9",
      usage: null,
      hasPriorTurns: true,
    });
    ledger.externalTurnCompleted({
      ...completion,
      threadId: "imported",
      turnId: "turn-9",
      usage: { totalCostUsd: 12 },
    });
    await ledger.settled();

    const [record] = await store.read();
    expect(record?.usage).toBeUndefined();
    expect(record?.cumulative).toEqual({ totalCostUsd: 12 });
  });

  it("amends the finished Turn when its usage arrives late", async () => {
    const ledger = recorder();
    ledger.externalTurnStarted({
      threadId: "thread-1",
      turnId: "turn-1",
      usage: null,
      hasPriorTurns: false,
    });
    ledger.externalTurnCompleted({ ...completion, turnId: "turn-1", usage: null });
    ledger.externalUsageChanged({
      threadId: "thread-1",
      turnId: "turn-1",
      usage: { totalTokens: 900, totalCostUsd: 0.2 },
    });
    await ledger.settled();

    const records = await store.read();
    expect(records).toHaveLength(1);
    expect(records[0]?.usage).toEqual({ totalTokens: 900, totalCostUsd: 0.2 });
  });

  it("marks delegated and autonomous Turns so they are not counted as user Turns", async () => {
    const ledger = recorder(["delegated"]);
    ledger.externalTurnStarted({
      threadId: "delegated",
      turnId: "turn-1",
      usage: null,
      hasPriorTurns: false,
    });
    ledger.externalTurnCompleted({
      ...completion,
      threadId: "delegated",
      turnId: "turn-1",
      usage: null,
    });
    ledger.externalTurnStarted({
      threadId: "thread-1",
      turnId: "turn-2",
      usage: null,
      hasPriorTurns: false,
      autonomous: true,
    });
    ledger.externalTurnCompleted({ ...completion, turnId: "turn-2", usage: null });
    await ledger.settled();

    expect((await store.read()).map(({ origin }) => origin)).toEqual(["agent", "autonomous"]);
  });
});

describe("usage ledger recorder: native Codex Threads", () => {
  const breakdown = (totalTokens: number) => ({
    totalTokens,
    inputTokens: totalTokens - 10,
    cachedInputTokens: 0,
    outputTokens: 10,
    reasoningOutputTokens: 0,
  });

  it("records the Model, timing and token share of a native Turn", async () => {
    const ledger = recorder();
    ledger.officialRequest({ id: 7, method: "thread/resume", params: { threadId: "native-1" } });
    ledger.officialOutput({
      id: 7,
      result: {
        model: "gpt-next",
        reasoningEffort: "high",
        thread: { id: "native-1", cwd: "/work/project", ephemeral: false, source: "appServer" },
      },
    });
    ledger.officialOutput({
      method: "turn/started",
      params: { threadId: "native-1", turn: { id: "turn-1", status: "inProgress" } },
    });
    // The Thread already held 1,000 tokens; the first request of this Turn used 200.
    ledger.officialOutput({
      method: "thread/tokenUsage/updated",
      params: {
        threadId: "native-1",
        turnId: "turn-1",
        tokenUsage: { total: breakdown(1_200), last: breakdown(200) },
      },
    });
    ledger.officialOutput({
      method: "thread/tokenUsage/updated",
      params: {
        threadId: "native-1",
        turnId: "turn-1",
        tokenUsage: { total: breakdown(1_500), last: breakdown(300) },
      },
    });
    clock += 45_000;
    ledger.officialOutput({
      method: "turn/completed",
      params: {
        threadId: "native-1",
        turn: { id: "turn-1", status: "interrupted", durationMs: 42_000 },
      },
    });
    await ledger.settled();

    expect(await store.read()).toEqual([
      expect.objectContaining({
        threadId: "native-1",
        harnessId: "codex",
        modelId: "gpt-next",
        thinkingOptionId: "high",
        cwd: "/work/project",
        origin: "user",
        outcome: "interrupted",
        startedAtMs: 1_003_000,
        completedAtMs: 1_045_000,
        usage: expect.objectContaining({ totalTokens: 500, outputTokens: 10 }),
      }),
    ]);
    expect((await ledger.summary({})).models[0]).toMatchObject({
      harnessName: "Codex",
      modelId: "gpt-next",
      sessions: 1,
      interruptedTurns: 1,
      totalTokens: 500,
    });
  });

  it("follows a Model change sent with the Turn and skips ephemeral and subagent Threads", async () => {
    const ledger = recorder();
    ledger.officialOutput({
      method: "thread/started",
      params: { thread: { id: "native-1", model: "gpt-old" } },
    });
    ledger.officialOutput({
      method: "thread/started",
      params: { thread: { id: "title", model: "gpt-mini", ephemeral: true } },
    });
    ledger.officialOutput({
      method: "thread/started",
      params: { thread: { id: "child", model: "gpt-old", parentThreadId: "native-1" } },
    });
    ledger.officialRequest({
      id: 9,
      method: "turn/start",
      params: { threadId: "native-1", model: "gpt-next", effort: "low" },
    });
    for (const threadId of ["native-1", "title", "child"]) {
      ledger.officialOutput({
        method: "turn/completed",
        params: { threadId, turn: { id: `${threadId}-turn`, status: "completed" } },
      });
    }
    await ledger.settled();

    expect(
      (await store.read()).map(({ threadId, modelId, origin }) => [threadId, modelId, origin]),
    ).toEqual([
      ["native-1", "gpt-next", "user"],
      ["child", "gpt-old", "agent"],
    ]);
  });
});
