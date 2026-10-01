import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createNpmPublishPlan,
  parseNpmPublishArguments,
} from "../../scripts/release/publish-npm.mjs";

describe("npm registry publishing", () => {
  it("parses an explicit safe publishing request", () => {
    expect(
      parseNpmPublishArguments([
        "--artifacts",
        "/artifacts",
        "--version",
        "0.1.0-test.1",
        "--tag",
        "test",
        "--dry-run",
        "--provenance",
      ]),
    ).toEqual({
      artifactsRoot: "/artifacts",
      dryRun: true,
      provenance: true,
      registry: undefined,
      tag: "test",
      version: "0.1.0-test.1",
    });
  });

  it("publishes all platform packages before the meta package", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codex-z-npm-publish-"));
    const version = "0.1.0-test.1";
    const names = [
      `codex-z-cli-${version}-macos-arm64.tgz`,
      `codex-z-cli-${version}-windows-x64.tgz`,
      `codex-z-cli-${version}-windows-arm64.tgz`,
      `codex-z-cli-${version}-linux-x64.tgz`,
      `codex-z-cli-${version}-linux-arm64.tgz`,
      `codex-z-cli-${version}.tgz`,
    ];
    try {
      await mkdir(path.join(root, "nested"));
      for (const name of names) await writeFile(path.join(root, "nested", name), name);
      const plan = await createNpmPublishPlan({ artifactsRoot: root, version });
      expect(plan.map((entry) => entry.packageName)).toEqual([
        "@codex-z/cli-darwin-arm64",
        "@codex-z/cli-win32-x64",
        "@codex-z/cli-win32-arm64",
        "@codex-z/cli-linux-x64",
        "@codex-z/cli-linux-arm64",
        "@codex-z/cli",
      ]);
      expect(plan.at(-1).kind).toBe("meta");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects incomplete release artifacts before publishing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codex-z-npm-publish-"));
    try {
      await expect(createNpmPublishPlan({ artifactsRoot: root, version: "0.1.0" })).rejects.toThrow(
        "missing npm release tarball",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
