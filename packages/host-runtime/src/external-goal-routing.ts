import type {
  HarnessGoal,
  HarnessGoalUpdate,
  HarnessResult,
  HarnessSession,
} from "@codex-z/harness-adapter";
import type { JsonObject } from "@codex-z/protocol-core";

export class ExternalGoalError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

const statuses = new Set([
  "active",
  "paused",
  "blocked",
  "usageLimited",
  "budgetLimited",
  "complete",
]);

/** Decode the installed Desktop goal protocol. Do not silently discard native limits. */
export function decodeExternalGoalUpdate(method: string, params: JsonObject): HarnessGoalUpdate {
  const allowed =
    method === "thread/goal/clear"
      ? ["threadId"]
      : ["threadId", "objective", "status", "tokenBudget"];
  if (Object.keys(params).some((key) => !allowed.includes(key)))
    throw new ExternalGoalError(-32602, "Unknown goal request field");
  if (method === "thread/goal/clear") return { type: "clear" };
  if (
    params.objective !== undefined &&
    params.objective !== null &&
    (typeof params.objective !== "string" || !params.objective.trim())
  )
    throw new ExternalGoalError(-32602, "Goal objective must be nonempty text");
  if (
    params.status !== undefined &&
    params.status !== null &&
    (typeof params.status !== "string" || !statuses.has(params.status))
  )
    throw new ExternalGoalError(-32602, "Invalid goal status");
  if (
    params.tokenBudget !== undefined &&
    params.tokenBudget !== null &&
    (typeof params.tokenBudget !== "number" ||
      !Number.isSafeInteger(params.tokenBudget) ||
      params.tokenBudget <= 0)
  )
    throw new ExternalGoalError(-32602, "Goal token budget must be a positive integer");
  return {
    type: "set",
    ...(typeof params.objective === "string" ? { objective: params.objective } : {}),
    ...(typeof params.status === "string"
      ? { status: params.status as HarnessGoal["status"] }
      : {}),
    ...(Object.hasOwn(params, "tokenBudget")
      ? { tokenBudget: params.tokenBudget as number | null }
      : {}),
  };
}

/** Desktop requires counters. Zero means no native counter was supplied; never estimate spend. */
export function desktopGoal(threadId: string, goal: HarnessGoal): JsonObject {
  return {
    threadId,
    objective: goal.objective,
    status: goal.status,
    tokenBudget: goal.tokenBudget ?? null,
    tokensUsed: goal.tokensUsed ?? 0,
    timeUsedSeconds: goal.timeUsedSeconds ?? 0,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

function value<T>(result: HarnessResult<T>): T {
  if (!result.ok)
    throw new ExternalGoalError(
      result.error.code === "unsupported"
        ? -32078
        : result.error.code === "sessionBusy"
          ? -32072
          : -32073,
      result.error.message,
    );
  return result.value;
}

/** Route native Desktop goal requests without invoking the official runtime or a Host loop. */
export async function routeExternalGoal(
  method: string,
  params: JsonObject,
  owner: {
    threadId: string;
    session: HarnessSession;
    busy(): boolean;
    confirmed(goal: HarnessGoal | null): void;
    begin(commandId: string, arguments_?: JsonObject): Promise<{ gate: { resolve(): void } }>;
  },
): Promise<JsonObject> {
  const goals = owner.session.goals;
  if (method === "thread/goal/get") {
    const goal = goals ? value(await goals.read()) : null;
    owner.confirmed(goal);
    return { goal: goal ? desktopGoal(owner.threadId, goal) : null };
  }
  if (!goals)
    throw new ExternalGoalError(
      -32078,
      "This Harness does not expose native goal control through its installed interface",
    );
  const update = decodeExternalGoalUpdate(method, params);
  let goal: HarnessGoal | null;
  if (goals.control && (update.type === "clear" || update.objective === undefined)) {
    goal = value(await goals.control(update));
  } else {
    if (owner.busy())
      throw new ExternalGoalError(
        -32072,
        "Interrupt the active Turn before changing its native goal",
      );
    const prepared = value(await goals.prepare(update));
    await owner.begin(prepared.commandId, prepared.arguments);
    goal = value(await goals.read());
  }
  owner.confirmed(goal);
  if (update.type === "clear") {
    if (goal !== null)
      throw new ExternalGoalError(-32073, "Native Harness has not confirmed goal removal");
    return { cleared: true };
  }
  if (!goal) throw new ExternalGoalError(-32073, "Native Harness has not confirmed a goal");
  return { goal: desktopGoal(owner.threadId, goal) };
}
