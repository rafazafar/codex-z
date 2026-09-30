import { packageMetadata as harnessAdapter } from "@codex-z/harness-adapter";
import { WORKSPACE_CONTRACT_VERSION } from "@codex-z/shared-contracts";

export { PiAdapter } from "./pi-adapter.js";
export type { PiAdapterOptions } from "./pi-adapter.js";

export const packageMetadata = {
  name: "@codex-z/adapter-pi",
  contractVersion: WORKSPACE_CONTRACT_VERSION,
  adapterContract: harnessAdapter.name,
} as const;
