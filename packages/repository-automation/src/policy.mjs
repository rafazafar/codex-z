// Repository governance only: no Host, Harness, or model runtime dependencies.
export const CI_WORKFLOW = "ci.yml";
export const CI_JOBS = [
  "Check ubuntu-22.04",
  "Check macos-14",
  "Check windows-latest",
  "Check Linux ARM64",
];
export const TYPE_LABELS = ["bug", "enhancement", "documentation"];
export const LABELS = {
  bug: ["d73a4a", "Bug report"],
  enhancement: ["a2eeef", "Feature request"],
  documentation: ["0075ca", "Documentation"],
};
export const COMMENT_MARKER = "<!-- codex-z-maintenance:v1 -->";
export const STATE_PREFIX = "<!-- codex-z-maintenance-state:";
export const BOT_LOGIN = "github-actions[bot]";
export const SHA = /^[a-f0-9]{40}$/u;

export function isMaintenanceComment(comment) {
  return (
    comment?.user?.login === BOT_LOGIN &&
    comment.user?.type === "Bot" &&
    comment.body?.startsWith(COMMENT_MARKER)
  );
}

export function markdown(value, limit = 250) {
  return String(value ?? "")
    .slice(0, limit)
    .replace(/[\r\n]+/gu, " ")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/@/gu, "＠")
    .replace(/[\\`*_[\]{}|]/gu, "\\$&");
}

export function githubLink(url, text = "View") {
  // Never repost arbitrary links supplied in a PR description or bot text.
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && parsed.hostname === "github.com") {
      return `[${markdown(text)}](${parsed.href.replace(/[()]/gu, (c) => encodeURIComponent(c))})`;
    }
  } catch {
    // An absent URL is normal for pending runs.
  }
  return markdown(text);
}
