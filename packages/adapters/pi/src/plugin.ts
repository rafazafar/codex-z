import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";

import { PiAdapter } from "./pi-adapter.js";

export const PI_COMMAND_ENV = "CODEX_Z_PI_COMMAND";

export function createHarnessAdapter(context: HarnessPluginContext): PiAdapter {
  const environment = { ...context.environment };
  return new PiAdapter({
    ...(environment[PI_COMMAND_ENV] ? { command: environment[PI_COMMAND_ENV] } : {}),
    environment,
  });
}
