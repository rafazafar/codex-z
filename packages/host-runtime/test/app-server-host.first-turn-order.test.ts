import { describe, expect, it } from "vitest";
import type { JsonObject } from "@codex-z/protocol-core";

import {
  closeFixture,
  createFixture,
  messageParams,
  method,
  requestId,
  stopFixture,
  writeRequest,
} from "./app-server-host-fixture.js";

describe("External Thread first Turn", () => {
  it("registers the Thread in Desktop before the first Turn event, under one identity", async () => {
    const fixture = createFixture();
    await fixture.ready;
    // Desktop sends the first Turn as soon as it reads the creation response, before
    // any later output: react synchronously on the response chunk.
    fixture.desktopOutput.once("data", (chunk: string) => {
      const created = JSON.parse(chunk.split("\n")[0] ?? "{}") as JsonObject;
      const threadId = ((created.result as JsonObject).thread as JsonObject).id as string;
      writeRequest(fixture.desktopInput, {
        id: 2,
        method: "turn/start",
        params: { threadId, input: [{ type: "text", text: "synthetic" }] },
      });
    });
    writeRequest(fixture.desktopInput, {
      id: 1,
      method: "thread/start",
      params: { model: "codex-z/pi-native", cwd: "/synthetic" },
    });
    const created = await fixture.collector.waitFor((message) => requestId(message, 1));
    const threadId = ((created.result as JsonObject).thread as JsonObject).id as string;
    await fixture.collector
      .waitFor((message) => requestId(message, 2))
      .catch((e) => {
        throw new Error(JSON.stringify(fixture.collector.messages) + e);
      });
    const turnStarted = await fixture.collector.waitFor((message) =>
      method(message, "turn/started"),
    );

    const messages = fixture.collector.messages;
    const startedIndex = messages.findIndex((message) => method(message, "thread/started"));
    expect(startedIndex).toBeGreaterThanOrEqual(0);
    expect(startedIndex).toBeLessThan(messages.indexOf(turnStarted));
    expect((messageParams(messages[startedIndex] as JsonObject).thread as JsonObject).id).toBe(
      threadId,
    );
    expect(messageParams(turnStarted).threadId).toBe(threadId);

    await closeFixture(fixture);
    await stopFixture(fixture);
  });
});
