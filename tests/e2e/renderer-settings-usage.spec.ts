import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

import { tailwindEsbuildPlugin } from "../../packages/renderer-extension/scripts/tailwind-esbuild-plugin.mjs";

const browserExecutable = process.env.CODEX_Z_PLAYWRIGHT_EXECUTABLE_PATH;
if (browserExecutable) test.use({ launchOptions: { executablePath: browserExecutable } });

const { outputFiles } = await build({
  stdin: {
    contents: `
      import { createUsageSettingsPage } from "./packages/renderer-extension/src/settings/usage-page.ts";
      import { createRendererSettingsPageRegistry } from "./packages/renderer-extension/src/settings/core.ts";
      import { rendererSettingsMessages } from "./packages/renderer-extension/src/settings/localization.ts";
      import { mountRendererSettingsShell } from "./packages/renderer-extension/src/settings/shell.ts";

      const query = new URLSearchParams(location.search);
      const locale = query.get("locale") ?? "en";
      const theme = query.get("theme") ?? "light";
      document.documentElement.style.colorScheme = theme;
      const base = {
        harnessId: "codex", harnessName: "Codex", modelId: "gpt-6.1-sol", modelLabel: null,
        sessions: 1, turns: 2, userSessions: 1, userTurns: 2,
        interruptedTurns: 0, failedTurns: 0, durationMs: 108_000,
        tokenSessions: 1, tokenTurns: 2, inputTokens: 650_000, cachedInputTokens: 0,
        outputTokens: 4_000, reasoningOutputTokens: 0, totalTokens: 654_000,
        timedOutputTokens: 4_000, outputTokenDurationMs: 100_000,
        costSessions: 0, costTurns: 0, estimatedCostTurns: 0, costUsd: 0, lastTurnAtMs: Date.now(),
      };
      const models = [
        base,
        { ...base, harnessId: "claude-code", harnessName: "Claude Code", modelId: "opus",
          durationMs: 34_000, totalTokens: 4_200, outputTokens: 420,
          timedOutputTokens: 420, outputTokenDurationMs: 34_000,
          costSessions: 1, costTurns: 2, costUsd: 0.32 },
        { ...base, harnessId: "pi", harnessName: "Pi", modelId: "unreported",
          timedOutputTokens: 0, outputTokenDurationMs: 0 },
        { ...base, harnessId: "pi", harnessName: "Pi", modelId: "zero-output",
          outputTokens: 0, timedOutputTokens: 0, outputTokenDurationMs: 5_000 },
      ];
      const client = {
        readUsageLedgerSummary: async (params) => ({
          models: params.sinceMs && params.sinceMs > Date.now() - 8 * 86_400_000 ? [base] : models,
          turns: 8, recordingSinceMs: Date.now(),
        }),
      };
      const messages = rendererSettingsMessages(locale);
      const registry = createRendererSettingsPageRegistry([createUsageSettingsPage(messages, () => client)]);
      const shell = mountRendererSettingsShell(registry, document, messages);
      shell.openSettings(undefined, "usage");
    `,
    resolveDir: path.resolve(import.meta.dirname, "../.."),
    sourcefile: "settings-usage-e2e-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2024",
  loader: { ".css": "text", ".png": "dataurl", ".svg": "dataurl" },
  plugins: [tailwindEsbuildPlugin()],
  write: false,
});
const bundle = outputFiles[0]?.text ?? "";
if (!bundle) throw new Error("Usage settings fixture bundle missing");

async function setup(page: Page, locale = "en", theme = "light") {
  await page.route("http://localhost/usage-test?**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body><script>${bundle}</script></body></html>`,
    }),
  );
  await page.goto(`http://localhost/usage-test?locale=${locale}&theme=${theme}`);
}

test("shows Avg TPS, missing and zero measurements, and sorts and filters by range", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  const table = page.getByRole("table", { name: "Usage" });
  const header = table.getByRole("button", { name: "Avg TPS", exact: true });
  await expect(header).toHaveAttribute(
    "title",
    "Average output tokens per second across measured Turns, including Tool calls and other waits.",
  );
  const values = table.locator("tbody tr td:last-child");
  await expect(values).toHaveText(["40.0", "12.4", "—", "0.0"]);
  await page.screenshot({ path: testInfo.outputPath("avg-tps-light.png") });

  await header.click();
  await expect(values).toHaveText(["40.0", "12.4", "0.0", "—"]);
  await expect(table.getByRole("columnheader", { name: /Avg TPS/ })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await table.getByRole("button", { name: "Avg TPS ↓", exact: true }).click();
  await expect(values).toHaveText(["0.0", "12.4", "40.0", "—"]);

  await page.getByRole("button", { name: "7 days", exact: true }).click();
  await expect(values).toHaveText(["40.0"]);
  await page.getByRole("button", { name: "All time", exact: true }).click();
  await expect(values).toHaveText(["0.0", "12.4", "40.0", "—"]);
  await page.screenshot({ path: testInfo.outputPath("avg-tps-sorted.png") });
});

test("keeps Avg TPS available in Chinese and in a narrow dark layout", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await setup(page, "zh-CN", "dark");
  const table = page.getByRole("table", { name: "用量" });
  const header = table.getByRole("button", { name: "Avg TPS", exact: true });
  await expect(header).toHaveAttribute("title", /包含工具调用及其他等待时间/);
  await header.scrollIntoViewIfNeeded();
  await expect(header).toBeVisible();
  await expect(table.locator("tbody tr td:last-child")).toHaveText(["40.0", "12.4", "—", "0.0"]);
  await page.screenshot({ path: testInfo.outputPath("avg-tps-narrow-dark.png") });
});
