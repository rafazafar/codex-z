import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";

import { OpenCodeAdapter } from "./versioned-adapter.js";

export const OPENCODE_COMMAND_ENV = "CODEX_Z_OPENCODE_COMMAND";

export function createHarnessAdapter(context: HarnessPluginContext): OpenCodeAdapter {
  const environment = { ...context.environment };
  return new OpenCodeAdapter({
    ...(environment[OPENCODE_COMMAND_ENV] ? { command: environment[OPENCODE_COMMAND_ENV] } : {}),
    environment,
  });
}
