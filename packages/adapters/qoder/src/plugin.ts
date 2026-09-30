import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";

import { QoderAdapter } from "./qoder-adapter.js";
import { CODEX_Z_QODER_COMMAND } from "./qoder-command.js";

export { CODEX_Z_QODER_COMMAND };

export function createHarnessAdapter(context: HarnessPluginContext): QoderAdapter {
  const environment = { ...context.environment };
  return new QoderAdapter({
    ...(environment[CODEX_Z_QODER_COMMAND]
      ? { commandOverride: environment[CODEX_Z_QODER_COMMAND] }
      : {}),
    environment,
    platform: context.platform as NodeJS.Platform,
  });
}
