import { describe, expect, it } from "vitest";
import { decryptProviderKey, encryptProviderKey } from "@/lib/provider-crypto";

process.env.PROVIDER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

describe("provider key encryption", () => {
  it("uses authenticated AES-256-GCM encryption", () => {
    const encrypted = encryptProviderKey("provider-secret-test");
    expect(encrypted).not.toContain("provider-secret-test");
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(decryptProviderKey(encrypted)).toBe("provider-secret-test");
  });
  it("rejects tampered ciphertext", () => {
    const encrypted = encryptProviderKey("provider-secret-test");
    const parts = encrypted.split(":");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptProviderKey(parts.join(":"))).toThrow();
  });
});
