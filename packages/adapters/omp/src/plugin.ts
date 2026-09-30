import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";

import { OmpAdapter } from "./omp-adapter.js";

export const OMP_COMMAND_ENV = "CODEX_Z_OMP_COMMAND";

export function createHarnessAdapter(context: HarnessPluginContext): OmpAdapter {
  const environment = { ...context.environment };
  return new OmpAdapter({
    ...(environment[OMP_COMMAND_ENV] ? { command: environment[OMP_COMMAND_ENV] } : {}),
    environment,
  });
}
