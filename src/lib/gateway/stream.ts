import { UsageStatus } from "@prisma/client";
import { normalizeUsage, settleUsage, type ModelPricing, type TokenUsage } from "@/lib/gateway/billing";

function estimateTokens(value: string) {
  return Math.max(value ? 1 : 0, Math.ceil(Buffer.byteLength(value, "utf8") / 4));
}

export function createMeteredStream({ body, modelSlug, requestId, userId, apiKeyId, modelId, pricing, prompt, startedAt }: {
  body: ReadableStream<Uint8Array>;
  modelSlug: string;
  requestId: string;
  userId: string;
  apiKeyId: string;
  modelId: string;
  pricing: ModelPricing;
  prompt: string;
  startedAt: number;
}) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let providerUsage: TokenUsage | null = null;
  let output = "";
  let finalized = false;
  let cancelled = false;

  async function finalize(status: UsageStatus, errorCode?: string) {
    if (finalized) return;
    finalized = true;
    const usage = providerUsage ?? {
      promptTokens: estimateTokens(prompt),
      completionTokens: estimateTokens(output),
      cachedTokens: 0,
      totalTokens: estimateTokens(prompt) + estimateTokens(output),
    };
    try {
      await settleUsage({
        requestId,
        userId,
        apiKeyId,
        modelId,
        usage,
        pricing,
        status,
        durationMs: Date.now() - startedAt,
        usageSource: providerUsage ? "provider" : "estimated",
      });
      const { db } = await import("@/lib/db");
      await db.requestLog.update({ where: { requestId }, data: { statusCode: status === "FAILED" ? 502 : 200, latencyMs: Date.now() - startedAt, errorCode } });
    } catch {
      console.error(`Usage settlement failed for request ${requestId}`);
    }
  }

  function transformEvent(event: string) {
    const lines = event.split(/\r?\n/);
    return lines.map((line) => {
      if (!line.startsWith("data:")) return line;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") return line;
      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        const usage = normalizeUsage(parsed.usage);
        if (usage) providerUsage = usage;
        parsed.model = modelSlug;
        const choices = parsed.choices;
        if (Array.isArray(choices)) {
          for (const choice of choices) {
            const delta = (choice as { delta?: { content?: unknown } }).delta;
            if (typeof delta?.content === "string") output += delta.content;
          }
        }
        return `data: ${JSON.stringify(parsed)}`;
      } catch {
        return line;
      }
    }).join("\n");
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? "";
          for (const event of events) controller.enqueue(encoder.encode(`${transformEvent(event)}\n\n`));
        }
        buffer += decoder.decode();
        if (buffer.trim()) controller.enqueue(encoder.encode(`${transformEvent(buffer)}\n\n`));
        controller.close();
        await finalize(cancelled ? "ABORTED" : "COMPLETED");
      } catch {
        if (!cancelled) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: { message: "The provider stream ended unexpectedly.", type: "api_error", code: "provider_stream_failed" } })}\n\ndata: [DONE]\n\n`));
          controller.close();
        }
        await finalize("FAILED", "provider_stream_failed");
      }
    },
    async cancel() {
      cancelled = true;
      await reader.cancel();
      await finalize("ABORTED");
    },
  });
}
