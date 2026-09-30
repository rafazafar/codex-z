import { packageMetadata as harnessAdapter } from "@codex-z/harness-adapter";
import { WORKSPACE_CONTRACT_VERSION } from "@codex-z/shared-contracts";

export { ClaudeCodeAdapter } from "./claude-code-adapter.js";
export type { ClaudeCodeAdapterOptions } from "./claude-code-adapter.js";

export const packageMetadata = {
  name: "@codex-z/adapter-claude-code",
  contractVersion: WORKSPACE_CONTRACT_VERSION,
  adapterContract: harnessAdapter.name,
} as const;
