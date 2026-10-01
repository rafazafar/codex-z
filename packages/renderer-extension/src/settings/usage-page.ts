import type { UsageLedgerSummaryParams, UsageLedgerSummaryResult } from "@codex-z/shared-contracts";

import { RendererMethodUnavailableError } from "../renderer-request-sender.js";
import type { RendererSettingsPageDefinition, RendererSettingsPageMountContext } from "./core.js";
import type { RendererSettingsMessages } from "./localization.js";
import {
  USAGE_LEDGER_COLUMNS,
  formatUsageAverage,
  formatUsageCost,
  formatUsageCount,
  formatUsageDuration,
  formatUsagePercent,
  sortUsageLedgerRows,
  usageLedgerRow,
  type UsageLedgerColumn,
  type UsageLedgerRow,
  type UsageLedgerSort,
} from "./usage-ledger-metrics.js";

export interface UsageLedgerClient {
  readUsageLedgerSummary?(params: UsageLedgerSummaryParams): Promise<UsageLedgerSummaryResult>;
}

export const USAGE_LEDGER_RANGES = ["7d", "30d", "all"] as const;
export type UsageLedgerRange = (typeof USAGE_LEDGER_RANGES)[number];

const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<UsageLedgerRange, number | null> = { "7d": 7, "30d": 30, all: null };

function cellText(row: UsageLedgerRow, column: Exclude<UsageLedgerColumn, "model">): string {
  if (column === "sessions") return String(row.sessions);
  if (column === "turnsPerSession") return formatUsageAverage(row.turnsPerSession);
  if (column === "interruptedRate") return formatUsagePercent(row.interruptedRate);
  if (column === "msPerSession") return formatUsageDuration(row.msPerSession);
  if (column === "costPerSession") {
    const cost = formatUsageCost(row.costPerSession);
    return row.costEstimated && row.costPerSession !== null ? `~${cost}` : cost;
  }
  return formatUsageCount(row.tokensPerSession);
}

export function createUsageSettingsPage(
  messages: RendererSettingsMessages,
  getClient: () => UsageLedgerClient | null = () => null,
  now: () => number = () => Date.now(),
): RendererSettingsPageDefinition {
  const text = messages.usage;
  return Object.freeze({
    id: "usage",
    label: messages.pageLabels.usage,
    icon: "usage",
    mount(context: RendererSettingsPageMountContext) {
      const document = context.content.ownerDocument;
      const heading = document.createElement("h2");
      heading.className = "settings-section-label";
      heading.textContent = messages.pageLabels.usage;
      const description = document.createElement("p");
      description.className = "settings-page-description";
      description.textContent = text.description;

      const ranges = document.createElement("div");
      ranges.className =
        "mb-3 inline-flex gap-0.5 rounded-lg border border-settings-border bg-settings-panel p-0.5";
      ranges.setAttribute("role", "group");
      ranges.setAttribute("aria-label", text.rangeLabel);

      const status = document.createElement("p");
      status.className = "m-0 px-4 py-6 text-[13px] text-settings-muted";
      status.setAttribute("role", "status");

      const table = document.createElement("table");
      table.className = "w-full border-collapse text-left text-[13px]";
      table.setAttribute("aria-label", messages.pageLabels.usage);
      const headRow = table.createTHead().insertRow();
      const body = table.createTBody();
      const scroll = document.createElement("div");
      scroll.className = "overflow-x-auto";
      scroll.append(table);
      const card = document.createElement("div");
      card.className = "rounded-[10px] border border-settings-border bg-settings-panel";
      card.append(status, scroll);

      const notes = document.createElement("ul");
      notes.className = "mt-3 list-disc pl-5 text-xs leading-[18px] text-settings-muted";

      let range: UsageLedgerRange = "30d";
      let sort: UsageLedgerSort | null = null;
      let rows: readonly UsageLedgerRow[] = [];

      const renderRows = (): void => {
        body.replaceChildren();
        for (const row of sort ? sortUsageLedgerRows(rows, sort) : rows) {
          const { summary } = row;
          const tr = body.insertRow();
          tr.className = "border-t border-settings-divider";
          tr.title = text.rowDetail
            .replace("{turns}", String(summary.turns))
            .replace("{failed}", String(summary.failedTurns))
            .replace(
              "{cost}",
              `${summary.estimatedCostTurns > 0 ? "~" : ""}${formatUsageCost(summary.costTurns > 0 ? summary.costUsd : null)}`,
            )
            .replace(
              "{tokens}",
              formatUsageCount(summary.tokenTurns > 0 ? summary.totalTokens : null),
            )
            .replace(
              "{perTurn}",
              formatUsageDuration(summary.turns > 0 ? summary.durationMs / summary.turns : null),
            );
          const modelCell = tr.insertCell();
          modelCell.className = "px-4 py-2.5 align-top";
          const model = document.createElement("div");
          model.className = "break-words font-medium text-settings-text";
          model.textContent = row.model || text.unknownModel;
          const harness = document.createElement("div");
          harness.className = "text-xs text-settings-muted";
          harness.textContent = summary.harnessName;
          modelCell.append(model, harness);
          for (const column of USAGE_LEDGER_COLUMNS) {
            if (column === "model") continue;
            const cell = tr.insertCell();
            cell.className =
              "px-2 py-2.5 text-right align-top whitespace-nowrap tabular-nums last:pr-4";
            cell.textContent = cellText(row, column);
          }
        }
      };

      const renderHead = (): void => {
        headRow.replaceChildren();
        for (const column of USAGE_LEDGER_COLUMNS) {
          const cell = document.createElement("th");
          cell.scope = "col";
          cell.className =
            column === "model"
              ? "px-4 py-2 align-bottom font-medium text-settings-muted"
              : "w-[76px] px-2 py-2 text-right align-bottom font-medium text-settings-muted last:pr-4";
          const sorted = sort?.column === column ? sort : null;
          cell.setAttribute(
            "aria-sort",
            sorted ? (sorted.descending ? "descending" : "ascending") : "none",
          );
          const button = document.createElement("button");
          button.type = "button";
          button.className =
            "cursor-pointer border-0 bg-transparent p-0 text-xs leading-4 font-medium text-inherit hover:text-settings-text";
          button.dataset.usageSort = column;
          button.title = text.columnHelp[column];
          button.textContent = `${text.columns[column]}${sorted ? (sorted.descending ? " ↓" : " ↑") : ""}`;
          button.addEventListener("click", () => {
            sort = {
              column,
              descending: sorted ? !sorted.descending : column !== "model",
            };
            renderHead();
            renderRows();
          });
          cell.append(button);
          headRow.append(cell);
        }
      };

      const show = (message: string | null): void => {
        status.textContent = message ?? "";
        status.hidden = message === null;
        scroll.hidden = message !== null;
      };

      const renderSummary = (summary: UsageLedgerSummaryResult): void => {
        rows = summary.models.map(usageLedgerRow);
        const since = summary.recordingSinceMs;
        const noteLines =
          since === null
            ? text.notes
            : [
                text.recordingSince.replace(
                  "{date}",
                  new Date(since).toLocaleDateString(messages.locale),
                ),
                ...text.notes,
              ];
        notes.replaceChildren(
          ...noteLines.map((line) => {
            const item = document.createElement("li");
            item.textContent = line;
            return item;
          }),
        );
        if (rows.length === 0) {
          show(since === null ? text.empty : text.emptyRange);
          return;
        }
        renderRows();
        show(null);
      };

      const load = (): void => {
        const client = getClient();
        const read = client?.readUsageLedgerSummary?.bind(client);
        if (!read) {
          show(text.unavailable);
          return;
        }
        if (rows.length === 0) show(text.loading);
        const days = RANGE_DAYS[range];
        void context.runLatest(
          () => read(days === null ? {} : { sinceMs: Math.max(0, now() - days * DAY_MS) }),
          {
            success: renderSummary,
            failure(error) {
              rows = [];
              show(
                error instanceof RendererMethodUnavailableError ? text.unavailable : text.failed,
              );
            },
          },
        );
      };

      const rangeButtons = USAGE_LEDGER_RANGES.map((candidate) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.usageRange = candidate;
        button.className =
          "cursor-pointer rounded-md border-0 bg-transparent px-2.5 py-1 text-xs text-settings-muted aria-pressed:bg-settings-active aria-pressed:font-medium aria-pressed:text-settings-text";
        button.textContent = text.ranges[candidate];
        button.addEventListener("click", () => {
          if (range === candidate) return;
          range = candidate;
          syncRanges();
          load();
        });
        return button;
      });
      const syncRanges = (): void => {
        for (const button of rangeButtons) {
          button.setAttribute("aria-pressed", String(button.dataset.usageRange === range));
        }
      };
      ranges.append(...rangeButtons);
      syncRanges();
      renderHead();
      show(text.loading);

      context.content.append(heading, description, ranges, card, notes);
      load();
      return undefined;
    },
  });
}
