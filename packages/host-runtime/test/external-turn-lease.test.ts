import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MappingStore } from "@codex-z/mapping-store";
import type { JsonObject } from "@codex-z/protocol-core";

import { ExternalTurnLeases } from "../src/external-turn-leases.js";
import {
  createFixture,
  requestId,
  startPiThread,
  startPiTurn,
  threadStatus,
  turnEvent,
  writeRequest,
} from "./app-server-host-fixture.js";

describe("External Turn leases across Desktop connections", () => {
  it("keeps one writer per native session after reconnect", async () => {
    const leases = new ExternalTurnLeases();
    const directory = mkdtempSync(path.join(tmpdir(), "codexhost-lease-test-"));
    const store = new MappingStore({ directory });
    const first = createFixture({
      mappingStore: store,
      mappingStoreDirectory: directory,
      closeMappingStoreOnExit: false,
      externalTurnLeases: leases,
    });
    let second: ReturnType<typeof createFixture> | undefined;
    try {
      const threadId = await startPiThread(first);
      const turnId = await startPiTurn(first, threadId);
      const session = first.adapter.sessions[0];
      if (!session) throw new Error("Fake Pi Session was not opened");
      await first.collector.waitFor((message) => turnEvent(message, "turn/started", turnId));
      first.host.disconnect();
      // The fake Adapter hands the same Session to a second open; real Adapters
      // open a second handle, so give the resume a stable idle snapshot.
      const snapshot = await session.persistedSnapshot();
      vi.spyOn(session, "readSnapshot").mockResolvedValue({ ok: true, value: snapshot });

      second = createFixture({
        mappingStore: store,
        mappingStoreDirectory: directory,
        closeMappingStoreOnExit: false,
        externalTurnLeases: leases,
        externalAdapters: new Map([["pi", first.adapter]]),
      });
      writeRequest(second.desktopInput, {
        id: 10,
        method: "thread/resume",
        params: { threadId, excludeTurns: true },
      });
      const resumed = await second.collector.waitFor((message) => requestId(message, 10));
      expect((resumed.result as JsonObject).thread).toEqual(
        expect.objectContaining({ id: threadId, status: { type: "active", activeFlags: [] } }),
      );

      writeRequest(second.desktopInput, {
        id: 11,
        method: "turn/start",
        params: { threadId, input: [{ type: "text", text: "second writer" }] },
      });
      await expect(
        second.collector.waitFor((message) => requestId(message, 11)),
      ).resolves.toMatchObject({
        id: 11,
        error: { code: -32072, message: "External Thread already has an active Turn" },
      });

      writeRequest(second.desktopInput, {
        id: 13,
        method: "codex-z/thread/model/select",
        params: { threadId, model: { id: "pi-native" } },
      });
      await expect(
        second.collector.waitFor((message) => requestId(message, 13)),
      ).resolves.toMatchObject({ id: 13, error: { code: -32072 } });

      session.appendText("done");
      session.succeedTurn();
      await first.collector.waitFor((message) => turnEvent(message, "turn/completed", turnId));
      await first.running;

      await second.collector.waitFor((message) => threadStatus(message, threadId, "idle"));
      expect(leases.acquire(threadId, {})).toBe(true);
    } finally {
      first.host.close();
      second?.host.close();
      await first.running;
      await second?.running;
      await store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
