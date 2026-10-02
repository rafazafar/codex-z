import { hostTurnIdSchema } from "@codex-z/shared-contracts";
import { describe, expect, it, vi } from "vitest";
import {
  ClaudeGoalObserver,
  claudeTranscriptGoal,
  prepareClaudeGoal,
  controlClaudeGoal,
} from "../src/goals.js";

const receipt = (args: string, text: string) => ({
  type: "assistant",
  timestamp: "2026-10-02T00:00:00Z",
  local_command_run: { command: "goal", args },
  message: { model: "<synthetic>", content: [{ type: "text", text }] },
});

describe("Claude native goal state", () => {
  it("waits for a native command receipt and ignores model prose", async () => {
    const publish = vi.fn();
    const observer = new ClaudeGoalObserver(publish);
    observer.begin("/goal make tests pass");
    let settled = false;
    const reading = observer.read().then((goal) => {
      settled = true;
      return goal;
    });
    observer.observe({
      ...receipt("make tests pass", "Goal set: make tests pass"),
      message: { model: "claude", content: [{ type: "text", text: "Goal set: make tests pass" }] },
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    observer.observe(receipt("make tests pass", "Goal set: make tests pass"));
    expect(await reading).toMatchObject({
      objective: "make tests pass",
      status: "active",
      createdAt: 1790899200,
    });
    observer.observe({
      type: "active_goal",
      value: {
        condition: "make tests pass",
        set_at: 1790899200000,
        iterations: 2,
        tokens_at_start: 100,
      },
    });
    expect(await observer.read()).toMatchObject({ status: "active" });
    observer.observe({ type: "active_goal", value: null });
    expect(await observer.read()).toBeNull(); // A clear is not evidence of completion.
  });
  it("confirms native clear and rejects trust or policy denial", async () => {
    const observer = new ClaudeGoalObserver(vi.fn());
    observer.begin("/goal clear");
    const cleared = observer.read();
    observer.observe(receipt("clear", "No goal set"));
    expect(await cleared).toBeNull();
    observer.begin("/goal ship");
    const denied = observer.read();
    observer.observe(receipt("ship", "/goal is only available in trusted workspaces."));
    await expect(denied).rejects.toThrow("trusted workspaces");
    // A fast native denial before the caller starts reading must also reject confirmation.
    observer.begin("/goal ship");
    observer.observe(receipt("ship", "/goal is only available in trusted workspaces."));
    await expect(observer.read()).rejects.toThrow("trusted workspaces");
    observer.begin("/goal ship");
    const incomplete = observer.read();
    observer.settle();
    await expect(incomplete).rejects.toThrow("did not confirm");
  });
  it("preserves the native condition across interruption and a resume prompt", async () => {
    const observer = new ClaudeGoalObserver(vi.fn());
    observer.observe(receipt("ship", "Goal set: ship"));
    observer.pause();
    expect(await observer.read()).toMatchObject({ objective: "ship", status: "paused" });
    observer.begin("Continue working toward the current goal.");
    expect(await observer.read()).toMatchObject({ objective: "ship", status: "active" });
  });
  it("folds native durable goal sentinels and excludes achieved or failed goals", () => {
    const entry = (extra: object) => ({
      type: "attachment",
      timestamp: "2026-10-02T00:00:00Z",
      attachment: { type: "goal_status", condition: "ship", met: false, ...extra },
    });
    expect(claudeTranscriptGoal([entry({ sentinel: true })])).toMatchObject({ objective: "ship" });
    expect(claudeTranscriptGoal([entry({}), entry({ met: true })])).toBeNull();
    expect(claudeTranscriptGoal([entry({}), entry({ failed: true })])).toBeNull();
    expect(claudeTranscriptGoal([{ type: "assistant", message: "Goal set: ship" }])).toBeNull();
  });
  it("maps native syntax and rejects unsupported limits and ambiguous conditions", () => {
    expect(prepareClaudeGoal({ type: "set", objective: "ship", status: "active" })).toMatchObject({
      ok: true,
      value: { arguments: { text: "ship" } },
    });
    expect(prepareClaudeGoal({ type: "clear" })).toMatchObject({
      ok: true,
      value: { arguments: { text: "clear" } },
    });
    for (const update of [
      { type: "set", objective: "ship", tokenBudget: 10 },
      { type: "set", objective: "clear" },
      { type: "set", objective: "ship", status: "complete" },
    ] as const)
      expect(prepareClaudeGoal(update)).toMatchObject({ ok: false });
  });
});

describe("Claude native goal controls", () => {
  const goal = { objective: "ship", status: "active" as const, createdAt: 1, updatedAt: 1 };
  it("stops native work before clear and returns the confirmed removal", async () => {
    const stopped = Promise.withResolvers<undefined>();
    let cleared = false;
    const read = vi.fn(async () => ({ ok: true as const, value: cleared ? null : goal }));
    const start = vi.fn(async () => {
      cleared = true;
      return { ok: true as const, value: null };
    });
    const control = controlClaudeGoal(
      { type: "clear" },
      {
        read,
        active: () => ({
          turnId: hostTurnIdSchema.parse("worker"),
          held: false,
          completion: stopped.promise,
        }),
        cancel: async () => ({ ok: true, value: null }),
        canStart: () => true,
        timeoutMs: 1000,
        start,
      },
    );
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    expect(start).not.toHaveBeenCalled();
    stopped.resolve(undefined);
    expect(await control).toEqual({ ok: true, value: null });
    expect(start).toHaveBeenCalledWith("/goal clear", true);
  });
  it("resumes a retained native hook without setting a replacement goal", async () => {
    let status: "active" | "paused" = "paused";
    const start = vi.fn(async () => {
      status = "active";
      return { ok: true as const, value: null };
    });
    const result = await controlClaudeGoal(
      { type: "set", status: "active" },
      {
        read: async () => ({ ok: true, value: { ...goal, status } }),
        active: () => null,
        cancel: vi.fn(),
        canStart: () => true,
        timeoutMs: 100,
        start,
      },
    );
    expect(start).toHaveBeenCalledWith("Continue working toward the current goal.", false);
    expect(result).toMatchObject({ ok: true, value: { objective: "ship", status: "active" } });
  });
  it("rejects background pause and bounded cancellation failure without submitting clear", async () => {
    const start = vi.fn();
    const base = {
      read: async () => ({ ok: true as const, value: goal }),
      active: () => ({
        turnId: hostTurnIdSchema.parse("worker"),
        held: true,
        completion: new Promise<void>(() => undefined),
      }),
      cancel: async () => ({ ok: true as const, value: null }),
      canStart: () => true,
      timeoutMs: 1,
      start,
    };
    expect(await controlClaudeGoal({ type: "set", status: "paused" }, base)).toMatchObject({
      ok: false,
      error: { code: "unsupported" },
    });
    expect(await controlClaudeGoal({ type: "clear" }, base)).toMatchObject({
      ok: false,
      error: { code: "nativeFailure" },
    });
    expect(start).not.toHaveBeenCalled();
  });
});
