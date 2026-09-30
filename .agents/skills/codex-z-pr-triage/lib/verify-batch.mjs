import { itemIdentity, validateReport } from "./report.mjs";
import { readItem } from "./github.mjs";
import { skipReason } from "./incremental.mjs";

/** Bind completion to the selected source and a fresh read; never infer an AI verdict. */
export async function verifyBatch(incoming, selection, github) {
  validateReport(incoming, { requireCardSummary: true });
  if (
    incoming.schemaVersion !== 2 ||
    selection?.schemaVersion !== 1 ||
    !Array.isArray(selection.selected) ||
    !Array.isArray(selection.skipped) ||
    !Array.isArray(selection.errors)
  )
    throw new Error("Version 2 report and prepare-run selection.json required");
  const expected = new Map();
  for (const item of [...selection.selected, ...selection.skipped]) {
    if (expected.has(itemIdentity(item))) throw new Error("Duplicate items in selection");
    expected.set(itemIdentity(item), item);
  }
  const result = structuredClone(incoming);
  const errors = [...selection.errors, ...result.errors];
  const entries = [
    ...result.prs.map((item) => ({ item, kind: "pr", skipped: false })),
    ...result.issues.map((item) => ({ item, kind: "issue", skipped: false })),
    ...result.skipped.map((item) => ({ item, kind: item.kind ?? "pr", skipped: true })),
  ];
  for (const { item, kind, skipped } of entries) {
    const target = expected.get(itemIdentity(item));
    if (!target || target.kind !== kind)
      throw new Error(
        `${itemIdentity(item)} outside this batch selection for the corresponding type`,
      );
    expected.delete(itemIdentity(item));
    if (!item.source) {
      // A useful partial assessment is still not a completion checkpoint.
      item.source = null;
      errors.push(
        `${itemIdentity(item)} analysis incomplete; retry next time. This batch did not advance the processed version.`,
      );
      continue;
    }
    if (
      item.source.fingerprint !== target.source.fingerprint ||
      item.source.collectedAt !== target.source.collectedAt
    )
      throw new Error(`${itemIdentity(item)} source must come unchanged from selection.json`);
    if (
      !skipped &&
      kind === "pr" &&
      (item.headSha !== target.headSha || item.baseSha !== target.baseSha)
    )
      throw new Error(
        `${itemIdentity(item)} assessment HEAD/BASE does not match selection snapshot`,
      );
    try {
      const live = await readItem(github, target);
      if (live.source.fingerprint !== target.source.fingerprint)
        throw new Error("Content, discussion, or commits changed during analysis");
      const reason = skipReason(live);
      if (Boolean(reason) !== skipped)
        throw new Error("Item no longer belongs to this assessment/skip scope");
      if (skipped) item.reason = reason;
      item.source = live.source;
    } catch (error) {
      item.source = null;
      errors.push(
        `${itemIdentity(item)} failed publication recheck; retry next time: ${error.message}`,
      );
    }
  }
  // Missing records (including an interrupted analysis) must not masquerade as a finished batch.
  for (const identity of expected.keys())
    errors.push(`${identity} incomplete in this batch; processed version unchanged.`);
  result.errors = [...new Set(errors)];
  result.complete = result.errors.length === 0;
  return validateReport(result, { requireCardSummary: true });
}
