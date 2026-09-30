# Codex account display

codex-z no longer provides global Codex multi-account switching. Account means authentication identity and is distinct from Harness, Model, Provider, and Billing Source. It creates no Model proxy, account-specific backend, or per-Thread account routing.

Settings → Accounts shows the current official Codex identity, official `account/rateLimits/read` limits, and read-only `inspectAccount()` rows for other Harnesses. A separate action can copy compatible authorization once into Pi after explicit confirmation. This does not switch the official Codex login or create a Host credential collection. Official Desktop login/logout remains with the official backend. Host does not read or modify `.codex-z-native-accounts`.

See [account and usage-limit settings](codex-accounts.md) for visible behavior and implementation references.
