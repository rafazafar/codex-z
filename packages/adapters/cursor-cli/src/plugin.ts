import { CURSOR_COMMAND_CATALOG } from "./slash-commands.js";
import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";
import { CursorAdapter } from "./adapter.js";
import { BrokeredHarnessAdapter } from "@codex-z/harness-broker";
import type { HarnessAdapter } from "@codex-z/harness-adapter";

export function createHarnessAdapter(context: HarnessPluginContext): HarnessAdapter {
  if (context.platform === "darwin" && context.managedRemoteHost)
    return new BrokeredHarnessAdapter({
      harnessId: "cursor-cli",
      forwardDelegationEnvironment: true,
      commandCatalog: CURSOR_COMMAND_CATALOG,
      liveCommandCatalog: true,
      environment: { ...context.environment },
    });
  return new CursorAdapter({ environment: { ...context.environment } });
}
