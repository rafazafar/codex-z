import { FakeHarnessAdapter, FakeHarnessSession } from "@codex-z/harness-adapter/testing";
import type { StoredThreadRecordV1 } from "@codex-z/mapping-store";
import { encodeExternalTransportSelection } from "@codex-z/protocol-core";
import {
  harnessIdSchema,
  harnessPermissionModeCatalogSchema,
  harnessPermissionModeIdSchema,
  hostThreadIdSchema,
  nativeSessionRefSchema,
} from "@codex-z/shared-contracts";
import { describe, expect, it, vi } from "vitest";

import type { ExternalThreadRepository } from "../src/external-thread-repository.js";
import { ExternalThreadRuntime } from "../src/external-thread-runtime.js";
import { ExternalTurnLeases } from "../src/external-turn-leases.js";

function fixture() {
  const harnessId = harnessIdSchema.parse("claude-code");
  const threadId = hostThreadIdSchema.parse("thread-1");
  const nativeRef = nativeSessionRefSchema.parse({
    harnessId,
    nativeSessionId: "native-1",
    formatVersion: 1,
  });
  const permissions = harnessPermissionModeCatalogSchema.parse({
    modes: [
      { id: "ask", label: "Ask" },
      { id: "auto", label: "Auto" },
    ],
    defaultModeId: "ask",
  });
  const adapter = new FakeHarnessAdapter(harnessId);
  const model = adapter.catalog.defaultModel;
  if (!model) throw new Error("Fake catalog has no default Model");
  const record = {
    formatVersion: 1,
    revision: 1,
    hostThreadId: threadId,
    createRequestId: "create-1",
    harnessId,
    state: "ready",
    nativeSessionRef: nativeRef,
    cwd: "/synthetic",
    title: "Test",
    archived: false,
    ephemeral: false,
    historyMode: "legacy",
    turnMappings: [],
    transportModelId: encodeExternalTransportSelection("claude-code", {
      model,
      permissionModeId: harnessPermissionModeIdSchema.parse("auto"),
    }),
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  } as StoredThreadRecordV1;
  const sessions: FakeHarnessSession[] = [];
  const execute = vi.fn();
  const open = vi.spyOn(adapter, "open").mockImplementation(async () => {
    const session = new FakeHarnessSession(
      harnessId,
      adapter.catalog,
      undefined,
      nativeRef,
      { turns: [] },
      true,
      record.cwd,
      true,
      undefined,
      null,
      permissions,
    );
    const run = session.execute.bind(session);
    vi.spyOn(session, "execute").mockImplementation((command) => {
      execute(command);
      return run(command);
    });
    sessions.push(session);
    return { ok: true, value: session };
  });
  const repository = {
    find: async () => record,
    alignSnapshot: async () => ({ record, turns: [] }),
    sessionTreeId: async () => threadId,
  } as unknown as ExternalThreadRepository;
  const leases = new ExternalTurnLeases();
  const owner = {};
  const other = {};
  const runtime = new ExternalThreadRuntime({
    adapters: new Map([["claude-code", adapter]]),
    repository,
    consumeOutputs: async () => undefined,
    diagnose: () => undefined,
    externallyActive: (id) => leases.heldByOther(id, owner),
    leaseVersion: (id) => leases.version(id),
    acquireRestoreLease: (id) =>
      leases.acquire(id, owner) ? () => leases.release(id, owner) : undefined,
  });
  return { runtime, leases, owner, other, threadId, sessions, open, execute, repository };
}

describe("External Thread recovery with shared leases", () => {
  it("keeps a refreshed Thread active and defers saved configuration until reopen", async () => {
    const f = fixture();
    f.leases.acquire(f.threadId, f.other);
    const restored = await f.runtime.resolve(f.threadId);
    if (restored.kind !== "external") throw new Error("Recovery failed");
    expect(restored.thread.running).toBe(false);
    expect(restored.thread.thread.status).toEqual({ type: "active", activeFlags: [] });
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.open.mock.calls[0]?.[0]).not.toHaveProperty("model");
    await f.runtime.refresh(restored.thread);
    expect(restored.thread.thread.status).toEqual({ type: "active", activeFlags: [] });
    f.leases.release(f.threadId, f.other);
    await restored.thread.session.close();
    f.runtime.remove(f.threadId);
    const reopened = await f.runtime.resolve(f.threadId);
    expect(reopened.kind).toBe("external");
    expect(f.execute).toHaveBeenCalledExactlyOnceWith({
      type: "permissionMode.select",
      permissionModeId: "auto",
    });
    await f.sessions.at(-1)?.close();
  });

  it.each(["open", "snapshot", "alignment"])(
    "remembers a lease released during %s",
    async (stage) => {
      const f = fixture();
      f.leases.acquire(f.threadId, f.other);
      const original = f.open.getMockImplementation();
      if (!original) throw new Error("Open mock is missing");
      f.open.mockImplementation(async (input) => {
        const result = await original(input);
        if (!result.ok) return result;
        if (stage === "open") f.leases.release(f.threadId, f.other);
        if (stage === "snapshot") {
          const read = result.value.readSnapshot.bind(result.value);
          vi.spyOn(result.value, "readSnapshot").mockImplementation(async () => {
            f.leases.release(f.threadId, f.other);
            return read();
          });
        }
        return result;
      });
      if (stage === "alignment") {
        const align = f.repository.alignSnapshot.bind(f.repository);
        vi.spyOn(f.repository, "alignSnapshot").mockImplementation(async (...args) => {
          f.leases.release(f.threadId, f.other);
          return align(...args);
        });
      }
      const restored = await f.runtime.resolve(f.threadId);
      if (restored.kind !== "external") throw new Error("Recovery failed");
      expect(f.leases.heldByOther(f.threadId, f.owner)).toBe(false);
      expect(restored.thread.restoredWhileLeased).toBe(true);
      expect(f.execute).not.toHaveBeenCalled();
      await restored.thread.session.close();
    },
  );

  it("holds recovery ownership across open and releases it after failure", async () => {
    const f = fixture();
    const entered = Promise.withResolvers<undefined>();
    const gate = Promise.withResolvers<undefined>();
    f.open.mockImplementation(async () => {
      entered.resolve(undefined);
      await gate.promise;
      throw new Error("Open failed");
    });
    const pending = f.runtime.resolve(f.threadId);
    await entered.promise;
    expect(f.leases.acquire(f.threadId, f.other)).toBe(false);
    gate.resolve(undefined);
    expect((await pending).kind).toBe("error");
    expect(f.leases.acquire(f.threadId, f.other)).toBe(true);
  });
});
