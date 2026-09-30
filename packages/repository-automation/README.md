# Repository automation

Private source ESM package without third-party runtime dependencies. Trusted GitHub workflows use its public `index.mjs`; it is not bundled into the Host product.

- `runMaintenance` / `maintainItem`: label only explicit `fix:` / `feat:` / `docs:` PR titles. When current HEAD CI finishes, update one short result comment. For failure, include sanitized original log excerpts.
- Do not process Issues, request template completion, summarize reviews, check specification risks, or send long-wait reminders.
- `readReleaseMetadata` / `resolveRelease` / `verifyRelease`: keep release version, tag, commit, and CI evidence consistent.
- `validateReleaseVersion`: shared version validator for release preparation scripts.

Maintenance entries write by default. Callers must explicitly use `dryRun: true` for read-only previews. The manual GitHub entry defaults to preview. Automation does not call models, execute PR code, merge, or publish automatically.

See [repository maintenance automation](../../docs/operations/repository-maintenance.md).
