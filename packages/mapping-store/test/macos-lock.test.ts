import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import type * as ChildProcessModule from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MappingStore } from "../src/index.js";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>();
  return { ...actual, execFileSync: vi.fn(actual.execFileSync) };
});

describe.skipIf(process.platform !== "darwin")("macOS Mapping Store lock ownership", () => {
  let directory: string;
  let owner: ChildProcess;
  let store: MappingStore;
  let processStartedAt: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "codex-z-macos-lock-"));
    // Use another real process: the current-PID shortcut already checks start time.
    owner = spawn(
      process.execPath,
      [
        "-e",
        "process.send(new Date(Date.now() - process.uptime() * 1000).toISOString()); setInterval(() => {}, 1000)",
      ],
      { stdio: ["ignore", "ignore", "ignore", "ipc"] },
    );
    const [startedAt] = await once(owner, "message");
    if (typeof startedAt !== "string") throw new Error("Missing fixture process start time");
    processStartedAt = startedAt;
    store = new MappingStore({ directory });
  });

  afterEach(async () => {
    vi.mocked(execFileSync).mockReset();
    await store?.close();
    if (owner && owner.exitCode === null && owner.signalCode === null) {
      const exited = once(owner, "exit");
      owner.kill();
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
  });

  async function writeLock(startedAt: string | undefined): Promise<string> {
    const content = JSON.stringify({
      pid: owner.pid,
      instanceId: "previous-owner",
      startedAt: new Date(0).toISOString(),
      executablePath: process.execPath,
      processStartedAt: startedAt,
    });
    await writeFile(path.join(directory, "store.lock"), content);
    return content;
  }

  async function expectLockPreserved(content: string): Promise<void> {
    await expect(store.initialize()).rejects.toMatchObject({ code: "STORE_LOCKED" });
    expect(await readFile(path.join(directory, "store.lock"), "utf8")).toBe(content);
  }

  it("does not query process metadata when there is no lock contention", async () => {
    await store.initialize();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("recovers a stale lock even when its PID was reused by another Node process", async () => {
    await writeLock(new Date(0).toISOString());
    await store.initialize();
    expect(JSON.parse(await readFile(path.join(directory, "store.lock"), "utf8"))).toMatchObject({
      pid: process.pid,
    });
  });

  it("preserves a lock owned by the recorded live process", async () => {
    await expectLockPreserved(await writeLock(processStartedAt));
  });

  it.each([undefined, "invalid"])("preserves a live-PID lock with start time %s", async (value) => {
    await expectLockPreserved(await writeLock(value));
  });

  it("preserves the lock when process metadata cannot be queried", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("Process metadata unavailable");
    });
    await expectLockPreserved(await writeLock(new Date(0).toISOString()));
  });

  it.each(["", "unknown\n"])("preserves the lock when ps returns %j", async (output) => {
    vi.mocked(execFileSync).mockReturnValue(output);
    await expectLockPreserved(await writeLock(new Date(0).toISOString()));
  });
});
