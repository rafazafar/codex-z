import { DEFAULT_RENDERER_AGENTS, type RendererAgent } from "./agent-selection-state.js";
import { installRendererBinding } from "./install-renderer-binding.js";

declare global {
  interface Window {
    __codexZProductionConfigV1?: {
      defaultAgent: RendererAgent;
    };
  }
}

const configuration = window.__codexZProductionConfigV1;
delete window.__codexZProductionConfigV1;

const install = (): void => {
  installRendererBinding(DEFAULT_RENDERER_AGENTS, configuration?.defaultAgent ?? "codex");
};

if (document.documentElement && document.body) {
  install();
} else {
  window.addEventListener("DOMContentLoaded", install, { once: true });
}
