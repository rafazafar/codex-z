import type { HarnessPluginContext } from "@codex-z/harness-adapter/plugin";
import { QoderAdapter } from "@codex-z/adapter-qoder";

export function createHarnessAdapter(context: HarnessPluginContext): QoderAdapter {
  return new QoderAdapter({
    variant: "cn",
    environment: { ...context.environment },
    platform: context.platform as NodeJS.Platform,
  });
}
