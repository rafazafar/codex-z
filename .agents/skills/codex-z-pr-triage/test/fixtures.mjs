import { snapshotItem } from "../lib/incremental.mjs";

// Synthetic inputs for tests only. Never used as report defaults.
export function createReport() {
  const repository = "example/triage-fixture";
  const generatedAt = "2026-01-02T03:04:05Z";
  return {
    schemaVersion: 1,
    generatedAt,
    repositories: [repository],
    scope: "Fictional automated-test data, not real PR assessments",
    complete: true,
    errors: [],
    prs: ["ACCEPT", "SIMPLIFY", "DISCUSS", "DECLINE"].map((verdict, index) => ({
      repository,
      number: index + 1,
      title: `Test feature ${index + 1}`,
      originalTitle: `test: fixture PR ${index + 1}`,
      effect: "Test user-visible effect.",
      url: `https://github.com/${repository}/pull/${index + 1}`,
      baseSha: "a".repeat(40),
      headSha: "b".repeat(40),
      verdict,
      reason: "Used only to verify data rendering.",
      value: "Test value description.",
      scope: "Test implementation scope.",
      cost: "Test maintenance cost.",
      action: "Test next action.",
      stats: { files: 3, additions: 10, deletions: 2 },
      integration: {
        ci: "fail",
        conflict: "conflicting",
        collectedAt: generatedAt,
        note: "Simulated failures/conflicts do not change recommendation.",
      },
      evidence: [
        {
          label: "src/example.ts",
          url: `https://github.com/${repository}/blob/${"b".repeat(40)}/src/example.ts#L1`,
          revision: "b".repeat(40),
          detail: "Fictional file evidence for tests only.",
        },
      ],
      questions: verdict === "DISCUSS" ? ["Maintainer: add a test scenario."] : [],
      simplifications:
        verdict === "SIMPLIFY" ? ["Test simplification: remove duplicate configuration."] : [],
    })),
    skipped: [
      {
        repository,
        number: 5,
        title: "Test draft",
        url: `https://github.com/${repository}/pull/5`,
        reason: "Draft",
      },
    ],
  };
}

export function githubRecord(number = 6, kind = "issue", repository = "example/triage-fixture") {
  return {
    repository,
    issue: {
      number,
      title: `test: fixture ${kind === "pr" ? "PR" : "Issue"} ${number}`,
      body: "Test report body, not a real problem.",
      state: "open",
      updated_at: "2026-01-02T03:04:05Z",
      labels: [],
      ...(kind === "pr" ? { pull_request: {} } : {}),
    },
    pull:
      kind === "pr"
        ? {
            number,
            draft: false,
            merged_at: null,
            base: { ref: "main", sha: "a".repeat(40) },
            head: { sha: "b".repeat(40) },
          }
        : null,
    comments: [],
    reviews: [],
    reviewComments: [],
  };
}

export function createIssue(item = snapshotItem(githubRecord(), "2026-01-02T03:04:05Z")) {
  return {
    repository: item.repository,
    number: item.number,
    title: "Test problem",
    originalTitle: item.title,
    url: item.url,
    summary: "Test symptoms, not verified on a real device.",
    category: "bug",
    priority: "normal",
    reason: "Body describes symptoms; maintainer verification required.",
    action: "Verify reproduction steps.",
    nextActor: "Maintainer",
    replyDraft: "Thank you for the report. We will verify reproduction steps.",
    missingInfo: [],
    related: [],
    evidence: [
      {
        label: "Issue body",
        url: item.url,
        revision: item.updatedAt,
        detail: "User description in test report.",
      },
    ],
    source: item.source,
  };
}

export function createV2Report() {
  const report = createReport();
  report.schemaVersion = 2;
  report.issues = [createIssue()];
  for (const pr of report.prs)
    Object.assign(pr, {
      source: snapshotItem(githubRecord(pr.number, "pr"), report.generatedAt).source,
      nextActor: "Maintainer",
      replyDraft: "Test reply draft, unpublished.",
    });
  report.skipped[0].kind = "pr";
  return report;
}

export function assessSelection(selection) {
  const report = {
    schemaVersion: 2,
    generatedAt: selection.generatedAt,
    repositories: selection.repositories,
    scope: selection.scope,
    complete: selection.errors.length === 0,
    errors: [...selection.errors],
    prs: [],
    issues: [],
    skipped: [],
  };
  for (const item of selection.selected) {
    if (item.kind === "issue") report.issues.push(createIssue(item));
    else
      report.prs.push({
        ...createReport().prs[0],
        repository: item.repository,
        number: item.number,
        url: item.url,
        originalTitle: item.title,
        baseSha: item.baseSha,
        headSha: item.headSha,
        source: item.source,
        nextActor: "Maintainer",
        replyDraft: "Test reply draft.",
      });
  }
  for (const item of selection.skipped)
    report.skipped.push({
      repository: item.repository,
      number: item.number,
      kind: item.kind,
      title: item.title,
      url: item.url,
      reason: item.draft ? "Draft" : "Closed",
      source: item.source,
    });
  return report;
}

export function fakeGithub(records) {
  const calls = [];
  return {
    calls,
    async authenticate() {},
    async repository() {
      return "example/triage-fixture";
    },
    async get(path) {
      calls.push(path);
      const url = new URL(`https://api.github.com/${path}`);
      const match = url.pathname.match(
        /^\/repos\/([^/]+\/[^/]+)\/(issues|pulls)(?:\/(\d+)(?:\/(comments|reviews))?)?$/u,
      );
      assertFixture(match, path);
      const [, repository, resource, number, subresource] = match;
      const candidates = records.filter(
        (item) => item.repository.toLowerCase() === repository.toLowerCase(),
      );
      const page = Number(url.searchParams.get("page") ?? "1");
      const slice = (entries) => structuredClone(entries.slice((page - 1) * 100, page * 100));
      if (!number)
        return slice(
          candidates.filter((item) => item.issue.state === "open").map((item) => item.issue),
        );
      const record = candidates.find((item) => item.issue.number === Number(number));
      assertFixture(record, path);
      if (subresource === "reviews") return slice(record.reviews);
      if (subresource === "comments")
        return slice(resource === "issues" ? record.comments : record.reviewComments);
      return structuredClone(resource === "issues" ? record.issue : record.pull);
    },
  };
}

function assertFixture(value, path) {
  if (!value) throw new Error(`Test has no GitHub data for: ${path}`);
}
