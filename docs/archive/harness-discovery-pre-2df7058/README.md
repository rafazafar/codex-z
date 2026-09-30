# Historical Harness Discovery analysis archive

> **Archived and obsolete. Do not use as current implementation guidance.**
>
> Replacement document: [`../../architecture/harness-executable-discovery.md`](../../architecture/harness-executable-discovery.md)
>
> Replacement implementation: `2df7058 feat: unify harness executable discovery`

## Reason for archive

This directory preserves exploratory analysis from before unified Harness executable discovery. Original material had these problems:

- Confused native Codex Desktop/codex-z installation discovery with external Harness CLI discovery.
- Described individual Adapter search implementations as long-term contracts.
- Some conclusions were replaced by `@codex-z/harness-discovery`.
- Environment variable names, search directories, and support scope sometimes conflicted.
- Included obsolete claims such as “Pi does not support automatic discovery.”
- Covered few directories such as NVM, without shared discovery of fnm, Volta, asdf, nodenv, Bun, pnpm, or Homebrew keg-only Node.

## Original material inventory

Five temporary files were originally generated:

1. `DISCOVERY-LOCATIONS-SUMMARY.txt`
2. `HARNESS-DISCOVERY-QUICK.txt`
3. `HARNESS-DISCOVERY.md`
4. `codex-z-discovery-analysis.md`
5. `codex-z-discovery-quick-reference.md`

They were removed before entering Git history and cannot now be recovered verbatim. These topic archives preserve decision context in their place:

- [`01-desktop-install-discovery-notes.md`](01-desktop-install-discovery-notes.md): native Codex Desktop/codex-z installation discovery.
- [`02-per-adapter-harness-discovery-notes.md`](02-per-adapter-harness-discovery-notes.md): Adapter CLI discovery before the shared package.
- [`03-invalidated-conclusions.md`](03-invalidated-conclusions.md): obsolete or conditional conclusions and replacement facts.

This archive does not invent the lost files' exact contents. It retains only analysis topics and incorrect conclusions confirmed from the workspace inspection and later implementation.

## Usage rules

- For current behavior, read replacement documentation/source first.
- Do not link this directory as current installation/configuration guidance.
- Update current documents for future implementation changes; do not keep revising this archive.
