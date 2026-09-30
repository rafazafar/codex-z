# Account and usage-limit settings

Settings → Accounts shows the current Codex identity/limits and other Harness `inspectAccount()` snapshots. codex-z does not manage multiple native Codex logins: no add/login/switch/logout/delete/restore or reset-card consumption. Official Desktop login/logout stays with its backend. After explicit confirmation, users can copy compatible local authorization once into a separate Pi Provider configuration. This limited extension of read-only settings creates no Host credential store and changes no native login.

If `.codex-z-native-accounts` still exists locally, startup/refresh does not read, change, or remove it.

## Account list

The upper table has Account / 5-hour limit / 7-day limit / Used by Harness. Below is Accounts in Pi. The Harness column contains only small Pi import icons. Per-row refresh/native-management actions are removed; toolbar refresh is global and native-management limits appear only in identity hover text. Narrow windows show independent rows with top-right icons, side-by-side windows, then stacked windows at minimum width. The existing settings shell supplies borderless search/global refresh. Each row uses its product Logo; Codex uses its official icon, replacing the purple terminal drawing. Recognized Pi vendors use the same Logos. Toolbar account count includes current Codex and returned Harness accounts regardless of search.

- Title shows full email/name, truncated to one line with full identity on hover. Agent, actual plan, and Current Codex are secondary. Hide local `CODEX_HOME`.
- Search the whole list by email, name, Agent, or plan; show one empty state only when neither account group matches. Codex rows follow Host order first; others generally follow stable Harness ID, with Antigravity CLI last. Do not reorder by remaining limits/current state.
- Compare 5-hour and 7-day limits separately; weekly limits use the 7-day column. Missing windows show only '—', not 0% used/100% remaining. Monthly/model-group/product limits appear under identity with their own names. They are not total account limits; do not merge/drop duplicate reports.
- Default view is Remaining, with a Used toggle and matching headers. Bars/numbers use the selected basis; risk colors use consumption: warning from 70%, emphasis from 90%.
- Each percentage has a muted countdown with at most two units: `6d17h`, `4h54m`, or `14m`. Right-aligned local reset time below is `09/15 10:08`; hover/accessibility includes year/timezone. Without a valid reset time, fabricate no date/countdown.
- Update countdowns locally every minute and on focus without Host queries or row rebuilds. At expiry show Awaiting refresh, not automatic 100%. Stop timing when settings closes.
- Current Codex limits come from official `account/rateLimits/read`. Distinguish loading/failure/no data; allow retry and do not convert unknown into 0%. Responses after page close do not update it.
- Plan comes from official identity. Current display maps `prolite` to highlighted Pro 5x and `pro` to highlighted Pro 20x. Plus/Team stay normal; hide `unknown`. This changes display only, not raw protocol values. Official interfaces provide no renewal time, so omit renewal dates.

Menu-bar/taskbar Codex-limit display retains existing behavior. No new surfaces or refresh mechanisms are added.

## Codex limits and external-Harness submission

When ChatGPT-authenticated Codex subscription limits are exhausted, Renderer disables Composer through account-limit and reserve `hardBlocked` booleans. API Key login bypasses both. These are UI subscription prechecks, not protocol limits. Host routes external `turn/start` without sending it to official backend.

For one Composer with an external Agent, ready Adapter, and no codex-z submission blocker, `renderer-codex-usage-gate.ts` projects only that Composer's two subscription snapshots as `false` and continues native submission. It writes no account/atom/limit cache. The Codex banner remains. Other Composers, official routing, and empty-input/attachment/running restrictions remain. External Harnesses own their limits/errors. Switching to Codex, removing Composer, or unloading extension restores live native results.

Identify gates by fields actually read by selectors, not minified names/hook indices. If not unique, retain native limits and explain in Agent hover text. See [upgrade diagnostics](../operations/codex-desktop-upgrade-diagnosis-playbook.md#check-codex-usage-gates).

## Other Harness read-only account limits

The list shows real readable limits for current native Grok Build, agy (Antigravity), and Claude Code authentication. Harness target icons replace the management column; account descriptions retain native-management boundaries. This is not multi-account management: no add/delete/switch/default/reset, and no Codex-account changes. Search and Used/Remaining apply to all rows. Refresh rechecks both groups. Harness queries run independently in parallel and display each valid result immediately, also during global refresh.

- Show accounts only with valid windows. API Keys, third-party Providers, signed-out/no-data/failed queries produce no placeholder rows. Host caches completed inspection per Harness for 15 seconds, reusable on immediate settings reopen. Toolbar refresh bypasses it and does not reuse previous limits, preventing stale identities after logout/auth changes.
- Show product/vendor Logos. Prefer email/recognizable name as title, with Harness/plan secondary. Without identity, use Harness name without duplicates or Current login text. Do not guess email. Truncate with full hover identity. Do not record/show snapshot update times or use prototype example plans as data.
- Grok uses native xAI OAuth/billing for periods, resets, and product usage. Never send other-issuer Tokens to xAI. Prefer `creditUsagePercent`; when omitted, use native legacy `monthlyLimit` / `used`. Without positive plan limits but with known weekly/monthly period and valid reset, show native zero-use 0% used/100% remaining and retain the row. Failed requests, empty configuration, and invalid fields do not become zero. `onDemandCap` / `onDemandUsed` money is not plan percentage. Explicit `XAI_API_KEY`, `GROK_API_KEY`, or `GROK_TOKEN` suppresses saved OAuth display conservatively. This page does not determine per-Model Thread credentials or actual Billing Source.
- agy runs native `--print=/usage --output-format stream-json`; CLI owns authentication. Display real groups/windows. Current output has no email/plan, so title is Harness name.
- Claude Agent SDK 0.3.220 uses `usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET()` and `accountInfo()`. Project only valid plan windows with `rate_limits_available`, including Model-specific windows. Session Tokens/costs/extra-use money are not limit percentages. `extra_usage` is not displayed. Older SDK/CLI without this experimental method shows no data.
- Queries need no existing Thread/model Turn. Claude inspection uses empty input, no tools, and no Session persistence, closing the process on success/failure/timeout. Broker forwards the same read-only capability.

Public flow: `HarnessAdapter.inspectAccount()` → `codex-z/harness/accounts/sources` / `codex-z/harness/accounts/inspect` → settings. Old Hosts can fall back to aggregate `codex-z/harness/accounts/list`. Progressive/aggregate routes share per-Harness 15-second cache/in-flight requests. Snapshots contain display identity/plan/limits only, no credentials/native paths/SDK objects. Host has no concrete-Adapter dependency. Query only loaded plugins; one failure/timeout does not block others.

## Manual Pi import

- Only Codex/Grok rows have 16px Pi icons; others, including Claude, have none. Uncopied icons are muted; copied ones have normal intensity/dot, with warning color after configuration changes. Hover shows name/state. Clicking an uncopied icon opens one confirmation with source, model-entry name, scope, and risks. No write precedes confirmation. Success shows once in the same dialog: new Pi Sessions can use it without restart; reopen existing Sessions if absent. Copied icons scroll to records. First Provider account defaults to `codex` / `grok`; later ones use email prefixes such as `codex-alice/…`, then `codex2`/`codex3` for conflicts/no email. Multiple accounts per Provider have separate entries. Names are 1–48 lowercase letters/digits/hyphens, starting with a letter.
- Support only field/client-validated file-based Codex ChatGPT OAuth and Grok xAI OAuth. API Keys, Keychain Codex, and Claude sources are unsupported. Incompatible/unavailable targets hide icons. Changed source identity rejects stale submissions and requires refresh/reconfirmation.
- Pi Adapter writes separate `auth.json` entries, `extensions/codex-z-account-<name>/`, and nonsensitive records in configured Pi home (`PI_CODING_AGENT_DIR` supported). Installed native authentication locks coordinate writes; reuse installed OAuth refresh/model transport. Do not overwrite built-ins, credentials, model configuration, or existing owned names. Rename on conflicts. Offline Pi catalog checks enabled-extension names before import; later external extensions can still register names, so choose unused ones.
- Require npm-installed Pi exposing native Provider/AuthStorage modules. Extensions reference the detected installation path; moving/removing it needs repair/reimport. No dependency install, login, token refresh, or paid-model probe occurs.
- Accounts in Pi appears only with an available target, using the same cards. Records show source identity/mark, source Agent, `name/…`, Copied, and time, plus Reimport/Remove. Do not show Validated/Unvalidated because no source confirms invocation success. If source is no longer current (changed/signed out/API), retain records without warnings; disable Reimport but keep Remove. Show guidance without records. Do not duplicate limits or claim existing Pi configuration. User-modified/deleted imported credentials lose feature ownership and disappear without status text; remaining credentials appear as ordinary Pi logins. Do not automatically remove leftover extension directories or warn in UI; Pi owns them. Skip metadata-read failures without affecting others.
- Unavailable Pi hides the whole section/icons without placeholders/errors: missing, non-npm, missing import modules, or never run/no user directory.
- Accounts in Pi lists all `auth.json` logins, imported records first with actions. Existing logins are in a **collapsed by default** Pi-owned configuration N group, read-only without buttons. OAuth vendor detection uses token issuer/client ID, the same constants as Codex/Grok export validation, independent of entry names. Other clients from the same issuer, API Keys, and unknown entries keep neutral Pi marks. Collapse state is page-local and resets on reopen; no group appears without existing logins. Rows show account label and Provider · type (OAuth / API Key / Other). Email labels require local token decoding; otherwise title is Provider. Also list `models.json` custom Providers with embedded `apiKey`, typed API Key, using differing `name` as label. Merge model-only configuration with `auth.json` credentials by Provider to avoid duplicate rows. Show no secrets/expiry, use no network/limit queries. Environment/extension-managed logins are excluded. Guidance appears only with no Pi logins at all.
- Confirm removal again. Remove only owned Provider extension, credential, and record; retain other configuration/user-added files. Do not log out source or revoke server authorization. New Pi Sessions start processes with latest configuration without codex-z restart; existing processes can retain old configuration.
- Copy is not continuous sync or extra quota. Both sides refreshing one refresh token can affect each other's login. Provider defines Billing Source. Copied does not mean credentials/Models still work. Reimport also requires confirmation and updates only still-owned entries from the same current source. For account changes, add a new entry without deleting old ones.
- Browser contracts contain source IDs/labels/Provider types/import states plus other login Provider names/types/optional account labels/recognized vendors only. Source `credentialExport` and target `credentialImports` exchange authorization only in backend. Host Codex module supplies native source. `codex-z/harness/credential-imports` accepts no token/path and forwards no raw SDK exceptions. No cross-Host/SSH credential transfer exists.

## Reset cards

If a snapshot has reset cards, show Reset cards N below Codex identity. Expand nearest expiry and per-card expiries from the interface. Do not allocate a separate column or infer zero from missing data. codex-z offers no Consume reset and calls no official consumption API. Limit reset time and card expiry are distinct.

## Official authentication

Forward Desktop `account/login/*` / `account/logout` unchanged to official backend. Host creates no credential collection; only confirmed imports write target-owned storage. Do not replace loginId or reconstruct native results. Settings can refresh identity/limits after official authentication.

SSH retains remote native single-account authentication without local-credential transfer.

## Usage popover

The popover does not duplicate 5-hour/7-day limits; the dedicated limit control shows them.

For Codex, show current Host global identity read-only, not historical Thread binding. Host switching updates state. Identity remains visible before Token Usage exists. Other Harnesses show no Codex account.

## Implementation and validation

- `docs/product/codex-native-account-switching-design.md`: Read-only limits after multi-account removal.
- `packages/host-runtime/src/account/codex-account-control.ts`: Current official identity projection.
- `packages/host-runtime/src/native-account-host.ts`: Local current identity reads.
- `packages/host-runtime/src/native-account-observer.ts`: Post-authentication display updates without credential collection.
- `packages/renderer-extension/src/settings/accounts-page.ts`: Identity/limits/manual import.
- `packages/renderer-extension/src/settings/credential-imports.ts`: Pi icons, confirmation, and Pi section.
- `packages/adapters/pi/src/pi-credential-imports.ts`: Native storage/import ownership.
- `packages/host-runtime/src/credential-imports.ts`: Public-contract credential routing.
- `packages/renderer-extension/src/settings/accounts-list.ts`: Account rows/reset-card expansion.
- `packages/renderer-extension/src/settings/accounts-usage.ts`: Window columns/named limits/reset details.
- `packages/renderer-extension/src/settings/accounts-reset-time.ts`: Compact reset time/local countdown.
- `packages/renderer-extension/src/settings/harness-accounts.ts`: Other-Harness inspection states.
- `packages/host-runtime/src/harness-accounts.ts`: Public aggregation/validation.
- `packages/shared-contracts/src/harness-accounts.ts`: Browser-safe snapshots/requests.
- `packages/renderer-extension/src/settings/accounts.css`: Light/dark/narrow layouts.
- `packages/renderer-extension/test/settings/`: Settings/limit unit tests.
- `tests/e2e/renderer-settings-accounts.spec.ts`: Real shell/render code with isolated simulated clients for layout/interactions; no real account services.
