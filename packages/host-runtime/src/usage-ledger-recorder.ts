import type { HostUsage } from "@codex-z/harness-adapter";
import type { UsageLedgerSummaryParams, UsageLedgerSummaryResult } from "@codex-z/shared-contracts";

import {
  summarizeUsageLedger,
  usageCounters,
  usageDelta,
  type UsageCounters,
  type UsageLedgerStore,
  type UsageLedgerTurnRecord,
} from "./usage-ledger.js";

const OFFICIAL_HARNESS_ID = "codex";
const MAX_TRACKED_THREADS = 2_000;
const MAX_PENDING_RESPONSES = 1_000;

type TurnOutcome = UsageLedgerTurnRecord["outcome"];

interface ActiveTurn {
  turnId: string;
  startedAtMs: number;
  /** Native counters just before the Turn; null when the Session had reported none. */
  startUsage: UsageCounters | null;
  hasPriorTurns: boolean;
  autonomous: boolean;
  /** Official Threads only: latest cumulative counters observed during the Turn. */
  endUsage?: UsageCounters;
}

interface ThreadState {
  cumulative?: UsageCounters;
  active?: ActiveTurn;
  /** Last written Turn and its baseline, kept so usage that arrives late can amend it. */
  last?: { record: UsageLedgerTurnRecord; base: UsageCounters | null };
  /** Official Threads only. */
  modelId?: string;
  thinkingOptionId?: string;
  cwd?: string;
  ephemeral?: boolean;
  agent?: boolean;
}

export interface ExternalTurnStart {
  threadId: string;
  turnId: string;
  usage: HostUsage | null;
  hasPriorTurns: boolean;
  autonomous?: boolean;
}

export interface ExternalTurnCompletion {
  threadId: string;
  turnId: string;
  harnessId: string;
  cwd: string;
  modelId?: string;
  modelLabel?: string;
  thinkingOptionId?: string;
  outcome: TurnOutcome;
  durationMs: number | null;
  usage: HostUsage | null;
}

export interface UsageLedgerRecorderOptions {
  store: UsageLedgerStore;
  harnessName(harnessId: string): string;
  /** Delegated children; their Turns are not counted as user Turns. */
  isAgentThread(threadId: string): Promise<boolean>;
  diagnose(error: unknown): void;
  now?: () => number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function tokenBreakdown(value: unknown): UsageCounters | null {
  if (!isRecord(value)) return null;
  const counters: UsageCounters = {};
  for (const field of [
    "inputTokens",
    "cachedInputTokens",
    "cacheWriteInputTokens",
    "outputTokens",
    "reasoningOutputTokens",
    "totalTokens",
  ] as const) {
    const count = value[field];
    if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0) {
      counters[field] = count;
    }
  }
  return Object.keys(counters).length > 0 ? counters : null;
}

function officialOutcome(status: unknown): TurnOutcome {
  if (status === "failed") return "failed";
  return status === "interrupted" || status === "cancelled" ? "interrupted" : "completed";
}

/**
 * Turns one Host's Turn lifecycle and usage observations into ledger records.
 * Callers hand over plain values and never wait: work runs in arrival order on
 * an internal queue, and a ledger failure is diagnosed without affecting the Turn.
 */
export class UsageLedgerRecorder {
  readonly #options: UsageLedgerRecorderOptions;
  readonly #threads = new Map<string, ThreadState>();
  readonly #pendingThreadResponses = new Set<unknown>();
  #persisted: Promise<Map<string, UsageCounters>> | undefined;
  #queue: Promise<void> = Promise.resolve();

  constructor(options: UsageLedgerRecorderOptions) {
    this.#options = options;
  }

  externalTurnStarted(input: ExternalTurnStart): void {
    const startUsage = usageCounters(input.usage);
    const startedAtMs = this.#now();
    this.#enqueue(() => {
      const state = this.#thread(input.threadId);
      if (state.active?.turnId === input.turnId) {
        state.active.autonomous ||= input.autonomous === true;
        return;
      }
      state.active = {
        turnId: input.turnId,
        startedAtMs,
        startUsage,
        hasPriorTurns: input.hasPriorTurns,
        autonomous: input.autonomous === true,
      };
    });
  }

  externalTurnCompleted(input: ExternalTurnCompletion): void {
    const completedAtMs = this.#now();
    const end = usageCounters(input.usage);
    this.#enqueue(async () => {
      const state = this.#thread(input.threadId);
      const active = state.active?.turnId === input.turnId ? state.active : undefined;
      delete state.active;
      await this.#write(state, {
        threadId: input.threadId,
        turnId: input.turnId,
        harnessId: input.harnessId,
        modelId: input.modelId,
        modelLabel: input.modelLabel,
        thinkingOptionId: input.thinkingOptionId,
        cwd: input.cwd,
        outcome: input.outcome,
        startedAtMs:
          input.durationMs !== null
            ? Math.max(0, completedAtMs - input.durationMs)
            : (active?.startedAtMs ?? completedAtMs),
        completedAtMs,
        autonomous: active?.autonomous === true,
        end,
        base: await this.#externalBase(input.threadId, state, active),
      });
    });
  }

  /** `turnId` is the Turn the Host attributes this snapshot to, if any. */
  externalUsageChanged(input: {
    threadId: string;
    turnId: string | null;
    usage: HostUsage | null;
  }): void {
    const end = usageCounters(input.usage);
    if (!end || !input.turnId) return;
    this.#enqueue(() => this.#amend(input.threadId, input.turnId as string, end));
  }

  /** Native Codex requests carry the Model a Thread or Turn will use. */
  officialRequest(request: { id: unknown; method: string; params?: unknown }): void {
    if (
      request.method === "thread/start" ||
      request.method === "thread/resume" ||
      request.method === "thread/fork"
    ) {
      if (this.#pendingThreadResponses.size >= MAX_PENDING_RESPONSES) {
        this.#pendingThreadResponses.clear();
      }
      this.#pendingThreadResponses.add(request.id);
      return;
    }
    if (request.method !== "turn/start" || !isRecord(request.params)) return;
    const threadId = text(request.params.threadId);
    const modelId = text(request.params.model);
    const thinkingOptionId = text(request.params.effort);
    if (!threadId || (!modelId && !thinkingOptionId)) return;
    this.#enqueue(() => {
      const state = this.#thread(threadId);
      if (modelId) state.modelId = modelId;
      if (thinkingOptionId) state.thinkingOptionId = thinkingOptionId;
    });
  }

  officialOutput(value: unknown): void {
    if (!isRecord(value)) return;
    if ("id" in value && this.#pendingThreadResponses.delete(value.id)) {
      const result = isRecord(value.result) ? value.result : null;
      if (result) this.#learnOfficialThread(result.thread, result.model, result.reasoningEffort);
      return;
    }
    const params = isRecord(value.params) ? value.params : null;
    if (!params || typeof value.method !== "string") return;
    if (value.method === "thread/started") {
      this.#learnOfficialThread(params.thread);
      return;
    }
    const threadId = text(params.threadId);
    if (!threadId) return;
    if (value.method === "thread/settings/updated") {
      const settings = isRecord(params.threadSettings) ? params.threadSettings : null;
      const modelId = text(settings?.model);
      const thinkingOptionId = text(settings?.effort);
      this.#enqueue(() => {
        const state = this.#thread(threadId);
        if (modelId) state.modelId = modelId;
        if (thinkingOptionId) state.thinkingOptionId = thinkingOptionId;
      });
      return;
    }
    if (value.method === "thread/tokenUsage/updated") {
      const tokenUsage = isRecord(params.tokenUsage) ? params.tokenUsage : null;
      const total = tokenBreakdown(tokenUsage?.total);
      const turnId = text(params.turnId);
      if (!total || !turnId) return;
      const last = tokenBreakdown(tokenUsage?.last);
      this.#enqueue(() => this.#officialUsage(threadId, turnId, total, last));
      return;
    }
    const turn = isRecord(params.turn) ? params.turn : null;
    const turnId = text(turn?.id);
    if (!turn || !turnId) return;
    if (value.method === "turn/started") {
      const startedAtMs =
        typeof turn.startedAt === "number" && turn.startedAt > 0
          ? Math.round(turn.startedAt * 1000)
          : this.#now();
      this.#enqueue(() => {
        const state = this.#thread(threadId);
        if (state.active?.turnId === turnId) return;
        state.active = {
          turnId,
          startedAtMs,
          startUsage: state.cumulative ?? null,
          hasPriorTurns: true,
          autonomous: false,
        };
      });
      return;
    }
    if (value.method !== "turn/completed") return;
    const completedAtMs = this.#now();
    const durationMs =
      typeof turn.durationMs === "number" && turn.durationMs >= 0 ? turn.durationMs : null;
    const outcome = officialOutcome(turn.status);
    this.#enqueue(async () => {
      const state = this.#thread(threadId);
      const active = state.active?.turnId === turnId ? state.active : undefined;
      delete state.active;
      if (state.ephemeral) return;
      await this.#write(state, {
        threadId,
        turnId,
        harnessId: OFFICIAL_HARNESS_ID,
        modelId: state.modelId,
        thinkingOptionId: state.thinkingOptionId,
        cwd: state.cwd,
        outcome,
        startedAtMs:
          durationMs !== null
            ? Math.max(0, completedAtMs - Math.round(durationMs))
            : (active?.startedAtMs ?? completedAtMs),
        completedAtMs,
        autonomous: false,
        agent: state.agent,
        end: active?.endUsage ?? null,
        base: active?.startUsage ?? null,
      });
    });
  }

  async summary(params: UsageLedgerSummaryParams): Promise<UsageLedgerSummaryResult> {
    await this.#queue;
    return summarizeUsageLedger(await this.#options.store.readVisible(), {
      ...(params.sinceMs === undefined ? {} : { sinceMs: params.sinceMs }),
      harnessName: (harnessId) => this.#options.harnessName(harnessId),
    });
  }

  /** Clears the visible history. Cumulative baselines survive so the next Turn is not over-counted. */
  async reset(): Promise<void> {
    await this.#queue;
    await this.#options.store.reset((this.#options.now ?? Date.now)());
  }

  /** Resolves once every observation accepted so far has been recorded. */
  async settled(): Promise<void> {
    await this.#queue;
  }

  #now(): number {
    return Math.round((this.#options.now ?? Date.now)());
  }

  #enqueue(task: () => void | Promise<void>): void {
    this.#queue = this.#queue.then(task).catch((error: unknown) => this.#options.diagnose(error));
  }

  #thread(threadId: string): ThreadState {
    let state = this.#threads.get(threadId);
    if (state) return state;
    if (this.#threads.size >= MAX_TRACKED_THREADS) {
      for (const [id, candidate] of this.#threads) {
        if (candidate.active) continue;
        this.#threads.delete(id);
        break;
      }
    }
    state = {};
    this.#threads.set(threadId, state);
    return state;
  }

  #learnOfficialThread(thread: unknown, model?: unknown, effort?: unknown): void {
    if (!isRecord(thread)) return;
    const threadId = text(thread.id);
    if (!threadId) return;
    const modelId = text(model) ?? text(thread.model);
    const thinkingOptionId = text(effort) ?? text(thread.reasoningEffort);
    const cwd = text(thread.cwd);
    const ephemeral = thread.ephemeral === true;
    const agent =
      text(thread.parentThreadId) !== undefined ||
      (isRecord(thread.source) && "subAgent" in thread.source);
    this.#enqueue(() => {
      const state = this.#thread(threadId);
      if (modelId) state.modelId = modelId;
      if (thinkingOptionId) state.thinkingOptionId = thinkingOptionId;
      if (cwd) state.cwd = cwd;
      state.ephemeral = ephemeral;
      state.agent = agent;
    });
  }

  async #officialUsage(
    threadId: string,
    turnId: string,
    total: UsageCounters,
    last: UsageCounters | null,
  ): Promise<void> {
    const state = this.#thread(threadId);
    const active = state.active;
    if (active?.turnId !== turnId) {
      await this.#amend(threadId, turnId, total);
      state.cumulative = total;
      return;
    }
    if (!active.startUsage && active.endUsage === undefined) {
      // First report for a Thread this Host has not tracked: the counters
      // before the Turn are the new total minus the request that produced it.
      active.startUsage = last
        ? usageDelta(total, last)
        : ((await this.#persistedCumulative()).get(threadId) ?? null);
    }
    active.endUsage = total;
  }

  async #externalBase(
    threadId: string,
    state: ThreadState,
    active: ActiveTurn | undefined,
  ): Promise<UsageCounters | null> {
    if (active?.startUsage) return active.startUsage;
    if (state.cumulative) return state.cumulative;
    const persisted = (await this.#persistedCumulative()).get(threadId);
    if (persisted) return persisted;
    // A new Thread starts from zero. Otherwise earlier Turns may already be
    // in the native counters, and the first Turn's share cannot be separated.
    return active && !active.hasPriorTurns ? {} : null;
  }

  #persistedCumulative(): Promise<Map<string, UsageCounters>> {
    this.#persisted ??= this.#options.store.read().then(
      (records) => {
        const byThread = new Map<string, UsageCounters>();
        for (const record of records) {
          if (record.cumulative) byThread.set(record.threadId, record.cumulative);
        }
        return byThread;
      },
      (error: unknown) => {
        this.#options.diagnose(error);
        return new Map<string, UsageCounters>();
      },
    );
    return this.#persisted;
  }

  async #write(
    state: ThreadState,
    turn: {
      threadId: string;
      turnId: string;
      harnessId: string;
      modelId?: string | undefined;
      modelLabel?: string | undefined;
      thinkingOptionId?: string | undefined;
      cwd?: string | undefined;
      outcome: TurnOutcome;
      startedAtMs: number;
      completedAtMs: number;
      autonomous: boolean;
      agent?: boolean | undefined;
      end: UsageCounters | null;
      base: UsageCounters | null;
    },
  ): Promise<void> {
    const agent =
      turn.agent === true || (await this.#options.isAgentThread(turn.threadId).catch(() => false));
    const record: UsageLedgerTurnRecord = {
      v: 1,
      threadId: turn.threadId,
      turnId: turn.turnId,
      harnessId: turn.harnessId,
      ...(turn.modelId ? { modelId: turn.modelId } : {}),
      ...(turn.modelLabel ? { modelLabel: turn.modelLabel } : {}),
      ...(turn.thinkingOptionId ? { thinkingOptionId: turn.thinkingOptionId } : {}),
      origin: turn.autonomous ? "autonomous" : agent ? "agent" : "user",
      outcome: turn.outcome,
      startedAtMs: turn.startedAtMs,
      completedAtMs: turn.completedAtMs,
      ...(turn.cwd ? { cwd: turn.cwd } : {}),
      ...(turn.end && turn.base ? { usage: usageDelta(turn.end, turn.base) } : {}),
      ...(turn.end ? { cumulative: turn.end } : {}),
    };
    if (turn.end) state.cumulative = turn.end;
    state.last = { record, base: turn.base };
    await this.#options.store.append(record);
  }

  /** Usage reported after a Turn ended still belongs to that Turn. */
  async #amend(threadId: string, turnId: string, end: UsageCounters): Promise<void> {
    const state = this.#threads.get(threadId);
    const last = state?.last;
    if (!state || !last || last.record.turnId !== turnId || state.active?.turnId === turnId) return;
    if (JSON.stringify(last.record.cumulative) === JSON.stringify(end)) return;
    const record: UsageLedgerTurnRecord = {
      ...last.record,
      ...(last.base ? { usage: usageDelta(end, last.base) } : {}),
      cumulative: end,
    };
    state.cumulative = end;
    state.last = { record, base: last.base };
    if (state.active) state.active.startUsage = end;
    await this.#options.store.append(record);
  }
}
