import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { itemIdentity } from "./report.mjs";
import { parseTarget, snapshotItem } from "./incremental.mjs";

const execute = promisify(execFile);

/** The only GitHub transport: fixed host, REST GET, argv (never shell interpolation). */
export function createGithub(cwd = process.cwd()) {
  async function gh(args) {
    const { stdout } = await execute("gh", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 120_000,
    });
    return stdout;
  }
  return {
    async authenticate() {
      await gh(["auth", "status", "--hostname", "github.com"]);
    },
    async repository() {
      return JSON.parse(await gh(["repo", "view", "--json", "nameWithOwner"])).nameWithOwner;
    },
    async get(path) {
      if (!/^repos\/[a-z\d][a-z\d-]*\/[a-z\d_.-]+\//iu.test(path))
        throw new Error("Unsupported GitHub read path");
      return JSON.parse(await gh(["api", "--hostname", "github.com", "--method", "GET", path]));
    },
  };
}

/** Retain known pages on failure; an incomplete enumeration is never an empty queue. */
export async function paginate(github, path) {
  const items = [];
  for (let page = 1; ; page++) {
    try {
      const result = await github.get(
        `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      );
      if (!Array.isArray(result)) throw new Error("Paginated response is not an array");
      items.push(...result);
      if (result.length < 100) return { items, error: null };
    } catch (error) {
      return { items, error: `${path} page ${page}: ${error.message}` };
    }
  }
}

async function allPages(github, path) {
  const result = await paginate(github, path);
  if (result.error) throw new Error(result.error);
  return result.items;
}

export async function readItem(github, target) {
  parseTarget(String(target.number), target.repository);
  const root = `repos/${target.repository}`;
  const issue = await github.get(`${root}/issues/${target.number}`);
  if (issue.number !== target.number) throw new Error("GitHub returned a different item number");
  const kind = issue.pull_request ? "pr" : "issue";
  if (target.kind && target.kind !== kind) throw new Error("URL type does not match GitHub item");
  const [pull, comments, reviews, reviewComments] = await Promise.all([
    kind === "pr" ? github.get(`${root}/pulls/${target.number}`) : null,
    allPages(github, `${root}/issues/${target.number}/comments`),
    kind === "pr" ? allPages(github, `${root}/pulls/${target.number}/reviews`) : [],
    kind === "pr" ? allPages(github, `${root}/pulls/${target.number}/comments`) : [],
  ]);
  return snapshotItem({
    repository: target.repository,
    issue,
    pull,
    comments,
    reviews,
    reviewComments,
  });
}

/** Collect metadata and discussion only. Diffs and code are read by the agent for selected PRs. */
export async function collectCandidates(
  github,
  { repository, targets = [], type = "all", previous = null },
) {
  parseTarget("1", repository);
  const errors = [];
  const jobs = new Map();
  const add = (item) => {
    if (type === "all" || !item.kind || item.kind === type) {
      const key = itemIdentity(item);
      const old = jobs.get(key);
      if (old?.kind && item.kind && old.kind !== item.kind)
        throw new Error(`Item type conflict: ${key}`);
      jobs.set(key, old?.kind ? old : item);
    }
  };
  if (targets.length) targets.forEach(add);
  else {
    const result = await paginate(
      github,
      `repos/${repository}/issues?state=open&sort=created&direction=asc`,
    );
    if (result.error) errors.push(`Open list incomplete, remaining count unknown: ${result.error}`);
    for (const issue of result.items) {
      try {
        add({
          ...parseTarget(String(issue.number), repository),
          kind: issue.pull_request ? "pr" : "issue",
        });
      } catch (error) {
        errors.push(`Invalid list item: ${error.message}`);
      }
    }
    // Absence is not closure. Re-read previously evaluated items only after complete pagination.
    if (!result.error) {
      for (const item of [...(previous?.prs ?? []), ...(previous?.issues ?? [])]) {
        if (
          item.repository.toLowerCase() !== repository.toLowerCase() ||
          jobs.has(itemIdentity(item))
        )
          continue;
        add(parseTarget(item.url, repository));
      }
    }
  }
  const work = [...jobs.values()];
  const items = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, work.length) }, async () => {
      while (cursor < work.length) {
        const target = work[cursor++];
        try {
          const item = await readItem(github, target);
          if (type !== "all" && item.kind !== type)
            throw new Error("Specified number type does not match --type");
          items.push(item);
        } catch (error) {
          errors.push(`${itemIdentity(target)} collection incomplete: ${error.message}`);
        }
      }
    }),
  );
  return {
    items,
    errors: errors.sort(),
    repositories: [
      ...new Map(
        [repository, ...targets.map((item) => item.repository)].map((name) => [
          name.toLowerCase(),
          name,
        ]),
      ).values(),
    ],
  };
}
