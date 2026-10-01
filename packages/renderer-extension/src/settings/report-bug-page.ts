import type { RendererSettingsPageDefinition, RendererSettingsPageMountContext } from "./core.js";
import { CODEX_Z_GITHUB_ISSUES_NEW_URL } from "./connections-page.js";
import { createRendererSettingsIcon } from "./icons.js";
import type { RendererSettingsMessages } from "./localization.js";
import { createPreferenceGroup } from "./preference-ui.js";

// The renderer build reads the release version from the root package manifest.
declare const __CODEX_Z_VERSION__: string;

export function createReportBugSettingsPage(
  messages: RendererSettingsMessages,
): RendererSettingsPageDefinition {
  return Object.freeze({
    id: "report-bug",
    label: messages.pageLabels["report-bug"],
    icon: "ticket",
    mount({ content }: RendererSettingsPageMountContext) {
      const document = content.ownerDocument;
      const version = typeof __CODEX_Z_VERSION__ === "string" ? __CODEX_Z_VERSION__ : "unknown";
      const { group, card } = createPreferenceGroup(document, messages.pageLabels["report-bug"]);
      const details = document.createElement("div");
      details.className = "flex flex-col items-start gap-4 px-4 py-4";
      const description = document.createElement("p");
      description.className = "m-0 text-[13px] leading-5 text-settings-text";
      description.textContent = messages.reportBugDescription;
      const currentVersion = document.createElement("p");
      currentVersion.className = "m-0 text-xs leading-[18px] text-settings-muted";
      currentVersion.textContent = `${messages.updateCurrentVersion}: ${version}`;
      const link = document.createElement("a");
      link.className =
        "inline-flex items-center gap-2 rounded-lg bg-settings-primary px-3 py-2 text-[13px] font-medium text-settings-primary-text no-underline" +
        " hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-settings-focus";
      const url = new URL(CODEX_Z_GITHUB_ISSUES_NEW_URL);
      url.searchParams.set("template", "bug_report.yml");
      url.searchParams.set("version", version);
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(createRendererSettingsIcon("external-link", 16), messages.reportBugOpen);
      const notice = document.createElement("p");
      notice.className = "m-0 text-xs leading-[18px] text-settings-muted";
      notice.textContent = messages.reportBugNotice;
      details.append(description, currentVersion, link, notice);
      card.append(details);
      content.append(group);
      return undefined;
    },
  });
}
