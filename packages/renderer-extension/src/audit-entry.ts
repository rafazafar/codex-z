import { inspectRendererContracts } from "./contract-audit.js";

window.__codexZContractAuditV1 = Object.freeze({
  inspect: () => inspectRendererContracts(window),
});
