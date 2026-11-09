import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { calculateCostMicros, hasSufficientBalance, normalizeUsage } from "@/lib/gateway/billing";

const pricing = { inputMicrosPerMillion: 1_000_000n, outputMicrosPerMillion: 2_000_000n, cachedInputMicrosPerMillion: 100_000n };
const freePricing = { inputMicrosPerMillion: 0n, outputMicrosPerMillion: 0n, cachedInputMicrosPerMillion: 0n };

describe("usage billing", () => {
  it("charges uncached, cached, and output tokens at their own rates", () => {
    expect(calculateCostMicros(pricing, { promptTokens: 1_000_000, completionTokens: 500_000, cachedTokens: 400_000, totalTokens: 1_500_000 })).toBe(1_640_000n);
  });
  it("rounds fractional micro-USD up and never double-counts cached tokens", () => {
    expect(calculateCostMicros(pricing, { promptTokens: 1, completionTokens: 0, cachedTokens: 20, totalTokens: 1 })).toBe(1n);
  });
  it("allows free models with a zero wallet balance without charging usage", () => {
    expect(hasSufficientBalance(0n, freePricing)).toBe(true);
    expect(hasSufficientBalance(0n, pricing)).toBe(false);
    expect(hasSufficientBalance(null, freePricing)).toBe(false);
    expect(calculateCostMicros(freePricing, { promptTokens: 1000, completionTokens: 500, cachedTokens: 100, totalTokens: 1500 })).toBe(0n);
  });
  it("normalizes OpenAI usage and cached-token details", () => {
    expect(normalizeUsage({ prompt_tokens: 20, completion_tokens: 5, total_tokens: 25, prompt_tokens_details: { cached_tokens: 8 } })).toEqual({ promptTokens: 20, completionTokens: 5, cachedTokens: 8, totalTokens: 25 });
    expect(normalizeUsage(null)).toBeNull();
    expect(normalizeUsage({ prompt_tokens: "bad", completion_tokens: 2 })).toBeNull();
  });
});
