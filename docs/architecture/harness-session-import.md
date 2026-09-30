# Local Harness session import

## Current scope

Settings → Session import registers native Sessions from **Claude Code, Pi, Hermes**, and **DSH** (validated `0.1.2-rc.1` / `0.1.5-rc.1` / `0.1.5-rc.2` / `0.1.5-rc.3` / `0.1.7-rc.1`; see [DSH validation](../harnesses/deepseek/dsh-015rc1-validation.md) for commands and limits). Import creates only a Host Thread/native Session mapping. It copies no Transcript, converts no Harness, and sends no user Turn. Opening uses the corresponding Adapter `open({ kind: "resume" })` to restore history and continue.

- Settings always uses the local Host, even when Composer is connected to a remote workspace.
- Available Harnesses come from loaded Host Adapters with both discovery and resolution capabilities, not a built-in Renderer list.
- The catalog means an import interface exists, not that the current native runtime works. Incompatible DSH protocols, old Hosts, missing plugins, and unavailable storage fail explicitly instead of appearing as no candidates.
- DSH allows only local codex-z managed Web. The listed versions are validated. Other SemVer versions may attempt connection/import but must pass native Web/history protocol checks. Legacy support was removed. Version numbers do not guarantee compatibility.
- This change adds no remote scan or Claude Code Broker import and does not complete dynamic plugin support for the whole Agent Picker.

## Adapter contract and responsibilities

Defined in `packages/harness-adapter/src/text-session.ts`:

```ts
interface HarnessSessionImportCapability {
  listCandidates(): Promise<HarnessResult<readonly HarnessSessionImportCandidate[]>>;
  resolveCandidate?(nativeSessionId: string): Promise<HarnessResult<HarnessSessionImportSource>>;
}

interface HarnessSessionImportSource {
  candidate: HarnessSessionImportCandidate;
  nativeRef: NativeSessionRef;
}
```

`resolveCandidate` is optional for older discovery-only plugins. Adapters without it **cannot import**. Host must not construct a default native reference from an ID.

- `listCandidates`: Return bounded IDs, titles, update times, cwd, and running states only. Exclude locators, credentials, Transcripts, and native RPC payloads.
- `resolveCandidate`: Rediscover and validate the selected ID read-only, confirming a resumable project and full native reference. Missing Sessions return `sessionNotFound`; unsupported protocols return `unsupported`. Do not trust cached list metadata.
- `candidate.nativeSessionId`, `nativeRef.nativeSessionId`, and owning Harness must match.
- `running: true` means known busy and Host rejects import. `false` means reliably idle; `null` means unknown. Unknown must not become false.
- No new discovery starts after Adapter close. Cancel and finish active local scans. Plugins must not manipulate the Host mapping store directly.

For Harnesses already integrated with Desktop, adding these methods, verifying native resume, and adding Adapter tests reuses the local Host/RPC/import page. No dedicated importer or Renderer switch is needed. Product integration of new plugins still follows [Renderer boundaries](harness-plugin-runtime.md).

## Host and browser boundaries

Public strict schemas are in `packages/shared-contracts/src/harness-session-import.ts`:

| Fixed RPC | Request | Response |
|---|---|---|
| `codex-z/harness/session-import/sources` | `{}` | `{ harnesses: [{ harnessId, name }] }` |
| `codex-z/harness/session-import/list` | `{ harnessId, query?, offset?, limit? }` | `{ candidates, total }` |
| `codex-z/harness/session-import/import` | `{ harnessId, nativeSessionId }` | `{ threadId }` |

Default page size is 20; the page offers 20 / 50 / 100, total count, and previous/next navigation. Search matches title, Session ID, and project path case-insensitively across all candidates. Search submission or Harness/page-size changes return to page one. Host filters mapped Sessions, applies search, sorts by activity time and stable ID, then paginates. `total` is the filtered count. The 1,000-item response limit protects wire pages, not total storage/candidates.

Old `codex-z/deepseek/modern-session/list` / `import` remain compatibility aliases in Host and share the DSH importer and notification deduplication set. Old list returns `{ candidates }`, using the same SemVer/protocol validation without a separate version whitelist. These RPC aliases are distinct from removed DSH Legacy protocol support. New Renderer uses only public RPC. Old Hosts without it show unavailable, without unverified native-bridge fallback. Storage-read failures show 'Cannot read local sessions', not 'Import unsupported'.

`HarnessSessionImporter` responsibilities:

1. Filter ordinary ready Thread mappings for the same Harness. Subagent mappings do not represent ordinary Session owners.
2. Combine requests by `(harnessId, nativeSessionId)` and prefer an existing mapping.
3. Call the Adapter resolver, validate fresh metadata/identity, then check whether a concurrent submitter won.
4. Create a provisional mapping, commit full `nativeRef`, and retain `notLoaded`. Persistence failures clean up provisional state; uniqueness conflicts reuse the winning mapping.
5. Return the Host Thread ID. Renderer navigation failure cannot undo a committed mapping. Preserve project path and allow retry. Remounts and stale requests cannot navigate twice.

Host cannot lock external clients between resolver and resume. There is no cross-process Session ownership-transfer protocol.

## Pi native rules

Implementation: `packages/adapters/pi/src/pi-session-import.ts`. Rules were checked against official Pi `sessions.md`, `session-format.md`, `environment-variables.md`, and SessionManager, with local version **0.85.0**:

- Scan `~/.pi/agent/sessions/<encoded-cwd>/*.jsonl` by default, expanding one project-directory level only.
- `PI_CODING_AGENT_DIR` replaces the agent root; `PI_CODING_AGENT_SESSION_DIR` takes priority for a flat Session directory. Match Host environment to any native `--session-dir` used by clients. The page accepts no arbitrary file path.
- Read only v3 Session headers and Entry trees. Track user-message ancestry while streaming; the final Entry branch must contain a user message. Skip old formats, damaged content, broken/duplicate Entries, branches without users, and missing projects. Import does not migrate files.
- Prefer latest `session_info.name` for title, then the first user text (string/text blocks) truncated to the title limit; use null only when no text exists. Use message activity time, or file modification time if absent. Resolve project/file paths to real paths.
- Native refs must include `locator: { sessionFile }`. Host persists it unchanged; Pi resume checks Session ID, cwd, and active branch against that file.
- Pi has no reliable cross-process running marker, so candidates always have `running: null`. **Close the native-client Session before import** to prevent two writers on one JSONL. UI shows unknown state and a warning, without claiming exclusive ownership.
- Scans start no Pi process, write no file, and do not follow enumerated file/directory symlinks. Check device, inode, size, mtime, and ctime before/after reads. Temporarily skip files changing during list scans without blocking others. Changes during selected-item resolution reject import.
- **No fixed total-size, file-size, file-count, directory-entry, Entry-count, or total-candidate limit exists.** Initial discovery still streams native JSONL for accurate titles/active branches. It does not paginate Transcript parsing or keep complete Transcripts in memory.
- Each Adapter caches file fingerprints and valid candidate metadata. Pagination/search/refresh reparses only new or changed files and removes deleted files. Cache has no message bodies and is not persisted across instances.
- Import revalidates the selected file. Other new/changed files read only headers for ID ambiguity without full-history parsing. Permission/identity ambiguity fails explicitly. Duplicate Session IDs are not silently resolved to one file.

These checks provide correctness, streaming, and cancellation. They are not a security sandbox for malicious local-file replacement.

## Claude Code native rules

- Scan `~/.claude/projects/<encoded-cwd>/*.jsonl` by default. `CLAUDE_CONFIG_DIR` replaces `.claude`. Expand only one project-directory level; exclude Session subdirectories/Subagent Transcripts and enumerated symlinks.
- CLI and Agent SDK Sessions use the same native JSONL and both become candidates. `entrypoint` affects only Claude CLI picker display, not codex-z import/resume identity.
- Session ID must be a UUID matching its filename. Main Sessions need at least one non-sidechain user/Assistant record and absolute cwd. Resolve project paths to existing real directories; skip invalid/identity-mismatched files.
- Titles prefer latest `custom-title`, then AI/summary title, then first user text. Ignore Tool Results and internal `<local-command-…>` / `<command-…>` records. Collapse whitespace into one line and truncate to 120 characters. Update time is file modification time.
- Native refs save only Harness/Session ID, without locator. Claude Adapter resumes by ID/cwd; current locator semantics are reserved for codex-z Pending Sessions not yet started.
- Claude Code has no reliable cross-process running marker, so `running: null`. Close the CLI/other-client Session before import to prevent concurrent appends to one Transcript.
- Scan read-only and stream parsing. Start no Claude, send no Turn, and change no JSONL. Check device, inode, size, mtime, and ctime around reads. Skip actively written files temporarily; reread selection before commit.
- Each Adapter caches candidate metadata by fingerprint. Pagination/search/refresh does not reparse unchanged complete Transcripts. Duplicate IDs fail explicitly instead of silently selecting one.

Import and the native Claude CLI Session list have separate boundaries. This page can import old `sdk-ts` Sessions. New codex-z SDK Sessions persist `codex-z-sdk` entrypoint so current Claude CLI pickers can also list them.

## DSH native rules

- Discover and revalidate candidates through managed Web's public Session API. Do not scan or modify native DSH logs directly.
- Import registers mappings only. Native history is read on Thread open and continues the same Native Session ID. `0.1.2-rc.1` uses V0; validated `0.1.5-rc.1` / `0.1.5-rc.2` / `0.1.5-rc.3` use V3 and separate Assistant streams; `0.1.7-rc.1` uses V4 and validates `developer/message`, surface refs, Assistant blocks, and Fork closer. System/developer instructions participate in native refs but are not user Turns.
- Log sequence numbers and checkpoints are not interchangeable. DSH owns migration. codex-z does not use old checkpoints as migrated sequences or supply downgrade migration. See [revision and recovery](../harnesses/deepseek/dsh-edit-recovery.md).
- If the configured loopback endpoint already has a DSH Web that cannot be authenticated, close it first and rerun connection diagnostics so codex-z starts its own Web. It does not adopt or stop external processes.

## Validation

Focused tests cover Claude CLI/SDK entrypoints, directories/titles, bad files, Subagent exclusion, disappearance/ambiguity, read-only discovery, cache, and precommit checks; Pi directories, active branches, bad files, disappearance/ambiguity, cancellation, read-only discovery, valid data beyond former 64 MiB/256 MiB and 100,000 Entry limits, cache invalidation, and selected-item recheck; Host locator persistence/restart, equal IDs across Harnesses, old DSH RPC, idempotence/races/busy/failure cleanup, filtered pagination and cross-page search; Renderer dynamic sources, page-size/boundaries, stale search responses, import control locks, unknown state, deduplication, and navigation recovery.

A real Pi **0.85.0** `SessionManager` also created isolated temporary Sessions, registered through public Host importer, then resumed history and continued one Turn with real `pi --mode rpc --session ...`. It verified the same Session ID and JSONL file. This used a loopback simulated Provider, no paid Model service, and no existing user Session reads/writes.

This is not Codex Desktop end-to-end acceptance and does not prove Windows, remote, or real-device DSH validation in this change.
