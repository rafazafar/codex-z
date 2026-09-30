# Issue triage

Purpose: show maintainers **the problem, the evidence boundary, and the next actor**. Do not automatically confirm bugs, close Issues, or accept requirements.

## Verification

1. Read the body, all comments, and existing maintainer decisions. Use the repository's trusted default-branch SHA as code baseline, not only titles/other AI conclusions.
2. Identify user scenario, expected behavior, and actual behavior. Distinguish reporter claims, code checks, executed reproduction, and unverified inference. Do not present a reporter's claimed cause as confirmed.
3. Request only information needed for diagnosis: codex-z/Codex Desktop versions, OS/architecture, installation method, Harness/version, local/SSH/Remote Control, reproduction, sanitized errors/screenshots. Do not mechanically request all environment fields for requirements/documentation.
4. Search relevant existing capabilities, Issues, PRs, and documents. Continue pagination or narrow search as needed. State limits of bounded searches; do not claim a full-repository search without evidence.
5. Separate related from duplicate. Same Harness, similar title, or error text does not prove the same cause. Provide verified links/reasons and identify differing versions, entries, failure layers, or symptoms.

## Output

Use the report-format Issue structure:

- `title` / `originalTitle`: English problem title and unchanged original title.
- `summary`: brief actual problem and key limits.
- `category`: bug / feature / question / documentation / unknown; local recommendation, no label changes.
- `priority`: urgent / normal / unknown. Urgent needs impact/evidence in reason, such as blocked startup, old Session recovery, or a security boundary. Strong wording alone is insufficient.
- `reason` / `evidence`: key basis and validation boundary. With reporter evidence only, explicitly say reported and not reproduced.
- `missingInfo`: specific needed information; empty array if none.
- `related`: related Issue/PR URLs with reasons, not automatic duplicate-close decisions.
- `action` / `nextActor`: one clear next step/actor, such as author reproduction, maintainer verification, contributor tests, or maintainer product decision. No automatic assignment.
- `replyDraft`: short author-facing draft. Acknowledge information; state current judgment/questions/next step without promising undecided fixes or release dates.

Do not use PR ACCEPT / SIMPLIFY / DISCUSS / DECLINE. Recommend splitting distinct problems, but do not reject content for format, length, or missing templates. Do not request Tokens, full Account files, or unsanitized logs.

Stop when evidence permits an actionable next step or more judgment requires author information/maintainer choice. Completed information-request triage can record the processed source. API/code collection failures or incomplete analysis cannot.

Publishing replies, labels, close, and reopen are outside this skill. Close recommendations require evidence such as verified duplication, fixing commit/PR/version, or a maintainer rejection reason. Provide advice for human confirmation only.
