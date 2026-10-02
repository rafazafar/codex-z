import { describe, expect, it, vi } from "vitest";
import {
  controlDeepSeekGoal,
  parseDeepSeekGoal,
  prepareDeepSeekGoal,
  projectDeepSeekGoal,
} from "../../src/modern/goals.js";
import type { ModernCommandRemote } from "../../src/modern/commands.js";
const native = {
  id: "goal-1",
  revision: 3,
  objective: "ship",
  phase: "active" as const,
  activation: "armed" as const,
  createdAt: 10000,
  updatedAt: 20000,
};

describe("DeepSeek native goal service", () => {
  it("reads native lifecycle and disarmed state without inventing completion", () => {
    expect(projectDeepSeekGoal(parseDeepSeekGoal(native))).toEqual({
      objective: "ship",
      status: "active",
      createdAt: 10,
      updatedAt: 20,
    });
    expect(projectDeepSeekGoal({ ...native, activation: "disarmed" })).toMatchObject({
      status: "paused",
    });
    expect(parseDeepSeekGoal(undefined)).toBeNull();
    for (const value of [
      { ...native, revision: 0 },
      { ...native, phase: "met" },
      { ...native, activation: "unknown" },
      { ...native, createdAt: NaN },
    ])
      expect(() => parseDeepSeekGoal(value)).toThrow("invalid native goal");
  });
  it("uses native compare-and-set controls and re-reads confirmation", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: native })
      .mockResolvedValueOnce({ ok: true, value: { ...native, phase: "paused" } })
      .mockResolvedValueOnce({
        ok: true,
        value: { ...native, phase: "paused", activation: "disarmed" },
      });
    expect(
      await controlDeepSeekGoal({ call } as unknown as ModernCommandRemote, "session-1", {
        type: "set",
        status: "paused",
      }),
    ).toMatchObject({ status: "paused" });
    expect(call.mock.calls[1]).toEqual([
      "goals/pause",
      { agentId: "session-1", ref: { id: "goal-1", revision: 3 } },
    ]);
  });
  it("does not retry a stale native mutation or ignore unsupported token budgets", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: native })
      .mockResolvedValueOnce({ ok: false, error: { code: "STALE" } });
    await expect(
      controlDeepSeekGoal({ call } as unknown as ModernCommandRemote, "session-1", {
        type: "clear",
      }),
    ).rejects.toThrow("state may have changed");
    expect(call).toHaveBeenCalledTimes(2);
    expect(
      prepareDeepSeekGoal({ type: "set", objective: "ship", tokenBudget: 10 }, null),
    ).toMatchObject({ ok: false });
    expect(prepareDeepSeekGoal({ type: "set", objective: "new objective" }, native)).toMatchObject({
      value: { arguments: { text: "edit new objective" } },
    });
  });
});

it("does not confirm pause when native state has become active again", async () => {
  const active = {
    id: "g",
    revision: 1,
    objective: "ship",
    phase: "active",
    activation: "armed",
    createdAt: 1000,
    updatedAt: 2000,
  };
  const call = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, value: active })
    .mockResolvedValueOnce({ ok: true, value: null })
    .mockResolvedValueOnce({ ok: true, value: { ...active, revision: 3 } });
  await expect(
    controlDeepSeekGoal({ call } as unknown as ModernCommandRemote, "session", {
      type: "set",
      status: "paused",
    }),
  ).rejects.toThrow("before control confirmation");
  expect(call).toHaveBeenCalledTimes(3);
});

it.each([
  null,
  { ...native, phase: "paused" },
  { ...native, activation: "disarmed" },
  { ...native, id: "other" },
])("rejects unconfirmed resume state %j", async (observed) => {
  const call = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, value: { ...native, phase: "paused" } })
    .mockResolvedValueOnce({ ok: true, value: null })
    .mockResolvedValueOnce({ ok: true, value: observed });
  await expect(
    controlDeepSeekGoal({ call } as unknown as ModernCommandRemote, "session", {
      type: "set",
      status: "active",
    }),
  ).rejects.toThrow("before control confirmation");
});
