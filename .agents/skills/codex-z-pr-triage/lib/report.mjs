// Local report contract and serialization. No GitHub access or verdict inference.
export const VERDICTS = ["ACCEPT", "SIMPLIFY", "DISCUSS", "DECLINE"];
export const CI_STATES = [
  "pass",
  "fail",
  "pending",
  "cancelled",
  "skipped",
  "none",
  "unknown",
  "mixed",
];
export const CONFLICT_STATES = ["clear", "conflicting", "unknown"];

function check(condition, path, message) {
  if (!condition) throw new Error(`${path}: ${message}`);
}

function object(value, path, keys, optional = []) {
  check(
    value !== null && typeof value === "object" && !Array.isArray(value),
    path,
    "Must be an object",
  );
  for (const key of keys) check(Object.hasOwn(value, key), `${path}.${key}`, "Missing field");
  for (const key of Object.keys(value))
    check([...keys, ...optional].includes(key), `${path}.${key}`, "Unsupported field");
}

function text(value, path) {
  check(typeof value === "string" && value.trim().length > 0, path, "Must be a nonempty string");
}

function list(value, path, validateItem, minimum = 0) {
  check(Array.isArray(value), path, "Must be an array");
  check(value.length >= minimum, path, `At least ${minimum} items required`);
  value.forEach((item, index) => validateItem(item, `${path}[${index}]`));
}

function integer(value, path, minimum = 0) {
  check(Number.isSafeInteger(value) && value >= minimum, path, `Must be an integer >= ${minimum}`);
}

function timestamp(value, path) {
  text(value, path);
  check(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
      Number.isFinite(Date.parse(value)),
    path,
    "Must be a zoned ISO time",
  );
}

function repository(value, path) {
  text(value, path);
  check(/^[a-z\d][a-z\d-]*\/[a-z\d_.-]+$/iu.test(value), path, "Must be OWNER/REPO");
  check(![".", ".."].includes(value.split("/")[1]), path, "Invalid repository name");
}

function webUrl(value, path) {
  text(value, path);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${path}: Invalid URL`);
  }
  check(
    ["https:", "http:"].includes(url.protocol) && !url.username && !url.password,
    path,
    "Only credential-free http/https URLs allowed",
  );
  return url;
}

export const itemIdentity = (item) => `${item.repository.toLowerCase()}#${item.number}`;

function identity(pr, path, repositories, identities, kind = "pr") {
  repository(pr.repository, `${path}.repository`);
  integer(pr.number, `${path}.number`, 1);
  text(pr.title, `${path}.title`);
  check(
    repositories.has(pr.repository.toLowerCase()),
    `${path}.repository`,
    "Outside report repository scope",
  );
  const key = itemIdentity(pr);
  check(
    !identities.has(key),
    path,
    "Duplicate Issue/PR, or present in both evaluated and skipped lists",
  );
  identities.add(key);
  const url = webUrl(pr.url, `${path}.url`);
  check(
    url.origin === "https://github.com" &&
      url.pathname.toLowerCase() ===
        `/${pr.repository}/${kind === "issue" ? "issues" : "pull"}/${pr.number}`.toLowerCase() &&
      !url.search &&
      !url.hash,
    `${path}.url`,
    "Must match GitHub URL type, repository, and number",
  );
}

function source(value, path) {
  if (value === null) return;
  object(value, path, ["fingerprint", "collectedAt"]);
  check(
    typeof value.fingerprint === "string" && /^[a-f\d]{64}$/u.test(value.fingerprint),
    `${path}.fingerprint`,
    "Must be a SHA-256 fingerprint from the collection script",
  );
  timestamp(value.collectedAt, `${path}.collectedAt`);
}

function followUp(item, path, required) {
  for (const field of ["source", "nextActor", "replyDraft"]) {
    if (required)
      check(Object.hasOwn(item, field), `${path}.${field}`, "New assessment missing field");
  }
  if (item.source !== undefined) source(item.source, `${path}.source`);
  for (const field of ["nextActor", "replyDraft"])
    if (item[field] !== undefined) text(item[field], `${path}.${field}`);
}

function evidenceList(value, path, minimum = 0) {
  list(
    value,
    path,
    (item, itemPath) => {
      object(item, itemPath, ["label", "url", "revision", "detail"]);
      for (const field of ["label", "revision", "detail"])
        text(item[field], `${itemPath}.${field}`);
      if (item.url !== null) webUrl(item.url, `${itemPath}.url`);
    },
    minimum,
  );
  check(value.length <= 5, path, "At most 5 key evidence items");
}

/** Validate without filling fields, changing verdicts, or modifying the input. */
export function validateReport(report, { requireCardSummary = false } = {}) {
  object(report, "report", [
    "schemaVersion",
    "generatedAt",
    "repositories",
    "scope",
    "complete",
    "errors",
    "prs",
    "skipped",
    ...(report?.schemaVersion === 2 ? ["issues"] : []),
  ]);
  check(
    [1, 2].includes(report.schemaVersion),
    "report.schemaVersion",
    "Only versions 1 / 2 supported",
  );
  const v2 = report.schemaVersion === 2;
  timestamp(report.generatedAt, "report.generatedAt");
  text(report.scope, "report.scope");
  list(report.repositories, "report.repositories", repository, 1);
  const repositories = new Set(report.repositories.map((name) => name.toLowerCase()));
  check(
    repositories.size === report.repositories.length,
    "report.repositories",
    "Duplicate repository",
  );
  check(typeof report.complete === "boolean", "report.complete", "Must be a boolean");
  list(report.errors, "report.errors", text);
  check(
    report.complete ? report.errors.length === 0 : report.errors.length > 0,
    "report.errors",
    "Complete reports require no errors; partial results must explain collection gaps",
  );
  const identities = new Set();
  list(report.prs, "report.prs", (pr, path) => {
    object(
      pr,
      path,
      [
        "repository",
        "number",
        "title",
        "url",
        "baseSha",
        "headSha",
        "verdict",
        "reason",
        "value",
        "scope",
        "cost",
        "action",
        "stats",
        "integration",
        "evidence",
        "questions",
        "simplifications",
      ],
      ["originalTitle", "effect", ...(v2 ? ["source", "nextActor", "replyDraft"] : [])],
    );
    if (requireCardSummary) {
      check(
        Object.hasOwn(pr, "originalTitle"),
        `${path}.originalTitle`,
        "New assessment requires original PR title",
      );
      check(
        Object.hasOwn(pr, "effect"),
        `${path}.effect`,
        "New assessment must explain PR effect first",
      );
    }
    for (const field of ["originalTitle", "effect"])
      if (pr[field] !== undefined) text(pr[field], `${path}.${field}`);
    identity(pr, path, repositories, identities);
    if (v2) followUp(pr, path, requireCardSummary);
    check(VERDICTS.includes(pr.verdict), `${path}.verdict`, `Must be ${VERDICTS.join(" / ")}`);
    for (const field of ["reason", "value", "scope", "cost", "action"])
      text(pr[field], `${path}.${field}`);
    for (const field of ["title", "originalTitle", "effect", "value", "reason", "action"])
      if (pr[field] !== undefined)
        check(!/[\r\n]/u.test(pr[field]), `${path}.${field}`, "Card fields must be single-line");
    for (const field of ["baseSha", "headSha"]) {
      if (pr[field] === null) {
        check(
          pr.verdict === "DISCUSS",
          `${path}.${field}`,
          "Missing revision evidence requires DISCUSS",
        );
        check(
          !pr.source,
          `${path}.source`,
          "Missing revision evidence cannot be recorded as processed",
        );
      } else {
        check(
          typeof pr[field] === "string" && /^(?:[a-f\d]{40}|[a-f\d]{64})$/iu.test(pr[field]),
          `${path}.${field}`,
          "Must be full SHA or null",
        );
      }
    }
    if (pr.stats !== null) {
      object(pr.stats, `${path}.stats`, ["files", "additions", "deletions"]);
      for (const field of ["files", "additions", "deletions"])
        integer(pr.stats[field], `${path}.stats.${field}`);
    }
    object(pr.integration, `${path}.integration`, ["ci", "conflict", "collectedAt", "note"]);
    check(CI_STATES.includes(pr.integration.ci), `${path}.integration.ci`, "Unsupported CI state");
    check(
      CONFLICT_STATES.includes(pr.integration.conflict),
      `${path}.integration.conflict`,
      "Unsupported conflict state",
    );
    timestamp(pr.integration.collectedAt, `${path}.integration.collectedAt`);
    text(pr.integration.note, `${path}.integration.note`);
    list(pr.questions, `${path}.questions`, text, pr.verdict === "DISCUSS" ? 1 : 0);
    list(pr.simplifications, `${path}.simplifications`, text, pr.verdict === "SIMPLIFY" ? 1 : 0);
    evidenceList(pr.evidence, `${path}.evidence`, pr.verdict === "DISCUSS" && !pr.source ? 0 : 1);
  });
  if (v2)
    list(report.issues, "report.issues", (issue, path) => {
      object(issue, path, [
        "repository",
        "number",
        "title",
        "originalTitle",
        "url",
        "summary",
        "category",
        "priority",
        "reason",
        "action",
        "nextActor",
        "replyDraft",
        "missingInfo",
        "related",
        "evidence",
        "source",
      ]);
      identity(issue, path, repositories, identities, "issue");
      followUp(issue, path, true);
      for (const field of ["originalTitle", "summary", "reason", "action"])
        text(issue[field], `${path}.${field}`);
      check(
        ["bug", "feature", "question", "documentation", "unknown"].includes(issue.category),
        `${path}.category`,
        "Unsupported Issue category",
      );
      check(
        ["urgent", "normal", "unknown"].includes(issue.priority),
        `${path}.priority`,
        "Unsupported priority",
      );
      list(issue.missingInfo, `${path}.missingInfo`, text);
      list(issue.related, `${path}.related`, (related, relatedPath) => {
        object(related, relatedPath, ["url", "reason"]);
        webUrl(related.url, `${relatedPath}.url`);
        text(related.reason, `${relatedPath}.reason`);
      });
      evidenceList(issue.evidence, `${path}.evidence`, issue.source ? 1 : 0);
    });
  list(report.skipped, "report.skipped", (item, path) => {
    object(
      item,
      path,
      ["repository", "number", "title", "url", "reason"],
      v2 ? ["kind", "source"] : [],
    );
    if (v2) {
      check(
        item.kind === undefined || ["pr", "issue"].includes(item.kind),
        `${path}.kind`,
        "Unsupported type",
      );
      if (item.source !== undefined) source(item.source, `${path}.source`);
    }
    identity(item, path, repositories, identities, item.kind ?? "pr");
    text(item.reason, `${path}.reason`);
  });
  const entries = [...report.prs, ...(report.issues ?? []), ...report.skipped];
  if (entries.some((item) => item.source === null))
    check(!report.complete, "report.complete", "Incomplete items must record collection gaps");
  return report;
}

/** Escape the raw-text script boundary, including HTML comments and line separators. */
export function renderReport(report, { template, styles, script }) {
  validateReport(report);
  const escaped = JSON.stringify(report).replace(
    /[<>&\u2028\u2029]/gu,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  const parts = {
    "<!-- REPORT_DATA -->": `<script id="report-data" type="application/json">${escaped}</script>`,
    "/* REPORT_STYLES */": styles,
    "/* REPORT_SCRIPT */": script,
  };
  for (const marker of Object.keys(parts)) {
    check(
      template.split(marker).length === 2,
      "template",
      `Placeholder must occur exactly once: ${marker}`,
    );
  }
  // One pass: payload text resembling a marker or replacement token stays literal.
  return template.replace(
    /<!-- REPORT_DATA -->|\/\* REPORT_STYLES \*\/|\/\* REPORT_SCRIPT \*\//gu,
    (marker) => parts[marker],
  );
}
