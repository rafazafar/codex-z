import { packageMetadata as harnessAdapter } from "@codex-z/harness-adapter";
import { WORKSPACE_CONTRACT_VERSION } from "@codex-z/shared-contracts";

export { OpenCodeAdapter } from "./versioned-adapter.js";
export {
  OPENCODE_DEFAULT_PERMISSION_MODE_ID,
  OPENCODE_PERMISSION_MODE_CATALOG,
} from "./permission-modes.js";
export type { OpenCodeAdapterDependencies, OpenCodeAdapterOptions } from "./opencode-adapter.js";
export { managedOpenCodeEnvironment } from "./sdk-transport.js";
export type { OpenCodeServerDependencies, OpenCodeServerOptions } from "./sdk-transport.js";

export const packageMetadata = {
  name: "@codex-z/adapter-opencode",
  contractVersion: WORKSPACE_CONTRACT_VERSION,
  adapterContract: harnessAdapter.name,
} as const;
