import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "../..");
const browserExecutable = process.env.CODEX_Z_PLAYWRIGHT_EXECUTABLE_PATH;
if (browserExecutable) test.use({ launchOptions: { executablePath: browserExecutable } });
const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

// Use the shipped bundle so the test checks release version injection and compiled styles.
await promisify(execFile)(process.execPath, ["packages/renderer-extension/scripts/build.mjs"], {
  cwd: root,
});
const { outputFiles } = await build({
  stdin: {
    contents: `
      import {
        createDefaultRendererSettingsRegistry,
        mountRendererSettingsShell,
        rendererSettingsMessages,
      } from "./packages/renderer-extension/dist/index.js";
      const locale = new URL(location.href).searchParams.get("locale") ?? "en";
      const messages = rendererSettingsMessages(locale);
      const shell = mountRendererSettingsShell(createDefaultRendererSettingsRegistry(messages), document, messages);
      shell.openSettings();
    `,
    resolveDir: root,
    sourcefile: "report-bug-e2e-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2024",
  write: false,
});
const bundle = outputFiles[0]?.text;
if (!bundle) throw new Error("Missing bug report fixture bundle");

for (const scenario of [
  { locale: "en", scheme: "light", label: "Report a bug", action: "Open bug report on GitHub" },
  { locale: "zh-CN", scheme: "dark", label: "报告问题", action: "在 GitHub 报告问题" },
] as const) {
  test(`opens the prepared bug report from ${scenario.locale} settings in ${scenario.scheme} mode`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://localhost/report-test?*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html lang="${scenario.locale}" style="color-scheme:${scenario.scheme}"><body><script>${bundle}</script></body></html>`,
      }),
    );
    await page.goto(`http://localhost/report-test?locale=${scenario.locale}`);
    const navigation = page.getByRole("button", { name: scenario.label, exact: true });
    await navigation.click();
    await expect(navigation).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("region", { name: scenario.label })).toContainText(version);
    const link = page.getByRole("link", { name: scenario.action, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const href = await link.getAttribute("href");
    const url = new URL(href ?? "");
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/rafazafar/codex-z/issues/new");
    expect([...url.searchParams.entries()]).toEqual([
      ["template", "bug_report.yml"],
      ["version", version],
    ]);
    const template = await readFile(
      path.join(root, ".github/ISSUE_TEMPLATE/bug_report.yml"),
      "utf8",
    );
    expect(template).toContain("id: version");
    expect(template).toContain("id: reproduction");
    expect(template).toContain("id: expected");
    const screenshot = testInfo.outputPath(`report-bug-${scenario.locale}-${scenario.scheme}.png`);
    await page.screenshot({ path: screenshot });
    await testInfo.attach("Bug report page", { path: screenshot, contentType: "image/png" });

    // Capture the external destination without creating an issue on GitHub.
    await page
      .context()
      .route("https://github.com/rafazafar/codex-z/issues/new?*", (route) =>
        route.fulfill({ contentType: "text/html", body: "<h1>GitHub report destination</h1>" }),
      );
    await link.focus();
    const popupPromise = page.waitForEvent("popup");
    await link.press("Enter");
    const popup = await popupPromise;
    await expect(popup).toHaveURL(href ?? "");
    await expect(popup.getByRole("heading", { name: "GitHub report destination" })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
