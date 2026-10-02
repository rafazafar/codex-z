import type { HarnessGoal, HarnessGoalUpdate, HarnessResult } from "@codex-z/harness-adapter";
import type { ModernCommandRemote } from "./commands.js";

export class DeepSeekGoalError extends Error {
  constructor(
    readonly code: "unsupported" | "invalidState",
    message: string,
  ) {
    super(message);
  }
}

export interface DeepSeekNativeGoal {
  id: string;
  revision: number;
  objective: string;
  phase: "active" | "paused" | "blocked" | "complete";
  activation: "armed" | "disarmed";
  createdAt: number;
  updatedAt: number;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseDeepSeekGoal(value: unknown): DeepSeekNativeGoal | null {
  if (value === undefined || value === null) return null;
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    typeof value.objective !== "string" ||
    !value.objective.trim() ||
    typeof value.phase !== "string" ||
    !["active", "paused", "blocked", "complete"].includes(value.phase) ||
    typeof value.activation !== "string" ||
    !["armed", "disarmed"].includes(value.activation) ||
    ![value.createdAt, value.updatedAt].every(
      (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0,
    )
  )
    throw new Error("DeepSeek Harness returned an invalid native goal");
  return value as unknown as DeepSeekNativeGoal;
}
export function projectDeepSeekGoal(goal: DeepSeekNativeGoal | null): HarnessGoal | null {
  return goal
    ? {
        objective: goal.objective,
        status: goal.phase === "active" && goal.activation === "disarmed" ? "paused" : goal.phase,
        createdAt: Math.floor(goal.createdAt / 1000),
        updatedAt: Math.floor(goal.updatedAt / 1000),
      }
    : null;
}
export async function readDeepSeekGoal(
  remote: ModernCommandRemote,
  agentId: string,
): Promise<DeepSeekNativeGoal | null> {
  const result = await remote.call<unknown>("goals/get", { agentId }, undefined, {
    timeoutMs: 5_000,
  });
  if (!result.ok) throw new Error("DeepSeek Harness cannot read the native goal service");
  return parseDeepSeekGoal(result.value);
}
export function prepareDeepSeekGoal(
  update: HarnessGoalUpdate,
  current: DeepSeekNativeGoal | null,
): HarnessResult<{ commandId: string; arguments: { text: string } }> {
  let text: string;
  if (update.type === "clear") text = "clear";
  else {
    if (update.tokenBudget != null)
      return {
        ok: false,
        error: {
          code: "unsupported",
          message: "DeepSeek native goals use round limits; a token budget is unsupported",
          retryable: false,
        },
      };
    if (update.status && update.status !== "active" && update.status !== "paused")
      return {
        ok: false,
        error: {
          code: "unsupported",
          message: "Native evaluation owns goal completion and blocking",
          retryable: false,
        },
      };
    if (update.objective !== undefined && update.status === "paused")
      return {
        ok: false,
        error: {
          code: "unsupported",
          message: "Edit the native objective and pause it in separate operations",
          retryable: false,
        },
      };
    if (
      update.objective !== undefined &&
      update.status === "active" &&
      current &&
      current.phase !== "complete" &&
      (current.phase !== "active" || current.activation !== "armed")
    )
      return {
        ok: false,
        error: {
          code: "unsupported",
          message: "Resume the native goal before changing its active objective",
          retryable: false,
        },
      };
    if (update.objective !== undefined) {
      const objective = update.objective.trim();
      if (!objective || /^(?:clear|pause|resume|edit)(?:\s|$)/iu.test(objective))
        return {
          ok: false,
          error: {
            code: "invalidRequest",
            message: "Goal condition must be distinct from native control syntax",
            retryable: false,
          },
        };
      text = current && current.phase !== "complete" ? `edit ${objective}` : objective;
    } else if (update.status === "paused") text = "pause";
    else if (update.status === "active") text = "resume";
    else
      return {
        ok: false,
        error: {
          code: "invalidRequest",
          message: "Goal update requires an objective or status",
          retryable: false,
        },
      };
  }
  return { ok: true, value: { commandId: "dsh.goal", arguments: { text } } };
}

/** CAS mutations run through the native goal service, including during a worker Turn. */
export async function controlDeepSeekGoal(
  remote: ModernCommandRemote,
  agentId: string,
  update: HarnessGoalUpdate,
): Promise<HarnessGoal | null> {
  if (
    update.type === "set" &&
    (update.objective !== undefined ||
      update.tokenBudget != null ||
      !["active", "paused"].includes(update.status ?? ""))
  )
    throw new DeepSeekGoalError("unsupported", "Unsupported native goal control");
  const current = await readDeepSeekGoal(remote, agentId);
  if (!current) {
    if (update.type === "clear") return null;
    throw new DeepSeekGoalError("invalidState", "No native goal is set");
  }
  const method =
    update.type === "clear" ? "clear" : update.status === "paused" ? "pause" : "resume";
  const result = await remote.call<unknown>(`goals/${method}`, {
    agentId,
    ref: { id: current.id, revision: current.revision },
  });
  if (!result.ok)
    throw new Error("DeepSeek Harness rejected native goal control; its state may have changed");
  const observed = await readDeepSeekGoal(remote, agentId);
  const confirmed = projectDeepSeekGoal(observed);
  if (
    (method === "clear" && confirmed !== null) ||
    (method !== "clear" && observed?.id !== current.id) ||
    (method === "pause" && confirmed?.status === "active") ||
    (method === "resume" && confirmed?.status !== "active" && confirmed?.status !== "complete")
  )
    throw new DeepSeekGoalError("invalidState", "Native goal changed before control confirmation");
  return confirmed;
}
