import "server-only";
import { createHash, createHmac } from "node:crypto";
import { headers } from "next/headers";

export async function getRequestContext() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  const userAgent = headerList.get("user-agent")?.slice(0, 512) || "unknown";
  const secret = process.env.AUTH_SECRET || "local-development-only";
  return {
    ip,
    userAgent,
    ipHash: createHmac("sha256", secret).update(ip).digest("hex"),
    fingerprint: createHmac("sha256", secret).update(`${ip}|${userAgent}`).digest("hex"),
  };
}

export function safeOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
