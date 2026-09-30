import { describe, expect, it } from "vitest";
import {
  harnessAccountInspectParamsSchema,
  harnessAccountListParamsSchema,
} from "../src/harness-accounts.js";

describe("Harness account request contracts", () => {
  it("supports optional forced refresh without accepting unrelated fields", () => {
    expect(
      harnessAccountInspectParamsSchema.parse({ harnessId: "sample-agent", refresh: true }),
    ).toEqual({ harnessId: "sample-agent", refresh: true });
    expect(harnessAccountListParamsSchema.parse({ refresh: true })).toEqual({ refresh: true });
    expect(harnessAccountListParamsSchema.safeParse({ token: "private" }).success).toBe(false);
  });
});
