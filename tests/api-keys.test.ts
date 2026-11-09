import { describe, expect, it } from "vitest";
import { generateVirtualApiKey, hashesMatch, hashVirtualApiKey } from "@/lib/api-keys";

process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";

describe("virtual API keys", () => {
  it("generates a one-time secret and a stable keyed hash", () => {
    const generated = generateVirtualApiKey();
    expect(generated.key).toMatch(/^aiaiai_sk_[A-Za-z0-9_-]{43}$/);
    expect(generated.hash).toBe(hashVirtualApiKey(generated.key));
    expect(generated.hash).not.toContain(generated.key);
    expect(hashesMatch(generated.hash, hashVirtualApiKey(generated.key))).toBe(true);
  });
  it("produces unique keys and rejects a different hash", () => {
    const first = generateVirtualApiKey();
    const second = generateVirtualApiKey();
    expect(first.key).not.toBe(second.key);
    expect(hashesMatch(first.hash, second.hash)).toBe(false);
  });
});
