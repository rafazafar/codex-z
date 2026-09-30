import { WORKSPACE_CONTRACT_VERSION } from "@codex-z/shared-contracts";

export { MappingStore, MappingStoreError } from "./mapping-store.js";
export type { MappingStoreErrorCode, MappingStoreOptions } from "./mapping-store.js";
export {
  delegationStatusSchema,
  storedDelegationRecordV1Schema,
  storedThreadRecordV1Schema,
  storedTurnMappingV1Schema,
} from "./records.js";
export type {
  CommitReadyThreadInput,
  CreateDelegationInput,
  CreateProvisionalThreadInput,
  DelegationStatus,
  FindRecentDelegationInput,
  RebindSubagentSessionInput,
  ReplaceReadySessionAfterLastTurnInput,
  ReplaceReadySessionInput,
  StoredDelegationRecordV1,
  StoredThreadRecordV1,
  StoredTurnMappingV1,
  ThreadMetadataPatch,
} from "./records.js";

export const packageMetadata = {
  name: "@codex-z/mapping-store",
  contractVersion: WORKSPACE_CONTRACT_VERSION,
} as const;
