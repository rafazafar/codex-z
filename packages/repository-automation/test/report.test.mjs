import { describe, expect, it } from "vitest";
import { ciFinished, renderReport } from "../src/report.mjs";
import { bot, ci, comment, head, pr } from "./fixtures.mjs";
import { COMMENT_MARKER, isMaintenanceComment } from "../src/policy.mjs";

const render = (state) => renderReport({ item: pr(), ci: state });
describe("short terminal CI comments", () => {
  it("posts one visible success sentence bound to the actual commit", () => {
    const body = render(ci());
    expect(body).toContain("All CI checks passed");
    expect(body).toContain(`/commit/${head}`);
    expect(
      body
        .replace(/<!--[\s\S]*?-->/gu, "")
        .trim()
        .split("\n"),
    ).toHaveLength(1);
    expect(body).not.toMatch(
      /Information completeness|Validated commit|Review records|Specification risk|Long wait|Test plan/u,
    );
  });
  it.each(["queued", "in_progress", "waiting", "requested"])(
    "does not comment before CI ends: %s",
    (status) => {
      expect(render(ci({ status, conclusion: null }))).toBeNull();
    },
  );
  it("waits for all jobs and never borrows absent evidence", () => {
    expect(render({ run: null, jobs: [] })).toBeNull();
    expect(ciFinished({ ...ci(), jobs: [{ status: "in_progress" }] })).toBe(false);
    for (const jobs of [[], ci().jobs.slice(1), [...ci().jobs, ci().jobs[0]]]) {
      expect(render({ ...ci(), jobs })).not.toContain("All CI checks passed");
    }
  });
  it.each(["cancelled", "skipped", "action_required", "failure", "neutral", "timed_out", null])(
    "never reports %s as success",
    (conclusion) => {
      expect(render(ci({ conclusion }))).not.toContain("All CI checks passed");
    },
  );
  it("reports skipped jobs even when the workflow is green", () => {
    const state = ci();
    state.jobs[0].conclusion = "skipped";
    expect(render(state)).toContain("skipped checks");
  });
  it("quotes a failed job's raw error, without translating or breaking fences", () => {
    const state = ci({ conclusion: "failure" });
    state.jobs[2] = {
      ...state.jobs[2],
      id: 3,
      conclusion: "failure",
      html_url: "https://github.com/example/codex-z/actions/runs/42/job/3",
    };
    const error =
      "src/foo.ts(42,5): error TS2322: Type 'string' is not assignable to type 'number'.";
    const body = renderReport({ item: pr(), ci: state, errors: new Map([[3, [error, "```"]]]) });
    expect(body).toContain("❌ Windows CI failed.");
    expect(body).toContain(error);
    expect(body).toContain("````text");
    expect(body).not.toContain("Type mismatch");
    expect(render(state)).not.toContain("```text");
  });
  it("edits only the authenticated bot's own marker, including old summaries", () => {
    expect(isMaintenanceComment(comment({ body: COMMENT_MARKER }))).toBe(false);
    expect(isMaintenanceComment(comment({ body: COMMENT_MARKER, user: bot }))).toBe(true);
    expect(isMaintenanceComment(undefined)).toBe(false);
  });
});
