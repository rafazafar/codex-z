import { describe, expect, it } from "vitest";
import type { JsonRpcRequest } from "@codex-z/protocol-core";

import { classifyCreateRequestRoute, packageMetadata } from "../src/index.js";

describe("host-runtime package", () => {
  it("declares the composition-root dependencies", () => {
    expect(packageMetadata.dependencies).toHaveLength(7);
    expect(packageMetadata.dependencies.some((name) => name.startsWith("@codex-z/adapter-"))).toBe(
      false,
    );
    expect(packageMetadata.dependencies).toContain("@codex-z/protocol-core");
    expect(packageMetadata.dependencies).toContain("@codex-z/harness-adapter");
    expect(packageMetadata.dependencies).toContain("@codex-z/harness-broker");
    expect(packageMetadata.dependencies).toContain("@codex-z/shared-contracts");
    expect(packageMetadata.dependencies).toContain("@codex-z/update-manager");
  });

  it("classifies create routes without exposing Model values or request IDs", () => {
    const request = (model: string): JsonRpcRequest => ({
      id: 42,
      method: "thread/start",
      params: { model },
    });

    expect(classifyCreateRequestRoute(request("official/model"), "codex")).toEqual({
      requestMethod: "thread/start",
      modelCarrier: "official-model",
      selectedHarness: "codex",
      selectionSource: "official-model",
    });
    expect(classifyCreateRequestRoute(request("official/model"), "pi")).toEqual({
      requestMethod: "thread/start",
      modelCarrier: "official-model",
      selectedHarness: "pi",
      selectionSource: "default-agent",
    });
    expect(classifyCreateRequestRoute(request("codex-z/pi-native"), "codex")).toEqual({
      requestMethod: "thread/start",
      modelCarrier: "pi-transport",
      selectedHarness: "pi",
      selectionSource: "transport-model",
    });
    expect(classifyCreateRequestRoute(request("codex-z/claude-code-native"), "codex")).toEqual({
      requestMethod: "thread/start",
      modelCarrier: "claude-code-transport",
      selectedHarness: "claude-code",
      selectionSource: "transport-model",
    });
    expect(classifyCreateRequestRoute(request("codex-z/grok-native"), "codex")).toEqual({
      requestMethod: "thread/start",
      modelCarrier: "grok-transport",
      selectedHarness: "grok",
      selectionSource: "transport-model",
    });
    expect(classifyCreateRequestRoute(request("codex-z/opencode-native"), "codex")).toEqual({
      requestMethod: "thread/start",
      modelCarrier: "opencode-transport",
      selectedHarness: "opencode",
      selectionSource: "transport-model",
    });
    expect(classifyCreateRequestRoute(request("codex-z/deepseek-harness-native"), "codex")).toEqual(
      {
        requestMethod: "thread/start",
        modelCarrier: "deepseek-harness-transport",
        selectedHarness: "deepseek-harness",
        selectionSource: "transport-model",
      },
    );
    expect(
      classifyCreateRequestRoute({ id: 43, method: "thread/read", params: {} }, "codex"),
    ).toBeNull();
  });

  it.each(["codex", "pi"] as const)(
    "keeps native default Models and helper Threads on Codex with default Agent %s",
    (defaultAgent) => {
      for (const params of [
        {},
        { model: null },
        { ephemeral: true, permissions: ":read-only", threadSource: "mcp_extension_host" },
        { ephemeral: true, model: "official/model" },
      ]) {
        expect(
          classifyCreateRequestRoute({ id: 1, method: "thread/start", params }, defaultAgent),
        ).toEqual({
          requestMethod: "thread/start",
          modelCarrier: "official-model",
          selectedHarness: "codex",
          selectionSource: "official-model",
        });
      }
      expect(
        classifyCreateRequestRoute(
          {
            id: 1,
            method: "thread/start",
            params: { ephemeral: true, model: "codex-z/pi-native" },
          },
          defaultAgent,
        ),
      ).toMatchObject({ selectedHarness: "pi", selectionSource: "transport-model" });
    },
  );
});
