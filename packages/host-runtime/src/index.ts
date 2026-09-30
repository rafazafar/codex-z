import { packageMetadata as desktopControl } from "@codex-z/desktop-control";
import { packageMetadata as harnessAdapter } from "@codex-z/harness-adapter";
import { packageMetadata as harnessBroker } from "@codex-z/harness-broker";
import { packageMetadata as mappingStore } from "@codex-z/mapping-store";
import { packageMetadata as protocolCore } from "@codex-z/protocol-core";
import { packageMetadata as sharedContracts } from "@codex-z/shared-contracts";
import { packageMetadata as updateManager } from "@codex-z/update-manager";

export { loadHarnessPlugins } from "./harness-plugin-loader.js";
export type {
  LoadHarnessPluginsOptions,
  HarnessPluginDiagnostic,
} from "./harness-plugin-loader.js";
export { HarnessPluginRegistry } from "./harness-plugin-registry.js";
export { installedHarnessPluginOptions } from "./installed-harness-plugins.js";
export {
  AppServerHost,
  classifyCreateRequestRoute,
  officialEnvironment,
} from "./app-server-host.js";
export type { AppServerHostOptions } from "./app-server-host.js";
export type { CodexAccountControl } from "./account/codex-account-control.js";
export { OfficialRuntimeScope } from "./codex-runtime/official-runtime-scope.js";
export { CodexRuntime } from "./codex-runtime/codex-runtime.js";
export {
  createRemoteAppServerWebSocketListener,
  isRemoteUnixListenerInvocation,
  remoteAppServerSocketPath,
  remoteUnixListenerUrl,
  stdioArgumentsForRemoteListener,
} from "./remote-app-server.js";
export type {
  RemoteAppServerSession,
  RemoteAppServerSessionStreams,
  RemoteAppServerWebSocketListener,
} from "./remote-app-server.js";
export { runDelegationCli, DELEGATION_HELP } from "./delegation-cli.js";
export { DelegationControlRegistry } from "./delegation-control-registry.js";
export { startDelegationControlServer } from "./delegation-control-server.js";
export { installDelegationSkills, CODEX_Z_DELEGATION_SKILL } from "./delegation-skill.js";
export {
  DELEGATION_CLI_PATH_ENV,
  DELEGATION_RUNTIME_ENDPOINT_ENV,
  DELEGATION_RUNTIME_TOKEN_ENV,
  DELEGATION_THREAD_ID_ENV,
  DelegationControlError,
} from "./delegation-types.js";
export type {
  DelegationControlApi,
  DelegationStartInput,
  DelegationStartResult,
  DelegationThreadListResult,
  DelegationThreadSnapshot,
  ThreadListInput,
  ThreadReadInput,
  ThreadWaitInput,
} from "./delegation-types.js";
export { hasLauncherManagedUpdateRuntime, runHostRuntime } from "./run-host-runtime.js";
export { runClaudeAquaHarnessBroker } from "./aqua-harness-broker.js";
export {
  REMOTE_CONTROL_BRIDGE_DESCRIPTOR_FILE,
  createRemoteControlAppServerPlan,
  publishRemoteControlAppServerDescriptor,
  remoteControlBridgeDescriptorPath,
  remoteControlBridgePipePath,
  runRemoteControlAppServerBridge,
} from "./remote-control-app-server.js";
export type {
  RemoteControlAppServerDescriptorV1,
  RemoteControlAppServerPlan,
} from "./remote-control-app-server.js";
export { runRemoteHostCli } from "./remote-host-cli.js";
export {
  inspectRemoteHostInstallation,
  installRemoteHost,
  uninstallRemoteHost,
} from "./remote-host-install.js";
export type {
  RemoteHostInstallationStatus,
  RemoteHostInstallOptions,
  RemoteHostManifestV1,
} from "./remote-host-install.js";
export {
  classifyRemoteHostProbeResponse,
  inspectRemoteHost,
  startRemoteHost,
  stopRemoteHost,
} from "./remote-host-lifecycle.js";
export type {
  RemoteHostLifecycleResult,
  RemoteHostRuntimeStatus,
  RemoteHostStatus,
} from "./remote-host-lifecycle.js";
export { createHostUpdateCoordinator } from "./update-coordinator.js";
export type {
  CreateHostUpdateCoordinatorOptions,
  HostUpdateCoordinator,
} from "./update-coordinator.js";
export { classifyThreadPurpose, RequestRouteObservationTracker } from "./route-observation.js";
export type {
  CreateRequestRouteObservation,
  RequestRouteObservation,
  ThreadPurpose,
  TrackedCreateRouteObservation,
  TurnRequestRouteObservation,
} from "./route-observation.js";
export const packageMetadata = {
  name: "@codex-z/host-runtime",
  dependencies: [
    protocolCore.name,
    desktopControl.name,
    harnessAdapter.name,
    harnessBroker.name,
    mappingStore.name,
    sharedContracts.name,
    updateManager.name,
  ],
} as const;
