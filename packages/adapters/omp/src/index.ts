import { packageMetadata as harnessAdapter } from "@codex-z/harness-adapter";
import { WORKSPACE_CONTRACT_VERSION } from "@codex-z/shared-contracts";

export { OmpAdapter } from "./omp-adapter.js";
export type { OmpAdapterOptions } from "./omp-adapter.js";
export {
  OMP_DEFAULT_PERMISSION_MODE_ID,
  OMP_PERMISSION_MODE_CATALOG,
  decodeOmpPermissionModeId,
  encodeOmpPermissionModeId,
} from "./omp-permission-modes.js";
export type { OmpPermissionMode } from "./omp-permission-modes.js";
export const packageMetadata = {
  name: "@codex-z/adapter-omp",
  contractVersion: WORKSPACE_CONTRACT_VERSION,
  adapterContract: harnessAdapter.name,
} as const;
