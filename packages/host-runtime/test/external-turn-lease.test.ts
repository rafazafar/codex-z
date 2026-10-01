import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FakeHarnessAdapter, FakeHarnessSession } from "@codex-z/harness-adapter/testing";
import { harnessIdSchema, harnessPermissionModeCatalogSchema } from "@codex-z/shared-contracts";
import { MappingStore } from "@codex-z/mapping-store";
import type { JsonObject } from "@codex-z/protocol-core";

import type { DelegationControlApi } from "../src/delegation-types.js";
import { ExternalTurnLeases } from "../src/external-turn-leases.js";
import {
  createFixture,
  requestId,
  startPiThread,
  startPiTurn,
  stopFixture,
  threadStatus,
  turnEvent,
  writeRequest,
} from "./app-server-host-fixture.js";

function independentAdapter(source: FakeHarnessSession) {
  const adapter = new FakeHarnessAdapter(harnessIdSchema.parse("pi"));
  const sessions: FakeHarnessSession[] = [];
  vi.spyOn(adapter, "open").mockImplementation(async () => {
    const session = new FakeHarnessSession(
      adapter.harnessId,
      adapter.catalog,
      source.state.effectiveModel,
      source.initialState.nativeRef,
      source.persistedSnapshot(),
    );
    sessions.push(session);
    return { ok: true, value: session };
  });
  return { adapter, sessions };
}

describe("External Turn leases across Desktop connections", () => {
  it("keeps one writer per native session after reconnect", async () => {
    const leases = new ExternalTurnLeases();
    const unsubscribe = vi.fn();
    const subscribe = leases.subscribe.bind(leases);
    vi.spyOn(leases, "subscribe").mockImplementation((listener) => {
      const dispose = subscribe(listener);
      return () => {
        unsubscribe();
        dispose();
      };
    });
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
      const resumedAdapter = independentAdapter(session);

      second = createFixture({
        mappingStore: store,
        mappingStoreDirectory: directory,
        closeMappingStoreOnExit: false,
        externalTurnLeases: leases,
        externalAdapters: new Map([["pi", resumedAdapter.adapter]]),
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

      for (const [id, method, params] of [
        [14, "thread/resume", { threadId, excludeTurns: true }],
        [15, "thread/rollback", { threadId, numTurns: 1 }],
        [16, "thread/revert", { threadId, beforeTurnId: turnId }],
      ] as const) {
        writeRequest(second.desktopInput, { id, method, params });
        const reply = await second.collector.waitFor((message) => requestId(message, id));
        if (method === "thread/resume") {
          expect(reply).toMatchObject({ result: { thread: { status: { type: "active" } } } });
        } else {
          expect(reply).toMatchObject({ error: { code: -32072 } });
        }
      }

      session.appendText("done");
      session.succeedTurn();
      await first.collector.waitFor((message) => turnEvent(message, "turn/completed", turnId));
      await first.running;
      expect(unsubscribe).toHaveBeenCalledOnce();

      await second.collector.waitFor((message) => threadStatus(message, threadId, "idle"));
      const nextTurnId = await startPiTurn(second, threadId, 20);
      expect(resumedAdapter.adapter.open).toHaveBeenCalledTimes(2);
      expect(resumedAdapter.sessions[1]?.persistedSnapshot().turns).toHaveLength(1);
      resumedAdapter.sessions[1]?.succeedTurn();
      await second.collector.waitFor((message) => turnEvent(message, "turn/completed", nextTurnId));
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
  it("reopens a handle when the previous Turn finishes inside recovery", async () => {
    const leases = new ExternalTurnLeases();
    const directory = mkdtempSync(path.join(tmpdir(), "codex-z-recovery-race-"));
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
      const source = first.adapter.sessions[0];
      if (!source) throw new Error("Fake Session was not opened");
      await first.collector.waitFor((message) => turnEvent(message, "turn/started", turnId));
      first.host.disconnect();
      const resumed = independentAdapter(source);
      const open = vi.mocked(resumed.adapter.open);
      const original = open.getMockImplementation();
      if (!original) throw new Error("Open mock is missing");
      open.mockImplementationOnce(async (input) => {
        const stale = await original(input);
        source.succeedTurn();
        await first.running;
        return stale;
      });
      second = createFixture({
        mappingStore: store,
        mappingStoreDirectory: directory,
        closeMappingStoreOnExit: false,
        externalTurnLeases: leases,
        externalAdapters: new Map([["pi", resumed.adapter]]),
      });
      writeRequest(second.desktopInput, { id: 40, method: "thread/resume", params: { threadId } });
      const reply = await second.collector.waitFor((message) => requestId(message, 40));
      expect(reply).toMatchObject({
        result: { thread: { status: { type: "idle" }, turns: [expect.anything()] } },
      });
      expect(open).toHaveBeenCalledTimes(2);
      const next = await startPiTurn(second, threadId, 41);
      expect(resumed.sessions[1]?.persistedSnapshot().turns).toHaveLength(1);
      resumed.sessions[1]?.succeedTurn();
      await second.collector.waitFor((message) => turnEvent(message, "turn/completed", next));
    } finally {
      first.host.close();
      second?.host.close();
      await first.running;
      await second?.running;
      await store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    ["model", "model.select", { model: { id: "fake-model-v1.secondary" } }],
    ["thinking", "thinking.select", { thinkingOptionId: "high" }],
    ["permission-mode", "permissionMode.select", { permissionModeId: "auto" }],
  ] as const)(
    "holds the lease until %s selection is confirmed",
    async (route, commandType, params) => {
      const leases = new ExternalTurnLeases();
      const permissions = harnessPermissionModeCatalogSchema.parse({
        modes: [
          { id: "ask", label: "Ask" },
          { id: "auto", label: "Auto" },
        ],
        defaultModeId: "ask",
      });
      const adapter = new FakeHarnessAdapter(
        harnessIdSchema.parse("pi"),
        undefined,
        true,
        true,
        null,
        permissions,
      );
      const directory = mkdtempSync(path.join(tmpdir(), "codex-z-configuration-lease-"));
      const store = new MappingStore({ directory });
      const first = createFixture({
        mappingStore: store,
        mappingStoreDirectory: directory,
        closeMappingStoreOnExit: false,
        externalTurnLeases: leases,
        externalAdapters: new Map([["pi", adapter]]),
      });
      let second: ReturnType<typeof createFixture> | undefined;
      const gate = Promise.withResolvers<undefined>();
      try {
        const threadId = await startPiThread(first);
        const session = adapter.sessions[0];
        if (!session) throw new Error("Fake Session was not opened");
        const resumed = independentAdapter(session);
        second = createFixture({
          mappingStore: store,
          mappingStoreDirectory: directory,
          closeMappingStoreOnExit: false,
          externalTurnLeases: leases,
          externalAdapters: new Map([["pi", resumed.adapter]]),
        });
        const entered = Promise.withResolvers<undefined>();
        const execute = session.execute.bind(session);
        // Accept the command, but delay the confirming state event.
        let confirmation: Promise<unknown> | undefined;
        vi.spyOn(session, "execute").mockImplementation(async (command) => {
          if (command.type !== commandType) return execute(command);
          entered.resolve(undefined);
          confirmation = gate.promise.then(() => execute(command));
          return { ok: true, value: { completed: true } };
        });
        writeRequest(first.desktopInput, {
          id: 30,
          method: `codex-z/thread/${route}/select`,
          params: { threadId, ...params },
        });
        await entered.promise;
        writeRequest(second.desktopInput, {
          id: 31,
          method: "turn/start",
          params: { threadId, input: [{ type: "text", text: "competing writer" }] },
        });
        await expect(
          second.collector.waitFor((message) => requestId(message, 31)),
        ).resolves.toMatchObject({ error: { code: -32072 } });
        expect(leases.acquire(threadId, {})).toBe(false);
        gate.resolve(undefined);
        await confirmation;
        const selected = await first.collector.waitFor((message) => requestId(message, 30));
        expect(selected).toHaveProperty("result");
        await vi.waitFor(() => expect(leases.heldBy(first.host)).toEqual([]));
        expect(leases.acquire(threadId, {})).toBe(true);
      } finally {
        gate.resolve(undefined);
        first.host.close();
        second?.host.close();
        await first.running;
        await second?.running;
        await store.close();
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
  it("releases the lease when a delegated start throws", async () => {
    const leases = new ExternalTurnLeases();
    let api: DelegationControlApi | undefined;
    const fixture = createFixture({
      externalTurnLeases: leases,
      onDelegationApi: (registration) => {
        api = registration;
        return undefined;
      },
    });
    try {
      const threadId = await startPiThread(fixture);
      if (!api) throw new Error("Delegation API was not registered");
      const session = fixture.adapter.sessions[0];
      if (!session) throw new Error("Fake Session was not opened");
      const execute = vi
        .spyOn(session, "execute")
        .mockRejectedValueOnce(new Error("Native start failed"));
      await expect(api.send({ threadId, message: "start" })).rejects.toMatchObject({
        code: "DELEGATION_FAILED",
      });
      expect(leases.heldBy(fixture.host)).toEqual([]);
      execute.mockRestore();
      const next = await api.send({ threadId, message: "retry" });
      session.succeedTurn();
      await fixture.collector.waitFor((message) =>
        turnEvent(message, "turn/completed", next.turnId),
      );
    } finally {
      await stopFixture(fixture);
    }
  });
});
