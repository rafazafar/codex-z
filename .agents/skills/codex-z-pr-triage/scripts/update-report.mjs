#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { updateProjectReport } from "../lib/update-report.mjs";
import { createGithub } from "../lib/github.mjs";
import { verifyBatch } from "../lib/verify-batch.mjs";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { selection: { type: "string" }, help: { type: "boolean", default: false } },
  });
  if (values.help) {
    console.log(
      "Usage: node update-report.mjs <batch-assessment.json> [project-directory] [--selection selection.json]\nUpdate pr-triage/ incrementally offline by default. New processed records require --selection and source verification through gh GET. Do not write GitHub.",
    );
  } else {
    if (positionals.length < 1 || positionals.length > 2)
      throw new Error("Batch assessment JSON and optional project directory required; see --help");
    let incoming = JSON.parse(await readFile(resolve(positionals[0]), "utf8"));
    if (values.selection) {
      const selection = JSON.parse(await readFile(resolve(values.selection), "utf8"));
      const github = createGithub(positionals[1]);
      await github.authenticate();
      incoming = await verifyBatch(incoming, selection, github);
    } else if (
      [...(incoming.prs ?? []), ...(incoming.issues ?? []), ...(incoming.skipped ?? [])].some(
        (item) => item.source,
      )
    ) {
      throw new Error(
        "Processing updates require --selection; use render-report.mjs for offline HTML recovery",
      );
    }
    console.log(JSON.stringify(await updateProjectReport(incoming, positionals[1]), null, 2));
  }
} catch (error) {
  console.error(`Incremental update failed: ${error.message}`);
  process.exitCode = 1;
}
