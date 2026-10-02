import { describe, expect, it, vi } from "vitest";
import {
  harnessCommandCatalogSchema,
  hostItemIdSchema,
  hostThreadIdSchema,
  USAGE_LEDGER_SUMMARY_METHOD,
} from "@codex-z/shared-contracts";
import type { HarnessCommandInvocation, HarnessGoal } from "@codex-z/harness-adapter";
import {
  createFixture,
  requestId,
  startPiThread,
  startPiTurn,
  stopFixture,
  turnEvent,
  writeRequest,
} from "./app-server-host-fixture.js";
import { ExternalTurnLeases } from "../src/external-turn-leases.js";
import { decodeExternalGoalUpdate } from "../src/external-goal-routing.js";
const nativeGoal: HarnessGoal = {
  objective: "ship",
  status: "active",
  createdAt: 10,
  updatedAt: 20,
};

describe("Desktop goal routing", () => {
  it("does not forward an external goal to official Codex and preserves unsupported plugins", async () => {
    const f = createFixture();
    try {
      const threadId = await startPiThread(f);
      writeRequest(f.desktopInput, { id: 2, method: "thread/goal/get", params: { threadId } });
      expect(await f.collector.waitFor((m) => requestId(m, 2))).toMatchObject({
        result: { goal: null },
      });
      writeRequest(f.desktopInput, {
        id: 3,
        method: "thread/goal/set",
        params: { threadId, objective: "ship" },
      });
      expect(await f.collector.waitFor((m) => requestId(m, 3))).toMatchObject({
        error: { code: -32078 },
      });
    } finally {
      await stopFixture(f);
    }
  });
  it("routes a Desktop goal through one native command and publishes confirmed native updates", async () => {
    const f = createFixture();
    try {
      const threadId = await startPiThread(f);
      const session = f.adapter.sessions[0];
      if (!session) throw new Error("Missing native Session");
      let goal: HarnessGoal | null = null;
      const execute = vi.fn(async ({ turnId }: HarnessCommandInvocation) => {
        goal = nativeGoal;
        session.publishGoal(goal);
        session.publishEphemeralCommand(turnId, {
          type: "agentMessage",
          itemId: hostItemIdSchema.parse("goal-receipt"),
          text: "Native goal set",
        });
        return { ok: true as const, value: { turnId } };
      });
      session.commands = {
        list: async () => ({
          ok: true,
          value: harnessCommandCatalogSchema.parse({
            commands: [
              { id: "native.goal", invocation: "/goal", label: "Goal", argumentMode: "text" },
            ],
          }),
        }),
        execute,
      };
      session.goals = {
        read: async () => ({ ok: true, value: goal }),
        prepare: async () => ({
          ok: true,
          value: { commandId: "native.goal", arguments: { text: "ship" } },
        }),
      };
      writeRequest(f.desktopInput, {
        id: 2,
        method: "thread/goal/set",
        params: { threadId, objective: "ship", status: "active" },
      });
      expect(await f.collector.waitFor((m) => requestId(m, 2))).toMatchObject({
        result: { goal: { threadId, objective: "ship", status: "active", tokenBudget: null } },
      });
      await f.collector.waitFor((m) => m.method === "thread/goal/updated");
      expect(f.collector.messages.findIndex((m) => requestId(m, 2))).toBeLessThan(
        f.collector.messages.findIndex((m) => m.method === "thread/goal/updated"),
      );
      expect(execute).toHaveBeenCalledOnce();
      session.publishGoal(null);
      await f.collector.waitFor((m) => m.method === "thread/goal/cleared");
    } finally {
      f.host.close();
      await stopFixture(f);
    }
  });
  it("retains goal worker history and its usage from command admission", async () => {
    const f = createFixture();
    try {
      const threadId = await startPiThread(f);
      const session = f.adapter.sessions[0];
      if (!session) throw new Error("Missing native Session");
      session.commands = {
        list: async () => ({
          ok: true,
          value: harnessCommandCatalogSchema.parse({
            commands: [
              { id: "native.goal", invocation: "/goal", label: "Goal", argumentMode: "text" },
            ],
          }),
        }),
        execute: async ({ turnId }) => {
          const result = await session.execute({
            type: "turn.start",
            turnId,
            input: [{ type: "text", text: "/goal ship" }],
          });
          session.publishGoal(nativeGoal);
          return result.ok ? { ok: true, value: { ...result.value, persistTurn: true } } : result;
        },
      };
      session.goals = {
        prepare: async () => ({
          ok: true,
          value: { commandId: "native.goal", arguments: { text: "ship" } },
        }),
        read: async () => ({ ok: true, value: nativeGoal }),
      };
      writeRequest(f.desktopInput, {
        id: 2,
        method: "thread/goal/set",
        params: { threadId, objective: "ship" },
      });
      await f.collector.waitFor((m) => requestId(m, 2));
      await f.collector.waitFor((m) => m.method === "turn/started");
      session.publishUsage({ totalTokens: 1000, totalCostUsd: 0.5 });
      session.appendText("Native worker output");
      session.succeedTurn();
      await f.collector.waitFor((m) => m.method === "turn/completed");
      expect(
        (await f.mappingStore.getThread(hostThreadIdSchema.parse(threadId)))?.turnMappings,
      ).toHaveLength(1);
      writeRequest(f.desktopInput, { id: 3, method: USAGE_LEDGER_SUMMARY_METHOD, params: {} });
      expect(await f.collector.waitFor((m) => requestId(m, 3))).toMatchObject({
        result: { turns: 1, models: [{ totalTokens: 1000, costUsd: 0.5 }] },
      });
      session.publishGoal(null);
    } finally {
      f.host.close();
      await stopFixture(f);
    }
  });
  it("holds the mutation lease while native preparation is pending", async () => {
    const leases = new ExternalTurnLeases();
    const f = createFixture({ externalTurnLeases: leases });
    const prepared = Promise.withResolvers<undefined>();
    try {
      const threadId = await startPiThread(f);
      const session = f.adapter.sessions[0];
      if (!session) throw new Error("Missing native Session");
      const prepare = vi.fn(async () => {
        await prepared.promise;
        return {
          ok: false as const,
          error: {
            code: "unsupported" as const,
            message: "Native goals unavailable",
            retryable: false,
          },
        };
      });
      session.goals = { read: async () => ({ ok: true, value: null }), prepare };
      writeRequest(f.desktopInput, {
        id: 2,
        method: "thread/goal/set",
        params: { threadId, objective: "ship" },
      });
      await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce());
      expect(leases.acquire(threadId, {})).toBe(false);
      prepared.resolve(undefined);
      expect(await f.collector.waitFor((m) => requestId(m, 2))).toMatchObject({
        error: { code: -32078 },
      });
      await vi.waitFor(() => expect(leases.heldByOther(threadId, {})).toBe(false));
    } finally {
      prepared.resolve(undefined);
      f.host.close();
      await stopFixture(f);
    }
  });
  it("permits native pause during work and keeps controls separate from worker cancellation", async () => {
    const f = createFixture();
    try {
      const threadId = await startPiThread(f);
      await startPiTurn(f, threadId);
      const session = f.adapter.sessions[0];
      if (!session) throw new Error("Missing native Session");
      const execute = vi.spyOn(session, "execute");
      execute.mockClear();
      const control = vi.fn(async () => {
        const goal = { ...nativeGoal, status: "paused" as const };
        session.publishGoal(goal);
        return { ok: true as const, value: goal };
      });
      session.goals = {
        read: async () => ({ ok: true, value: nativeGoal }),
        control,
        prepare: vi.fn(),
      };
      writeRequest(f.desktopInput, {
        id: 8,
        method: "thread/goal/set",
        params: { threadId, status: "paused" },
      });
      expect(await f.collector.waitFor((m) => requestId(m, 8))).toMatchObject({
        result: { goal: { status: "paused" } },
      });
      expect(control).toHaveBeenCalledWith({ type: "set", status: "paused" });
      expect(execute).not.toHaveBeenCalled();
    } finally {
      f.host.close();
      await stopFixture(f);
    }
  });
  it("retains the writer lease and native Session during an active goal gap", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    const leases = new ExternalTurnLeases();
    const f = createFixture({ externalTurnLeases: leases });
    try {
      const threadId = await startPiThread(f);
      const turnId = await startPiTurn(f, threadId);
      const session = f.adapter.sessions[0];
      if (!session) throw new Error("Missing native Session");
      const close = vi.spyOn(session, "close");
      session.publishGoal(nativeGoal);
      session.succeedTurn();
      await f.collector.waitFor((m) => turnEvent(m, "turn/completed", turnId));
      writeRequest(f.desktopInput, {
        id: 20,
        method: "codex-z/settings/idle-release/set",
        params: { enabled: true, timeoutMinutes: 10 },
      });
      await f.collector.waitFor((m) => requestId(m, 20));
      await vi.advanceTimersByTimeAsync(11 * 60_000);
      expect(close).not.toHaveBeenCalled();
      expect(leases.heldByOther(threadId, {})).toBe(true);
      session.publishGoal(null);
      await f.collector.waitFor((m) => m.method === "thread/goal/cleared");
      expect(leases.heldByOther(threadId, {})).toBe(false);
      await vi.advanceTimersByTimeAsync(11 * 60_000);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      f.host.close();
      await stopFixture(f);
      vi.useRealTimers();
    }
  });
  it("drops unavailable observations when native output ends without inventing a clear", async () => {
    const leases = new ExternalTurnLeases();
    const f = createFixture({ externalTurnLeases: leases });
    try {
      const threadId = await startPiThread(f);
      const session = f.adapter.sessions[0];
      if (!session) throw new Error("Missing native Session");
      session.publishGoal(nativeGoal);
      await f.collector.waitFor((m) => m.method === "thread/goal/updated");
      expect(leases.heldByOther(threadId, {})).toBe(true);
      await session.close();
      await vi.waitFor(() => expect(leases.heldByOther(threadId, {})).toBe(false));
      expect(f.collector.messages.some((m) => m.method === "thread/goal/cleared")).toBe(false);
    } finally {
      f.host.close();
      await stopFixture(f);
    }
  });
  it("validates updates without losing explicit budgets or native status", () => {
    expect(
      decodeExternalGoalUpdate("thread/goal/set", {
        threadId: "thread",
        tokenBudget: 100,
        status: "paused",
      }),
    ).toEqual({ type: "set", tokenBudget: 100, status: "paused" });
    for (const params of [
      { objective: "" },
      { tokenBudget: -1 },
      { tokenBudget: 0.2 },
      { status: "done" },
      { status: ["active"] },
      { unknown: true },
    ])
      expect(() =>
        decodeExternalGoalUpdate("thread/goal/set", { threadId: "thread", ...params }),
      ).toThrow();
  });
});
