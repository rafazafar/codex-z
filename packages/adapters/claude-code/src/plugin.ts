import type { HarnessAdapter } from "@codex-z/harness-adapter";
import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";
import { BrokeredHarnessAdapter } from "@codex-z/harness-broker";

import { ClaudeCodeAdapter, claudeCommandCatalog } from "./claude-code-adapter.js";

import { withUserShellEnvironment } from "./user-shell-environment.js";

export const CLAUDE_CODE_COMMAND_ENV = "CODEX_Z_CLAUDE_COMMAND";

export async function createHarnessAdapter(context: HarnessPluginContext): Promise<HarnessAdapter> {
  const environment = await withUserShellEnvironment({ ...context.environment });
  if (context.platform === "darwin" && context.managedRemoteHost) {
    return new BrokeredHarnessAdapter({
      commandCatalog: claudeCommandCatalog,
      liveCommandCatalog: true,
      environment,
      ...(context.brokerDescriptorPath ? { descriptorPath: context.brokerDescriptorPath } : {}),
    });
  }
  return new ClaudeCodeAdapter({
    ...(environment[CLAUDE_CODE_COMMAND_ENV]
      ? { command: environment[CLAUDE_CODE_COMMAND_ENV] }
      : {}),
    environment,
  });
}

export async function warmup(adapter: Pick<HarnessAdapter, "inspect">): Promise<void> {
  try {
    await adapter.inspect();
  } catch {
    /* Optional prefetch cannot fail Host startup. */
  }
}
