import type { JsonObject } from "@codex-z/shared-contracts";
import type { HarnessResult } from "./text-session.js";

/** Facts read from the Native Session. Omit counters the Harness does not report. */
export interface HarnessGoal {
  objective: string;
  status: "active" | "paused" | "blocked" | "usageLimited" | "budgetLimited" | "complete";
  createdAt: number;
  updatedAt: number;
  tokenBudget?: number | null;
  tokensUsed?: number;
  timeUsedSeconds?: number;
}

export type HarnessGoalUpdate =
  | { type: "set"; objective?: string; status?: HarnessGoal["status"]; tokenBudget?: number | null }
  | { type: "clear" };

/** Resolve a native command before Host Turn admission. Never change the goal here. */
export interface HarnessGoalCapability {
  read(): Promise<HarnessResult<HarnessGoal | null>>;
  /** Native control path. Publish any native Turns it starts. Must work during native work. */
  control?(update: HarnessGoalUpdate): Promise<HarnessResult<HarnessGoal | null>>;
  prepare(update: HarnessGoalUpdate): Promise<
    HarnessResult<{
      commandId: string;
      arguments?: JsonObject;
    }>
  >;
}
