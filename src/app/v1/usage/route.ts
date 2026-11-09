import { NextResponse } from "next/server";
import { authenticateVirtualKey } from "@/lib/gateway/keys";
import { checkRateLimit } from "@/lib/rate-limit";
import { usageQuerySchema } from "@/lib/gateway/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiKey = await authenticateVirtualKey(request);
  if (!apiKey) return NextResponse.json({ error: { message: "Invalid API key.", type: "authentication_error", code: "invalid_api_key" } }, { status: 401 });
  const limit = await checkRateLimit(`usage:${apiKey.userId}`, 60, 60);
  if (!limit.success) return NextResponse.json({ error: { message: "Rate limit exceeded.", type: "rate_limit_error", code: "rate_limited" } }, { status: 429 });
  const url = new URL(request.url);
  const parsed = usageQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: { message: "Invalid usage query.", type: "invalid_request_error", code: "validation_failed" } }, { status: 400 });
  const { start, end, limit: take, cursor } = parsed.data;
  const events = await db.usageEvent.findMany({
    where: { userId: apiKey.userId, createdAt: { gte: start ? new Date(start) : undefined, lte: end ? new Date(end) : undefined } },
    include: { model: { select: { slug: true } } },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = events.slice(0, take);
  return NextResponse.json({
    object: "list",
    data: page.map((event) => ({
      id: event.id,
      request_id: event.requestId,
      model: event.model.slug,
      created_at: event.createdAt.toISOString(),
      prompt_tokens: event.promptTokens,
      completion_tokens: event.completionTokens,
      cached_tokens: event.cachedTokens,
      total_tokens: event.totalTokens,
      cost_usd: Number(event.costMicros) / 1_000_000,
      usage_source: event.usageSource,
      status: event.status.toLowerCase(),
    })),
    has_more: events.length > take,
    next_cursor: events.length > take ? page.at(-1)?.id : null,
  });
}

import { db } from "@/lib/db";
