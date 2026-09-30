#!/usr/bin/env node
import { parseArgs } from "node:util";
import { createGithub } from "../lib/github.mjs";
import { prepareRun } from "../lib/prepare-run.mjs";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      project: { type: "string" },
      repo: { type: "string" },
      type: { type: "string", default: "all" },
      limit: { type: "string", default: "10" },
      force: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(
      "Usage: node prepare-run.mjs [number or GitHub Issue/PR URL...] [--type all|pr|issue] [--limit 10] [--force] [--repo OWNER/REPO] [--project directory]\nSelect incrementally by default; explicit numbers/URLs force reassessment. Read GitHub with gh GET only, write local batch files, and leave processing records unchanged.",
    );
  } else {
    console.log(
      JSON.stringify(
        await prepareRun(
          {
            project: values.project,
            repository: values.repo,
            type: values.type,
            limit: Number(values.limit),
            force: values.force,
            targets: positionals,
          },
          createGithub(values.project),
        ),
        null,
        2,
      ),
    );
  }
} catch (error) {
  console.error(`Preparation failed: ${error.message}`);
  process.exitCode = 1;
}
