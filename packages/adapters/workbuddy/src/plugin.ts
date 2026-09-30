import { BrokeredHarnessAdapter } from "@codex-z/harness-broker";
import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";
import { WorkBuddyAdapter } from "./workbuddy-adapter.js";
import { WORKBUDDY_COMMAND_CATALOG } from "./common.js";

export function createHarnessAdapter(context: HarnessPluginContext) {
  if (context.platform === "darwin" && context.managedRemoteHost)
    return new BrokeredHarnessAdapter({
      harnessId: "workbuddy",
      commandCatalog: WORKBUDDY_COMMAND_CATALOG,
      forwardDelegationEnvironment: true,
      environment: { ...context.environment },
      ...(context.brokerDescriptorPath ? { descriptorPath: context.brokerDescriptorPath } : {}),
    });
  return new WorkBuddyAdapter({
    environment: {
      ...context.environment,
      ...(context.launchCommand ? { CODEX_Z_WORKBUDDY_COMMAND: context.launchCommand } : {}),
    },
  });
}
