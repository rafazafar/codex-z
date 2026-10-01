import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readReleaseMetadata, verifyRelease } from "../index.mjs";
import { head, oldHead, repo } from "./fixtures.mjs";

const exec = promisify(execFile);
const roots = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function repository({
  version = "1.2.3",
  cargoVersion = version,
  lockVersion = version,
  notes = "Release 1.2.3\n\nFix history recovery.",
  annotated = true,
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "codex-z-release-guard-"));
  roots.push(root);
  async function git(...args) {
    const { stdout } = await exec(
      "git",
      [
        "-c",
        "commit.gpgsign=false",
        "-c",
        "tag.gpgsign=false",
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        ...args,
      ],
      { cwd: root },
    );
    return stdout.trim();
  }
  await git("init", "--initial-branch=main");
  await git("config", "core.hooksPath", path.join(root, "no-hooks"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "codex-z", version }));
  await writeFile(
    path.join(root, "package-lock.json"),
    JSON.stringify({
      name: "codex-z",
      version: lockVersion,
      packages: { "": { name: "codex-z", version: lockVersion } },
    }),
  );
  await writeFile(
    path.join(root, "Cargo.toml"),
    `[workspace]\nmembers=[]\n[workspace.package]\nversion = "${cargoVersion}"\n`,
  );
  await git("add", ".");
  await git("commit", "-m", "fixture");
  const sha = await git("rev-parse", "HEAD");
  await git("update-ref", "refs/remotes/origin/main", sha);
  const tag = `v${version}`;
  if (annotated) await git("tag", "-a", tag, "-m", notes);
  else await git("tag", tag);
  return { root, sha, tag, git };
}

function githubFixture(sha = head) {
  return {
    rest: {
      git: { getRef: vi.fn(async () => ({ data: { object: { type: "tag", sha: oldHead } } })) },
      repos: {
        compareCommits: vi.fn(async () => ({
          data: { status: "ahead", merge_base_commit: { sha } },
        })),
      },
    },
  };
}

describe("release source and metadata", () => {
  it("resolves an immutable annotated tag, matching versions, notes and trusted automation SHA", async () => {
    const f = await repository();
    const result = await readReleaseMetadata(f);
    expect(result).toMatchObject({
      version: "1.2.3",
      tag: "v1.2.3",
      sha: f.sha,
      automationSha: f.sha,
      npmTag: "latest",
      prerelease: false,
    });
    expect(result.notes).toContain("Fix history recovery");
    expect(result.tagObjectSha).toBe(await f.git("rev-parse", "refs/tags/v1.2.3"));
    expect(await f.git("status", "--porcelain")).toBe("");
  });

  it.each([
    ["1.2.3-test.1", "test"],
    ["1.2.3-beta.1", "next"],
    ["1.2.3+build.1", "latest"],
  ])("retains npm routing for %s", async (version, npmTag) => {
    const f = await repository({ version });
    expect((await readReleaseMetadata(f)).npmTag).toBe(npmTag);
  });

  it("rejects lightweight tags and empty release-note bodies", async () => {
    await expect(readReleaseMetadata(await repository({ annotated: false }))).rejects.toThrow(
      "annotated tag",
    );
    await expect(readReleaseMetadata(await repository({ notes: "Subject only" }))).rejects.toThrow(
      "body must contain release notes",
    );
  });

  it("rejects inconsistent package, Cargo and lockfile versions", async () => {
    const mismatch = await repository();
    await mismatch.git("tag", "-a", "v1.2.4", "-m", "Release\n\nNotes");
    await expect(readReleaseMetadata({ ...mismatch, tag: "v1.2.4" })).rejects.toThrow(
      "does not match package.json",
    );
    await expect(readReleaseMetadata(await repository({ cargoVersion: "1.2.4" }))).rejects.toThrow(
      "Cargo workspace version",
    );
    await expect(readReleaseMetadata(await repository({ lockVersion: "1.2.4" }))).rejects.toThrow(
      "package-lock.json",
    );
  });

  it("rejects malformed refs, moved triggering refs and commits outside main", async () => {
    const f = await repository();
    await expect(readReleaseMetadata({ ...f, tag: "v1.2.3; touch bad" })).rejects.toThrow(
      "valid semver",
    );
    await expect(readReleaseMetadata({ ...f, expectedRefSha: head })).rejects.toThrow("moved");
    await f.git("checkout", "-b", "other");
    await writeFile(path.join(f.root, "extra.txt"), "not integrated");
    await f.git("add", ".");
    await f.git("commit", "-m", "outside main");
    await f.git("tag", "-f", "-a", f.tag, "-m", "Release\n\nNotes");
    await expect(readReleaseMetadata(f)).rejects.toThrow();
  });

  it("reads tag files as data without checking out or running their scripts", async () => {
    const f = await repository();
    const before = await f.git("rev-parse", "HEAD");
    await writeFile(
      path.join(f.root, "package.json"),
      JSON.stringify({ name: "codex-z", version: "9.9.9", scripts: { prepare: "exit 1" } }),
    );
    expect((await readReleaseMetadata(f)).version).toBe("1.2.3");
    expect(await f.git("rev-parse", "HEAD")).toBe(before);
  });
});

describe("release publication source validation", () => {
  const input = () => ({
    github: githubFixture(),
    repo,
    tag: "v1.2.3",
    sha: head,
    tagObjectSha: oldHead,
  });

  it("checks the remote source without requiring a separate main CI run", async () => {
    const f = input();
    await expect(verifyRelease(f)).resolves.toBeUndefined();
    expect(f.github.rest.git.getRef).toHaveBeenCalledWith({ ...repo, ref: "tags/v1.2.3" });
    expect(f.github.rest.repos.compareCommits).toHaveBeenCalledWith({
      ...repo,
      base: head,
      head: "main",
    });
  });

  it.each(["ahead", "identical"])("accepts a release commit still on main (%s)", async (status) => {
    const f = input();
    f.github.rest.repos.compareCommits.mockResolvedValue({
      data: { status, merge_base_commit: { sha: head } },
    });
    await expect(verifyRelease(f)).resolves.toBeUndefined();
  });

  it.each(["diverged", "behind"])(
    "rejects publication when main no longer contains the commit (%s)",
    async (status) => {
      const f = input();
      f.github.rest.repos.compareCommits.mockResolvedValue({
        data: { status, merge_base_commit: { sha: oldHead } },
      });
      await expect(verifyRelease(f)).rejects.toThrow("no longer on main");
    },
  );

  it("rejects a different merge base even when comparison reports ahead", async () => {
    const f = input();
    f.github.rest.repos.compareCommits.mockResolvedValue({
      data: { status: "ahead", merge_base_commit: { sha: oldHead } },
    });
    await expect(verifyRelease(f)).rejects.toThrow("no longer on main");
  });

  it("rejects a moved or replaced annotated tag", async () => {
    const f = input();
    await expect(verifyRelease({ ...f, tagObjectSha: head })).rejects.toThrow("tag changed");
    f.github.rest.git.getRef.mockResolvedValue({
      data: { object: { type: "commit", sha: oldHead } },
    });
    await expect(verifyRelease(f)).rejects.toThrow("tag changed");
  });

  it("rejects malformed source identifiers before remote requests", async () => {
    const f = input();
    await expect(verifyRelease({ ...f, sha: "short" })).rejects.toThrow("full SHAs");
    await expect(verifyRelease({ ...f, tag: "vbad" })).rejects.toThrow("valid semver");
    expect(f.github.rest.git.getRef).not.toHaveBeenCalled();
  });

  it("propagates API failures before publication", async () => {
    const f = input();
    f.github.rest.git.getRef.mockRejectedValue(new Error("unavailable"));
    await expect(verifyRelease(f)).rejects.toThrow("unavailable");
  });
});
