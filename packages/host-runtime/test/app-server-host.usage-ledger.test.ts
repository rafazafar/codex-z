import { USAGE_LEDGER_SUMMARY_METHOD, type JsonObject } from "@codex-z/shared-contracts";
import { describe, expect, it } from "vitest";

import {
  completePiTurn,
  createFixture,
  requestId,
  startPiThread,
  startPiTurn,
  stopFixture,
  turnEvent,
  writeRequest,
} from "./app-server-host-fixture.js";

async function summary(
  fixture: ReturnType<typeof createFixture>,
  id: number,
  params: JsonObject = {},
): Promise<JsonObject> {
  writeRequest(fixture.desktopInput, { id, method: USAGE_LEDGER_SUMMARY_METHOD, params });
  return fixture.collector.waitFor((message) => requestId(message, id));
}

describe("AppServerHost usage ledger", () => {
  it("summarizes completed external Turns with each Turn's share of Session usage", async () => {
    const fixture = createFixture();
    const threadId = await startPiThread(fixture);

    const firstTurnId = await startPiTurn(fixture, threadId, 2);
    const session = fixture.adapter.sessions[0];
    if (!session) throw new Error("Fake Pi Session was not opened");
    await fixture.collector.waitFor((message) => turnEvent(message, "turn/started", firstTurnId));
    session.publishUsage({ totalTokens: 1_000, totalCostUsd: 0.5 });
    session.succeedTurn();
    await fixture.collector.waitFor((message) => turnEvent(message, "turn/completed", firstTurnId));

    session.publishUsageOnNextTurn({ totalTokens: 1_600, totalCostUsd: 0.75 });
    await completePiTurn(fixture, threadId, 3);

    const response = await summary(fixture, 4);

    expect(response.result).toMatchObject({
      turns: 2,
      models: [
        {
          harnessId: "pi",
          sessions: 1,
          turns: 2,
          userSessions: 1,
          userTurns: 2,
          interruptedTurns: 0,
          tokenSessions: 1,
          tokenTurns: 2,
          totalTokens: 1_600,
          costSessions: 1,
          costTurns: 2,
          costUsd: 0.75,
        },
      ],
    });

    const future = await summary(fixture, 5, { sinceMs: Date.now() + 60_000 });
    expect(future.result).toMatchObject({ turns: 0, models: [] });

    const invalid = await summary(fixture, 6, { sinceMs: -1 });
    expect(invalid.error).toMatchObject({ code: -32602 });

    await stopFixture(fixture);
  });
});
