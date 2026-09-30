import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";

import { KiroAdapter } from "./kiro-adapter.js";

export const CODEX_Z_KIRO_COMMAND = "CODEX_Z_KIRO_COMMAND";

export function createHarnessAdapter(context: HarnessPluginContext): KiroAdapter {
  const environment = { ...context.environment };
  return new KiroAdapter({
    ...(environment[CODEX_Z_KIRO_COMMAND] ? { command: environment[CODEX_Z_KIRO_COMMAND] } : {}),
    environment,
  });
}
