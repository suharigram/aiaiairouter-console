import "server-only";
import { Redis } from "@upstash/redis";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";

export type RateLimitResult = { success: boolean; remaining: number; reset: Date };

export async function checkRateLimit(key: string, limit: number, windowSeconds = 60): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);
  const reset = new Date(windowStart.getTime() + windowSeconds * 1000);
  const scopedKey = `rate:${key}:${windowStart.toISOString()}`;

  if (serverEnv.upstashUrl && serverEnv.upstashToken) {
    try {
      const redis = new Redis({ url: serverEnv.upstashUrl, token: serverEnv.upstashToken });
      const count = Number(await redis.eval(
        "local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return c",
        [scopedKey],
        [windowSeconds * 1000],
      ));
      return { success: count <= limit, remaining: Math.max(0, limit - count), reset };
    } catch {
      // The durable Postgres limiter remains available during a Redis outage.
    }
  }

  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "rate_limits" ("key", "window_start", "count", "expires_at")
    VALUES (${scopedKey}, ${windowStart}, 1, ${reset})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limits"."window_start" = EXCLUDED."window_start" THEN "rate_limits"."count" + 1 ELSE 1 END,
      "window_start" = EXCLUDED."window_start",
      "expires_at" = EXCLUDED."expires_at"
    RETURNING "count"
  `;
  const count = Number(rows[0]?.count ?? 1);
  return { success: count <= limit, remaining: Math.max(0, limit - count), reset };
}
