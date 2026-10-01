import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SHA } from "./policy.mjs";

const execFileAsync = promisify(execFile);
const semverPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
export function validateReleaseVersion(version) {
  if (typeof version !== "string" || !semverPattern.test(version)) {
    throw new Error(`release version '${version}' must be valid semver`);
  }
  if (version === "0.0.0") throw new Error("release version must not be 0.0.0");
  return version;
}

function cargoWorkspaceVersion(source) {
  let active = false;
  const versions = [];
  for (const line of source.split(/\r?\n/u)) {
    if (/^\[workspace\.package\]\s*$/u.test(line)) active = true;
    else if (/^\[/u.test(line)) active = false;
    else if (active) {
      const match = /^\s*version\s*=\s*"([^"\n]+)"\s*(?:#.*)?$/u.exec(line);
      if (match) versions.push(match[1]);
    }
  }
  if (versions.length !== 1)
    throw new Error("Cargo workspace must define exactly one package version");
  return versions[0];
}

export async function readReleaseMetadata({ root, tag, expectedRefSha }) {
  if (typeof tag !== "string" || !tag.startsWith("v"))
    throw new Error("release tag must be v<semver>");
  const version = validateReleaseVersion(tag.slice(1));
  async function git(...args) {
    const { stdout } = await execFileAsync("git", args, { cwd: root, maxBuffer: 8 * 1024 * 1024 });
    return stdout;
  }
  const ref = `refs/tags/${tag}`;
  const tagObjectSha = (await git("rev-parse", "--verify", "--end-of-options", ref)).trim();
  if ((await git("cat-file", "-t", tagObjectSha)).trim() !== "tag") {
    throw new Error(`release tag ${tag} must be an annotated tag with release notes`);
  }
  const sha = (await git("rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`)).trim();
  if (!SHA.test(sha) || !SHA.test(tagObjectSha))
    throw new Error("release ref did not resolve to full SHAs");
  if (expectedRefSha && ![sha, tagObjectSha].includes(expectedRefSha))
    throw new Error("release tag moved since the triggering event");
  // Read data from the tag; never execute tag-selected code during preparation.
  await git("merge-base", "--is-ancestor", sha, "refs/remotes/origin/main");
  const [packageSource, cargoSource, lockSource, notes, automationSha] = await Promise.all([
    git("show", `${sha}:package.json`),
    git("show", `${sha}:Cargo.toml`),
    git("show", `${sha}:package-lock.json`),
    git("for-each-ref", "--format=%(contents:body)", ref),
    git("rev-parse", "HEAD"),
  ]);
  const manifest = JSON.parse(packageSource);
  const lock = JSON.parse(lockSource);
  if (manifest.version !== version)
    throw new Error(`release tag ${tag} does not match package.json version ${manifest.version}`);
  if (cargoWorkspaceVersion(cargoSource) !== version)
    throw new Error(`release tag ${tag} does not match Cargo workspace version`);
  if (
    lock.version !== version ||
    lock.packages?.[""]?.version !== version ||
    lock.name !== manifest.name ||
    lock.packages?.[""]?.name !== manifest.name
  ) {
    throw new Error("release package-lock.json root metadata does not match package.json");
  }
  if (!notes.trim()) throw new Error("annotated tag body must contain release notes");
  const prereleaseId = version.split("+")[0].split("-").slice(1).join("-");
  return {
    tag,
    version,
    sha,
    tagObjectSha,
    notes,
    automationSha: automationSha.trim(),
    prerelease: Boolean(prereleaseId),
    npmTag: !prereleaseId ? "latest" : /^test(?:\.|$)/u.test(prereleaseId) ? "test" : "next",
  };
}

export async function verifyRelease({ github, repo, tag, sha, tagObjectSha }) {
  validateReleaseVersion(tag?.startsWith("v") ? tag.slice(1) : "");
  if (!SHA.test(sha) || !SHA.test(tagObjectSha))
    throw new Error("release verification requires full SHAs");
  const { data: ref } = await github.rest.git.getRef({ ...repo, ref: `tags/${tag}` });
  if (ref.object.type !== "tag" || ref.object.sha !== tagObjectSha)
    throw new Error("release tag changed after preparation");
  const { data: comparison } = await github.rest.repos.compareCommits({
    ...repo,
    base: sha,
    head: "main",
  });
  if (
    comparison.merge_base_commit?.sha !== sha ||
    !["ahead", "identical"].includes(comparison.status)
  ) {
    throw new Error("release commit is no longer on main");
  }
}
