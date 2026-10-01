import type { UsageLedgerModelSummary } from "@codex-z/shared-contracts";

export const USAGE_LEDGER_COLUMNS = [
  "model",
  "sessions",
  "turnsPerSession",
  "interruptedRate",
  "msPerSession",
  "costPerSession",
  "tokensPerSession",
] as const;
export type UsageLedgerColumn = (typeof USAGE_LEDGER_COLUMNS)[number];
export type UsageLedgerSort = { column: UsageLedgerColumn; descending: boolean };

/** One Model's per-Session averages. A metric is null when nothing was reported for it. */
export interface UsageLedgerRow {
  readonly summary: UsageLedgerModelSummary;
  readonly model: string;
  readonly sessions: number;
  /** Turns the user had to send per Session they drove. */
  readonly turnsPerSession: number | null;
  readonly interruptedRate: number | null;
  readonly msPerSession: number | null;
  readonly costPerSession: number | null;
  readonly tokensPerSession: number | null;
}

function ratio(total: number, count: number): number | null {
  return count > 0 ? total / count : null;
}

export function usageLedgerRow(summary: UsageLedgerModelSummary): UsageLedgerRow {
  return {
    summary,
    model: summary.modelLabel ?? summary.modelId ?? "",
    sessions: summary.sessions,
    turnsPerSession: ratio(summary.userTurns, summary.userSessions),
    interruptedRate: ratio(summary.interruptedTurns, summary.turns),
    msPerSession: ratio(summary.durationMs, summary.sessions),
    costPerSession: ratio(summary.costUsd, summary.costSessions),
    tokensPerSession: ratio(summary.totalTokens, summary.tokenSessions),
  };
}

/** Rows without a value for the sorted metric always come last. */
export function sortUsageLedgerRows(
  rows: readonly UsageLedgerRow[],
  sort: UsageLedgerSort,
): UsageLedgerRow[] {
  const direction = sort.descending ? -1 : 1;
  return rows.toSorted((left, right) => {
    if (sort.column === "model") {
      return (
        direction *
        (left.summary.harnessName.localeCompare(right.summary.harnessName) ||
          left.model.localeCompare(right.model))
      );
    }
    const a = left[sort.column];
    const b = right[sort.column];
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    return direction * (a - b) || right.summary.lastTurnAtMs - left.summary.lastTurnAtMs;
  });
}

export function formatUsageCost(value: number | null): string {
  if (value === null) return "—";
  if (value > 0 && value < 0.01) return "<$0.01";
  return `$${value.toFixed(value < 100 ? 2 : 0)}`;
}

export function formatUsageCount(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(value >= 1e5 ? 0 : 1)}k`;
  return String(Math.round(value));
}

export function formatUsageAverage(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export function formatUsagePercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function formatUsageDuration(ms: number | null): string {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
