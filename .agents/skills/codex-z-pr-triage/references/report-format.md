# Report data and rendering

New `report.json` batches use **version 2**. Version 1 remains readable, mergeable, and renderable offline. `../lib/report.mjs` validates structure; templates/renderers do not infer or change recommendations. Offline operations require Node.js only, without npm runtime dependencies, a server, or GitHub credentials. Collection/progress updates also need authenticated `gh` and use GitHub REST GET only.

## Incremental publication

Use `scripts/prepare-run.mjs` for selection/report skeleton, fill real assessments, then run:

```bash
node <absolute-skill-path>/scripts/update-report.mjs <absolute-batch-report.json> <project-directory> --selection <absolute-batch-selection.json>
```

Project directory defaults to cwd; subdirectory invocation works. Cumulative output is fixed at Git root `pr-triage/report.json` / `pr-triage/index.html`. The directory must be ignored and reports untracked. Input contains only this batch's selected/analyzed/skipped items, not the cumulative report.

- Before publication, reread proposed completed items and check identity, type, source fingerprint, and PR BASE/HEAD. Changed/unreadable sources retain advice but set source null and record errors. Save other verified items. Mark omitted selections incomplete.
- Merge key is case-insensitive repository plus number. Issues/PRs share GitHub numbering; equal numbers in different repositories remain distinct. New records replace old assessments/skips with the same identity. Preserve others; absence from a batch does not remove cards.
- New PRs have originalTitle/effect. New v2 input also requires source/nextActor/replyDraft. Old cumulative PRs may omit new fields; renderer uses old value for effect. Selection treats missing source as no incremental baseline.
- `report.json` is the only progress source; no second state file. Per-item source is the last successfully analyzed/rechecked source version, not a seen number. Top-level generatedAt is latest batch time, not every card's refresh time.
- Preparation leaves cumulative reports unchanged. Unsaved new/changed items requeue next time. If forced reassessment stops, original same-version assessments remain historical and can be explicitly reassessed. Older per-item snapshots cannot replace newer verified ones.
- Merging v1 into v2 does not downgrade schema, delete Issues, or invent old processing progress.
- Preserve/deduplicate historical errors conservatively. Cumulative complete is true only without gaps. Batch absence does not prove old gaps resolved. For resolved gaps, verify sources, separately back up, and correct cumulative errors/complete. Retry selection uses source, not historical error text.
- stdout current / cumulative give separate counts. evaluated counts PRs, issues counts Issues, processed counts items with verified sources, skipped is separate, and four verdict counts include PRs only. output/data/backup are also supplied. Do not report cumulative counts as this batch's work.

Back up old files under `backups/snapshot-*/`. Validate/generate HTML before publication. `.update-lock` serializes writes; reject symlink directories/files. Stop on damaged JSON, HTML-only state, or existing lock. Do not clear history. With HTML alone, first recover JSON by page export.

Publication uses two independent rename operations, not a JSON/HTML transaction. Interruption can leave new JSON and old HTML. Compare backup and verify JSON, then rebuild HTML offline. Remove abandoned locks manually only after confirming no update process. Do not take locks by timeout.

The old entry without `--selection` can update v1 or reports without completed sources offline. It cannot bypass rechecks to add processed records. Rebuild HTML with the renderer below.

## Single render for recovery/debugging, without merging

```bash
node <absolute-skill-path>/scripts/render-report.mjs <absolute-report.json> <absolute-new-index.html>
```

Parent directory must exist. Output must not overwrite existing files. After validation, inline CSS, browser scripts, and JSON into standalone HTML; do not fetch adjacent JSON. Successful stdout includes output, complete, evaluated (PR), issues, skipped, and four PR verdict counts. Failure exits nonzero with field path; correct input and select a new output file.

Renderer cannot prove evidence, link accessibility, or judgment correctness. Analysis verifies them. Do not use samples/fixtures as actual results.

## Top-level fields

All fields listed for each version are required; extra fields are rejected. Use `[]` for empty arrays and `null` for incomplete sources.

| Field | Format / meaning |
| --- | --- |
| schemaVersion | Number 2 for new batches; version 1 remains readable |
| generatedAt | Zoned ISO time, such as `2026-01-02T03:04:05Z`; not page-open time or every item's processing time |
| repositories | Nonempty unique OWNER/REPO array containing all batch targets |
| scope | Nonempty selection scope, batch limit, deferred counts, etc. |
| complete | True when batch core collection/analysis/recheck is complete. source:null requires false; unknown CI/conflicts alone do not change it. Does not mean all open queues processed |
| errors | Specific collection/analysis gaps. Empty for complete reports; at least one for partial reports. Give known numbers and disclose unknown remaining counts |
| prs | PR recommendations; can be empty. Partial advice uses source:null; never default unknown items to ACCEPT |
| issues | Required v2 Issue triage array; absent in v1 |
| skipped | Skipped items; can be empty |

Repository + number cannot repeat or appear in multiple prs/issues/skipped arrays. Repository names are case-insensitive; equal numbers across repositories are allowed.

## Each PR

| Field | Format / meaning |
| --- | --- |
| repository / number | In-scope OWNER/REPO and positive integer |
| title / originalTitle | Concise English functional title and unchanged GitHub title; single-line. Old records can omit originalTitle |
| effect | User-visible behavior, 1–2 sentences plus limits if needed; single-line. Old records can omit |
| url | Identity-matching `https://github.com/OWNER/REPO/pull/N`, no query/hash |
| baseSha / headSha | Full 40/64-digit hexadecimal SHA; missing only for DISCUSS with gap/source:null |
| verdict | Exactly one ACCEPT / SIMPLIFY / DISCUSS / DECLINE |
| reason / value / action | Nonempty single-line key reason, added value, maintainer next step |
| scope / cost | Nonempty implementation scope / maintenance cost; not top-level selection scope |
| stats | `{ files, additions, deletions }`, each a nonnegative integer; null if unknown |
| integration | Required auxiliary CI/conflict snapshot below |
| evidence | Format below; at most 5. At least one for non-DISCUSS or non-null source. No evidence permits only incomplete DISCUSS with specific explanation |
| questions | Array of nonempty strings; at least one for DISCUSS naming actor/question; otherwise can be empty |
| simplifications | Array of nonempty strings; at least one for SIMPLIFY explaining deletion/reuse/separation and preserved benefit; otherwise can be empty |
| source | Required per-item source for new v2 PRs; see below |
| nextActor | Required nonempty recommended next actor for new v2 PRs; no assignee change |
| replyDraft | Required nonempty unpublished draft for new v2 PRs; multiline allowed |

Generic rendering permits missing new fields in old PRs inside v2 cumulative reports. New batch entry requires them.

### integration

Exactly `{ ci, conflict, collectedAt, note }`:

- ci: pass / fail (including timeout failure states) / pending / cancelled / skipped / none (no checks) / unknown / mixed.
- conflict: clear / conflicting / unknown.
- collectedAt: zoned ISO time, including failed attempt time.
- note: nonempty mixed-state explanation, unknown reason, repair reminder, or known cost. Do not guess unknown cost.

Aggregate CI failures first, then pending. Remaining terminal states give pass if all pass, cancelled/skipped if uniform, otherwise mixed with explanation. No checks is not all green. Every state allows any verdict; no automatic downgrade/wait.

### evidence

Exactly `{ label, url, revision, detail }` per item. label/detail/revision are nonempty. url is a verified credential-free http/https link or null. label names file/symbol/requirement. revision is a specific SHA or requirement version/read time. detail explains supported judgment. Prefer SHA-bound file links, not plain paths.

## Each Issue (v2)

All fields required; PR verdict/HEAD fields prohibited.

| Field | Format / meaning |
| --- | --- |
| repository / number | Same identity rules as PR |
| title / originalTitle | Nonempty English problem title and unchanged GitHub title |
| url | Identity-matching `https://github.com/OWNER/REPO/issues/N`, no query/hash |
| summary | Nonempty problem, scenario, key limits |
| category | bug / feature / question / documentation / unknown; local advice, no label change |
| priority | urgent / normal / unknown; reason explains basis |
| reason | Nonempty basis; separate reporter claims, verified facts, inference |
| action / nextActor | Nonempty clear next step/recommended actor |
| replyDraft | Nonempty unpublished draft; multiline allowed |
| missingInfo | Information-request strings; can be empty |
| related | `{ url, reason }` array; safe http/https links and nonempty relationship reasons; can be empty; not duplicate-close authority |
| evidence | Same as PR, at most 5; non-null source requires at least one |
| source | Per-item source below; null if incomplete |

## Per-item source

- `null`: incomplete analysis or core collection/recheck failure; retry next time, with complete:false and specific errors.
- Object: exactly fingerprint (64 lowercase hexadecimal SHA-256 digits) and collectedAt (zoned ISO time). After complete analysis, copy selection source unchanged; do not calculate/invent it. Publication rechecks and archives with actual new collection time.
- Fingerprint covers content, state, labels, ordinary discussion, review state, line feedback, PR HEAD/BASE, and target branch. CI is separate auxiliary information, not value-assessment source. Global generatedAt/file mtime do not determine progress.
- Author information requests/maintainer product choices can be complete triage. API/code collection failures cannot. Scripts verify structure/source; the Agent still owns analysis completeness/evidence truth.

## skipped

v1 has exactly repository, number, title, url, reason. New v2 batches from prepare-run also have kind (pr / issue) and source. Old cumulative skips can omit both and default to pr.

URL matches actual type. reason identifies draft/closed/merged status; recheck before publication. No verdict. Skips do not consume analysis limit.

## Structure example: fictional, not a real assessment

This deliberately omits source snapshots to show partial advice without processed status. It is not publishable real triage.

```json
{
  "schemaVersion": 2,
  "generatedAt": "2026-01-02T03:04:05Z",
  "repositories": ["example/project"],
  "scope": "Fictional structure example, not real triage",
  "complete": false,
  "errors": ["Example source is unverified; progress is not advanced."],
  "prs": [],
  "issues": [
    {
      "repository": "example/project",
      "number": 1,
      "title": "Example: no response after startup",
      "originalTitle": "Example: app does not respond",
      "url": "https://github.com/example/project/issues/1",
      "summary": "Example problem description only; not verified.",
      "category": "bug",
      "priority": "unknown",
      "reason": "Source is unverified; cause cannot be confirmed.",
      "action": "Verify the report and related implementation first.",
      "nextActor": "Maintainer",
      "replyDraft": "Example draft: Thank you for the report. We will verify the information.",
      "missingInfo": [],
      "related": [],
      "evidence": [],
      "source": null
    }
  ],
  "skipped": []
}
```

## Display, safety, and validation

- Four PR columns, Issue list, chat counts, and JSON export use one data source. Search/sort/CI toggles change display only. The page performs no GitHub writes and labels reply drafts unpublished.
- Titles, drafts, questions, paths use textContent. Escape JSON for HTML raw-text boundaries. Links allow credential-free http/https only. Keep full original bodies in batch material; omit credentials, full logs, unrelated private information from cumulative reports.
- Templates have no default mock data. Fixtures are tests only. Maintain CSS/browser scripts separately and inline at render time. Offline opening does not need fetch.
- Run targeted validation with root `package.json` `npm run test:triage`. node:test covers pagination, incremental behavior, retry/force, recheck, compatibility, recovery. Browser tests use existing @playwright/test and local Chromium for offline Issue/PR dashboard, search, detail, export, hostile text, and mobile layout. No real GitHub access or automatic browser downloads. State unavailable-browser blockers.
