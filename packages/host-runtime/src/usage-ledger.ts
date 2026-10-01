import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { HostUsage } from "@codex-z/harness-adapter";
import type { UsageLedgerModelSummary, UsageLedgerSummaryResult } from "@codex-z/shared-contracts";
import { z } from "zod";

import { defaultMappingStoreDirectory } from "./external-thread-repository.js";
import { estimateApiCostUsd } from "./usage-pricing.js";

/** Cumulative Native Session counters. Other HostUsage fields are point-in-time gauges. */
const COUNTER_FIELDS = [
  "inputTokens",
  "cachedInputTokens",
  "cacheWriteInputTokens",
  "outputTokens",
  "reasoningOutputTokens",
  "totalTokens",
  "totalCostUsd",
  "totalCredits",
] as const satisfies ReadonlyArray<keyof HostUsage>;

const counterSchema = z.number().finite().nonnegative().optional();
const usageCountersSchema = z.object({
  inputTokens: counterSchema,
  cachedInputTokens: counterSchema,
  cacheWriteInputTokens: counterSchema,
  outputTokens: counterSchema,
  reasoningOutputTokens: counterSchema,
  totalTokens: counterSchema,
  totalCostUsd: counterSchema,
  totalCredits: counterSchema,
});
export type UsageCounters = z.infer<typeof usageCountersSchema>;

const timestampSchema = z.number().int().nonnegative();

/**
 * One completed Turn. It holds identifiers, timing and counters only — never
 * prompts, Transcript text or Tool arguments.
 */
export const usageLedgerTurnRecordSchema = z.object({
  v: z.literal(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  harnessId: z.string().min(1),
  modelId: z.string().min(1).optional(),
  modelLabel: z.string().min(1).optional(),
  thinkingOptionId: z.string().min(1).optional(),
  /** `agent` covers delegated and subagent Threads; `autonomous` Turns start without input. */
  origin: z.enum(["user", "agent", "autonomous"]),
  outcome: z.enum(["completed", "failed", "interrupted"]),
  startedAtMs: timestampSchema,
  completedAtMs: timestampSchema,
  cwd: z.string().optional(),
  /** What this Turn added. Absent when the Harness reported nothing or the baseline is unknown. */
  usage: usageCountersSchema.optional(),
  /** Native Session counters after this Turn; the baseline for the next one. */
  cumulative: usageCountersSchema.optional(),
});
export type UsageLedgerTurnRecord = z.infer<typeof usageLedgerTurnRecordSchema>;

export function usageCounters(usage: HostUsage | null | undefined): UsageCounters | null {
  if (!usage) return null;
  const counters: UsageCounters = {};
  for (const field of COUNTER_FIELDS) {
    const value = usage[field];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) counters[field] = value;
  }
  return Object.keys(counters).length > 0 ? counters : null;
}

/**
 * A counter lower than its baseline means the native counter restarted (for
 * example a resumed process that counts from zero), so the whole value belongs
 * to this Turn.
 */
export function usageDelta(end: UsageCounters, base: UsageCounters): UsageCounters {
  const delta: UsageCounters = {};
  for (const field of COUNTER_FIELDS) {
    const value = end[field];
    if (value === undefined) continue;
    const difference = value - (base[field] ?? 0);
    const added = difference < 0 ? value : difference;
    delta[field] = field === "totalCostUsd" ? Math.round(added * 1e6) / 1e6 : added;
  }
  return delta;
}

export function defaultUsageLedgerFile(environment: NodeJS.ProcessEnv): string {
  return path.join(
    path.dirname(defaultMappingStoreDirectory(environment)),
    "usage-ledger",
    "turns.jsonl",
  );
}

/** Append-only JSON Lines. A later line for the same Thread and Turn replaces the earlier one. */
export class UsageLedgerStore {
  #tail: Promise<void> = Promise.resolve();

  constructor(readonly file: string) {}

  append(record: UsageLedgerTurnRecord): Promise<void> {
    const line = `${JSON.stringify(usageLedgerTurnRecordSchema.parse(record))}\n`;
    const write = this.#tail.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
      await appendFile(this.file, line, { encoding: "utf8", mode: 0o600 });
    });
    this.#tail = write.catch(() => undefined);
    return write;
  }

  async read(): Promise<UsageLedgerTurnRecord[]> {
    await this.#tail;
    let text: string;
    try {
      text = await readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const byTurn = new Map<string, UsageLedgerTurnRecord>();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        // A torn or foreign line must not hide the rest of the ledger.
        continue;
      }
      const parsed = usageLedgerTurnRecordSchema.safeParse(value);
      if (!parsed.success) continue;
      const key = `${parsed.data.threadId}\u0000${parsed.data.turnId}`;
      byTurn.delete(key);
      byTurn.set(key, parsed.data);
    }
    return [...byTurn.values()];
  }
}

interface ModelTotals {
  summary: UsageLedgerModelSummary;
  sessions: Set<string>;
  userSessions: Set<string>;
  tokenSessions: Set<string>;
  costSessions: Set<string>;
}

function turnTokens(usage: UsageCounters): number | null {
  if (usage.totalTokens !== undefined) return usage.totalTokens;
  if (usage.inputTokens === undefined && usage.outputTokens === undefined) return null;
  return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}

export function summarizeUsageLedger(
  records: readonly UsageLedgerTurnRecord[],
  options: { sinceMs?: number; harnessName(harnessId: string): string },
): UsageLedgerSummaryResult {
  const groups = new Map<string, ModelTotals>();
  let recordingSinceMs: number | null = null;
  let turns = 0;
  for (const record of records) {
    if (recordingSinceMs === null || record.completedAtMs < recordingSinceMs) {
      recordingSinceMs = record.completedAtMs;
    }
    if (options.sinceMs !== undefined && record.completedAtMs < options.sinceMs) continue;
    turns += 1;
    // A Model alias can resolve to a new Model after a launch; the label keeps them apart.
    const key = [record.harnessId, record.modelId ?? "", record.modelLabel ?? ""].join("\u0000");
    let group = groups.get(key);
    if (!group) {
      group = {
        summary: {
          harnessId: record.harnessId,
          harnessName: options.harnessName(record.harnessId),
          modelId: record.modelId ?? null,
          modelLabel: record.modelLabel ?? null,
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
        },
        sessions: new Set(),
        userSessions: new Set(),
        tokenSessions: new Set(),
        costSessions: new Set(),
      };
      groups.set(key, group);
    }
    const { summary } = group;
    group.sessions.add(record.threadId);
    summary.turns += 1;
    if (record.origin === "user") {
      group.userSessions.add(record.threadId);
      summary.userTurns += 1;
    }
    if (record.outcome === "interrupted") summary.interruptedTurns += 1;
    if (record.outcome === "failed") summary.failedTurns += 1;
    const durationMs = Math.max(0, record.completedAtMs - record.startedAtMs);
    summary.durationMs += durationMs;
    summary.lastTurnAtMs = Math.max(summary.lastTurnAtMs, record.completedAtMs);
    const usage = record.usage;
    if (!usage) continue;
    if (usage.outputTokens !== undefined && durationMs > 0) {
      summary.timedOutputTokens += Math.round(usage.outputTokens);
      summary.outputTokenDurationMs += durationMs;
    }
    const tokens = turnTokens(usage);
    if (tokens !== null) {
      group.tokenSessions.add(record.threadId);
      summary.tokenTurns += 1;
      summary.totalTokens += Math.round(tokens);
      summary.inputTokens += Math.round(usage.inputTokens ?? 0);
      summary.cachedInputTokens += Math.round(usage.cachedInputTokens ?? 0);
      summary.outputTokens += Math.round(usage.outputTokens ?? 0);
      summary.reasoningOutputTokens += Math.round(usage.reasoningOutputTokens ?? 0);
    }
    const reported = usage.totalCostUsd;
    const estimated =
      reported === undefined
        ? estimateApiCostUsd(record.harnessId, record.modelId, usage)
        : undefined;
    const cost = reported ?? estimated;
    if (cost !== undefined) {
      group.costSessions.add(record.threadId);
      summary.costTurns += 1;
      if (estimated !== undefined) summary.estimatedCostTurns += 1;
      summary.costUsd += cost;
    }
  }
  const models = [...groups.values()].map((group) => ({
    ...group.summary,
    sessions: group.sessions.size,
    userSessions: group.userSessions.size,
    tokenSessions: group.tokenSessions.size,
    costSessions: group.costSessions.size,
    costUsd: Math.round(group.summary.costUsd * 1e6) / 1e6,
  }));
  models.sort(
    (left, right) =>
      right.lastTurnAtMs - left.lastTurnAtMs ||
      left.harnessId.localeCompare(right.harnessId) ||
      (left.modelId ?? "").localeCompare(right.modelId ?? ""),
  );
  return { models, turns, recordingSinceMs };
}
