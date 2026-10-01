import type { UsageCounters } from "./usage-ledger.js";

/** USD per million tokens at OpenAI's published standard API rates. */
interface ApiTokenPrice {
  input: number;
  cachedInput: number;
  output: number;
}

/**
 * Native Codex reports tokens but no cost, and a ChatGPT subscription has no
 * per-token bill. Settings → Usage therefore estimates what the same tokens
 * would cost at API rates, so Models stay comparable. Source:
 * https://developers.openai.com/api/docs/pricing (checked 2026-10-02).
 *
 * Long-context rates (over 272K prompt tokens) and the Fast service tier are
 * not applied: a ledger line holds a Turn's totals, not its individual
 * requests. The estimate is a lower bound for those Turns.
 */
const OPENAI_API_PRICES: ReadonlyMap<string, ApiTokenPrice> = new Map([
  ["gpt-6-astra", { input: 10, cachedInput: 1, output: 50 }],
  ["gpt-6.1-sol", { input: 2, cachedInput: 0.1, output: 10 }],
  ["gpt-6-sol", { input: 2, cachedInput: 0.2, output: 10 }],
  ["gpt-6-luna", { input: 0.1, cachedInput: 0.01, output: 0.5 }],
  ["gpt-5.6-sol", { input: 4, cachedInput: 0.4, output: 20 }],
  ["gpt-5.6-terra", { input: 2, cachedInput: 0.2, output: 12 }],
  ["gpt-5.6-luna", { input: 0.2, cachedInput: 0.02, output: 1.2 }],
  ["gpt-5.5", { input: 5, cachedInput: 0.5, output: 30 }],
]);

const PER_MILLION = 1_000_000;
const OFFICIAL_HARNESS_ID = "codex";

/**
 * API-rate cost of one Turn's token share, or undefined when the Harness is not
 * native Codex, the Model has no known price, or the Turn reported no tokens.
 * OpenAI counts cached tokens inside `inputTokens` and reasoning inside `outputTokens`.
 */
export function estimateApiCostUsd(
  harnessId: string,
  modelId: string | undefined,
  usage: UsageCounters,
): number | undefined {
  if (harnessId !== OFFICIAL_HARNESS_ID || !modelId) return undefined;
  const price = OPENAI_API_PRICES.get(modelId.trim().toLowerCase());
  if (!price) return undefined;
  const { inputTokens, outputTokens } = usage;
  if (inputTokens === undefined && outputTokens === undefined) return undefined;
  const input = inputTokens ?? 0;
  const cached = Math.min(usage.cachedInputTokens ?? 0, input);
  const cost =
    ((input - cached) * price.input +
      cached * price.cachedInput +
      (outputTokens ?? 0) * price.output) /
    PER_MILLION;
  return Number.isFinite(cost) ? cost : undefined;
}
