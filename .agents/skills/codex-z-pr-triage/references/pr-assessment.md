# PR functional value and merge recommendation

Answer only: **Does this PR belong in the repository? Does the change introduce unnecessary implementation work for its goal?** This is PR assessment, not certification of technical merge readiness.

## Assessment boundary

- CI/conflicts are auxiliary information for repair cost/next action, not hard gates. Failed, conflicting, pending, or unknown state alone cannot lower/defer a verdict. Use verified design/maintenance evidence if further checks find actual problems. Green CI does not prove value or limited complexity.
- Paths locate ownership/key implementation; do not judge automatically by HIGH/MEDIUM/LOW. Core-package changes can merit merge; documentation can be redundant or unhelpful.
- Author identity, lines, and file count do not decide value. Necessary cross-package changes are not automatically excessive; a few lines can introduce unnecessary mechanisms.
- Read key implementation/alternatives without line-by-line style, naming, or formatting criticism. `/review` handles correctness review; `/pr-babysit` handles CI/comments. Do not start them automatically.
- Missing requirements text does not prove no value. Find evidence in implementation/existing documentation first.

## 1. Verify complete file inventory and versions

Selection contains PR source, BASE/HEAD, body, and discussion. Obtain actual change scope only for selected PRs:

```bash
gh pr view <N> -R <OWNER/REPO> \
  --json number,title,url,state,isDraft,body,baseRefName,baseRefOid,headRefOid,changedFiles,additions,deletions
gh api --method GET --paginate --slurp 'repos/<OWNER/REPO>/pulls/<N>/files' \
  -f per_page=100 \
  --jq '[.[][] | {filename,previous_filename,status,additions,deletions}]'
```

Collect auxiliary state separately. Failure is unknown, not a core-material gap:

```bash
gh pr view <N> -R <OWNER/REPO> --json statusCheckRollup,mergeable
```

Record CI pass, failure including timeout terminal states, pending, cancelled/skipped, no checks, unknown, or mixed with explanation. Record conflict clear/conflicting/unknown. No checks is not all green; unknown mergeable does not prove conflict. Use current snapshots only; do not wait, rerun CI, or resolve conflicts.

- Compare file count with `changedFiles`. Complete collection after API limits, failure, or truncation. If impossible, use DISCUSS, explain the gap, set `source: null`, and retry later.
- Keep tests, documentation, lockfiles, generated files, renames, and deletions in scope. Generated contents can stay collapsed, but confirm source changes that produced them; do not omit them from scope judgment.
- If BASE/HEAD differs from selection, prepare that number again. Do not mix versions. Publication rechecks complete sources after analysis; continuously changing items remain incomplete.

Completion condition: metadata, full file inventory, and consistent snapshot exist, or a core gap is explicit. Unknown CI is not a core gap.

## 2. Read targeted evidence: value, scope, maintenance cost

Use title/body/file inventory to state a one-sentence goal, then verify key diff, callers, tests, and baseline capabilities. Use `gh pr diff <N> -R <OWNER/REPO>` and expand only sections affecting recommendation. Read corresponding base/head files when context is insufficient.

Write maintainer cards before technical detail:

| Field | Question |
| --- | --- |
| `title` / `originalTitle` | Concise English functional title; preserve GitHub title unchanged |
| `effect` | What can users now do, or what is fixed? 1–2 sentences plus key limits if needed |
| `value` | Why does it belong in the repository? One sentence, without repeating effect |
| `reason` | Why accept, simplify, discuss, or decline? The 1–2 most decisive points |
| `action` | What happens next? One sentence |

All six card fields are single-line. Put technical symbols, paths, test counts, and unexecuted-check notes in `scope`, `cost`, `integration`, or `evidence` unless decisive for the card. Concise expression does not reduce verification depth.

Answer these three questions for each PR with specific code/requirement evidence:

| Dimension | Check |
| --- | --- |
| Functional value | Who encounters which problem in what scenario? What benefit results? Does it fit product intent? Can existing features/configuration solve it; what is the added benefit? Documentation/tests/maintenance need real benefits too. |
| Implementation scope | Do key changes serve the goal? Are there unrelated refactors, duplicate implementations, premature abstractions, or extension points for hypothetical callers? Is reuse suitable in semantics and ownership? |
| Maintenance cost | What configuration, state, dependencies, persistence, entries, or compatibility branches are added? Is benefit worth the long-term cost? Is there a smaller solution that retains benefit? |

Specific checks:

1. Find behavior entry, key implementation, and callers. Check that tests express the benefit instead of trusting PR claims.
2. Search the baseline for relevant implementations. Identify locations for duplication claims; similar names alone do not justify reuse.
3. Identify the current requirement for each new mechanism. One caller is a review signal, not automatic excess; platform isolation/boundary preservation can justify it.
4. For simplification, identify mechanisms to delete, reuse, or separate and explain preserved behavior/tests/boundaries. Fewer lines cannot violate these constraints.
5. Claims that cost exceeds benefit need specific costs/alternatives. Ask when evidence is missing; personal preference is not fact.
6. Inspect CI/conflict logs only when relevant to design/maintenance judgment. Separate one-time fixes from long-term cost; do not turn this into CI debugging.

Stop when evidence distinguishes the four verdicts or a maintainer must decide remaining product questions. Do not explore irrelevant code to create questions or present uncertainty as lack of value.

## 3. Four recommendations

Each non-skipped PR gets exactly one verdict, matched in this priority order. Old FAST-MERGE tokens are unused.

| Token | Dashboard column | Decision |
| --- | --- | --- |
| DISCUSS | Discussion needed | Evidence gap, unclear requirement, or product choice could change verdict. Ask specific questions for named actors, not just “human review.” |
| DECLINE | Do not merge | Evidence shows direction mismatch, duplication without added benefit, or necessary maintenance cost clearly exceeding benefit; not merely conflict, CI, or large scope. |
| SIMPLIFY | Merge after simplification | Goal has value, but identifiable removable mechanisms/unrelated changes remain. Explain simplification and required retained benefit. |
| ACCEPT | Merge recommended | Real benefit; key changes match goal; maintenance cost reasonable; no prerequisite simplification/discussion found. Does not promise full correctness. |

Do not use DISCUSS merely because core packages are involved when evidence is sufficient. Use SIMPLIFY when explicit simplification retains the goal; do not reject a useful feature because its current design is complex.

Calibration: a necessary, reasonably priced Thread lifecycle fix can be ACCEPT across core packages. An unnecessary registry/persistence mechanism for one requirement is SIMPLIFY when existing paths suffice. Unclear scenario after investigation is DISCUSS. Confirmed existing capability without added benefit is DECLINE even for a few lines. Documentation, tests, and CI configuration also need real maintenance benefit.

Completion condition: one verdict, one-line reason, evidence or explicit gaps in all three dimensions. SIMPLIFY gives executable changes; DISCUSS asks concrete questions. Fill batch reply draft, next actor, and source-verification completion in the report.
