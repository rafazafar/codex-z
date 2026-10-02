import type { HostTurnId } from "@codex-z/shared-contracts";
import type { HarnessGoal, HarnessGoalUpdate, HarnessResult } from "@codex-z/harness-adapter";

const clearAliases = new Set(["clear", "stop", "off", "reset", "none", "cancel"]);
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function unsupported(message: string): HarnessResult<never> {
  return { ok: false, error: { code: "unsupported", message, retryable: false } };
}

/** Preserve the native non-interactive goal syntax; never add an evaluator prompt. */
export function prepareClaudeGoal(
  update: HarnessGoalUpdate,
): HarnessResult<{ commandId: string; arguments: { text: string } }> {
  if (update.type === "clear")
    return { ok: true, value: { commandId: "claude.goal", arguments: { text: "clear" } } };
  if (update.tokenBudget != null)
    return unsupported("Claude Code does not enforce a native goal token budget");
  if (update.status && update.status !== "active")
    return unsupported(
      "Claude Code headless goals support set, read, and clear. Interrupt the Turn to stop work",
    );
  const objective = update.objective?.trim();
  if (!objective || clearAliases.has(objective.toLowerCase()) || objective.length > 4000)
    return unsupported(
      "Claude Code requires a goal condition of 1 to 4000 characters, distinct from its clear aliases",
    );
  return { ok: true, value: { commandId: "claude.goal", arguments: { text: objective } } };
}

/** Read native durable goal attachments, including clear and failure tombstones. */
export function claudeTranscriptGoal(entries: readonly unknown[]): HarnessGoal | null {
  let goal: HarnessGoal | null = null;
  for (const entry of entries) {
    if (!record(entry) || entry.type !== "attachment" || !record(entry.attachment)) continue;
    const state = entry.attachment;
    if (state.type !== "goal_status" || typeof state.condition !== "string") continue;
    const time = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) / 1000 : NaN;
    if (!Number.isFinite(time)) continue;
    if (state.met === true || state.failed === true) {
      goal = null;
      continue;
    }
    const previous: HarnessGoal | null = goal as HarnessGoal | null;
    goal = {
      objective: state.condition,
      status: "active",
      createdAt:
        previous?.objective === state.condition && state.sentinel !== true
          ? previous.createdAt
          : Math.floor(time),
      updatedAt: Math.floor(time),
    };
  }
  return goal;
}

/** Native SDK state. Only native goal records and synthetic local-command receipts can change it. */
export class ClaudeGoalObserver {
  #goal: HarnessGoal | null = null;
  #pending: { promise: Promise<void>; resolve(): void; reject(error: Error): void } | null = null;
  constructor(readonly publish: (goal: HarnessGoal | null) => void) {}
  restore(goal: HarnessGoal | null): void {
    this.#goal = goal ? { ...goal, status: "paused" } : null;
    if (this.#goal) this.publish(this.#goal);
  }
  pause(): void {
    if (this.#goal && this.#goal.status === "active")
      this.#change({ ...this.#goal, status: "paused", updatedAt: Math.floor(Date.now() / 1000) });
  }
  begin(text: string): void {
    if (!/^\s*\/goal(?:\s|$)/u.test(text)) {
      this.#pending = null;
      if (this.#goal?.status === "paused")
        this.#change({ ...this.#goal, status: "active", updatedAt: Math.floor(Date.now() / 1000) });
      return;
    }
    const pending = Promise.withResolvers<undefined>();
    this.#pending = {
      promise: pending.promise,
      resolve: () => pending.resolve(undefined),
      reject: pending.reject,
    };
    void pending.promise.catch(() => undefined);
  }
  async read(): Promise<HarnessGoal | null> {
    const pending = this.#pending;
    if (pending) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          pending.promise,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Claude Code did not confirm the goal command")),
              5000,
            );
          }),
        ]);
      } catch (error) {
        if (this.#pending === pending) this.#pending = null;
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    return this.#goal;
  }
  settle(error?: Error): void {
    const pending = this.#pending;
    if (error) pending?.reject(error);
    else pending?.reject(new Error("Claude Code did not confirm the goal command"));
  }
  observe(message: unknown): void {
    if (!record(message)) return;
    if (message.type === "active_goal") {
      const value = message.value;
      if (value === null) this.#change(null);
      else if (
        record(value) &&
        typeof value.condition === "string" &&
        value.condition.trim() &&
        typeof value.set_at === "number" &&
        Number.isSafeInteger(value.set_at) &&
        value.set_at >= 0
      ) {
        const createdAt = Math.floor(value.set_at / 1000);
        this.#change({
          objective: value.condition,
          status: "active",
          createdAt,
          updatedAt: Math.floor(Date.now() / 1000),
        });
      }
      return;
    }
    if (
      message.type !== "assistant" ||
      !record(message.local_command_run) ||
      message.local_command_run.command !== "goal" ||
      !record(message.message) ||
      message.message.model !== "<synthetic>" ||
      !Array.isArray(message.message.content)
    )
      return;
    const text = message.message.content
      .filter(record)
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    const args =
      typeof message.local_command_run.args === "string"
        ? message.local_command_run.args.trim()
        : "";
    const stamp =
      typeof message.timestamp === "string" ? Date.parse(message.timestamp) : Date.now();
    const at = Math.floor((Number.isFinite(stamp) ? stamp : Date.now()) / 1000);
    if (args && !clearAliases.has(args.toLowerCase()) && text.startsWith("Goal set: "))
      this.#change(
        {
          objective: text.slice("Goal set: ".length),
          status: "active",
          createdAt: at,
          updatedAt: at,
        },
        true,
      );
    else if (text === "No goal set" || text.startsWith("Goal cleared: ")) this.#change(null, true);
    else if (args) this.settle(new Error(text || "Claude Code rejected the goal command"));
    else this.#confirm(); // Status does not change an already observed goal.
  }
  #confirm(): void {
    const pending = this.#pending;
    this.#pending = null;
    pending?.resolve();
  }
  #change(goal: HarnessGoal | null, confirmed = false): void {
    this.#goal = goal;
    this.publish(goal);
    if (confirmed) this.#confirm();
  }
}

/** Map user controls to the documented headless interrupt and retained-hook resume path. */
export async function controlClaudeGoal(
  update: HarnessGoalUpdate,
  native: {
    read(): Promise<HarnessResult<HarnessGoal | null>>;
    active(): { turnId: HostTurnId; held: boolean; completion: Promise<void> } | null;
    cancel(turnId: HostTurnId): Promise<HarnessResult<unknown>>;
    canStart(): boolean;
    timeoutMs: number;
    start(text: string, clear: boolean): Promise<HarnessResult<unknown>>;
  },
): Promise<HarnessResult<HarnessGoal | null>> {
  if (
    update.type === "set" &&
    (update.objective !== undefined ||
      update.tokenBudget != null ||
      !["active", "paused"].includes(update.status ?? ""))
  )
    return unsupported(
      "Claude native controls support pause, resume, and clear without a token budget",
    );
  const before = await native.read();
  if (!before.ok) return before;
  if (!before.value && update.type === "set")
    return {
      ok: false,
      error: { code: "invalidState", message: "No native Claude goal is set", retryable: false },
    };
  const active = native.active();
  if (update.type === "set" && update.status === "paused") {
    if (active?.held)
      return unsupported(
        "Claude headless goals cannot pause native background completion delivery; clear the goal to remove its evaluator",
      );
    if (!active && before.value?.status === "active")
      return unsupported("Claude cannot pause native goal work before its worker Turn is observed");
    if (active) {
      const cancelled = await native.cancel(active.turnId);
      if (!cancelled.ok) return cancelled;
    }
    return native.read();
  }
  if (active) {
    if (update.type === "set")
      return {
        ok: false,
        error: {
          code: "sessionBusy",
          message: "Claude goal work is already running",
          retryable: true,
        },
      };
    const cancelled = await native.cancel(active.turnId);
    if (!cancelled.ok) return cancelled;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        active.completion,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Claude Turn did not stop before goal removal")),
            native.timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "nativeFailure",
          message: error instanceof Error ? error.message : "Claude goal control failed",
          retryable: true,
        },
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  if (!native.canStart())
    return {
      ok: false,
      error: {
        code: "sessionBusy",
        message: "Claude Session cannot change goal during another operation",
        retryable: true,
      },
    };
  const clear = update.type === "clear";
  const started = await native.start(
    clear ? "/goal clear" : "Continue working toward the current goal.",
    clear,
  );
  if (!started.ok) return started;
  return native.read();
}
