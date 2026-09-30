import { packageMetadata as harnessAdapter } from "@codex-z/harness-adapter";
import { WORKSPACE_CONTRACT_VERSION } from "@codex-z/shared-contracts";

export { DeepSeekHarnessAdapter } from "./deepseek-harness-adapter.js";
export type {
  DeepSeekHarnessAdapterDependencies,
  DeepSeekHarnessAdapterOptions,
} from "./deepseek-harness-adapter.js";

export const packageMetadata = {
  name: "@codex-z/adapter-deepseek-harness",
  contractVersion: WORKSPACE_CONTRACT_VERSION,
  adapterContract: harnessAdapter.name,
} as const;
