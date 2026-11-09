import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function generateVirtualApiKey() {
  const key = `aiaiai_sk_${randomBytes(32).toString("base64url")}`;
  return { key, prefix: `${key.slice(0, 17)}…`, hash: hashVirtualApiKey(key) };
}

export function hashVirtualApiKey(key: string, secret = process.env.AUTH_SECRET) {
  if (!secret) throw new Error("AUTH_SECRET is required to hash API keys.");
  return createHmac("sha256", secret).update(key).digest("hex");
}

export function hashesMatch(received: string, stored: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
