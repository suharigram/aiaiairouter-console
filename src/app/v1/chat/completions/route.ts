import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { hasSufficientBalance, normalizeUsage, settleUsage } from "@/lib/gateway/billing";
import { authenticateVirtualKey } from "@/lib/gateway/keys";
import { callOpenAICompatibleProvider, getProviderCredential, providerDefinitions, ProviderError, type ProviderSlug } from "@/lib/gateway/providers";
import { createMeteredStream } from "@/lib/gateway/stream";
import { chatCompletionSchema } from "@/lib/gateway/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

function apiError(status: number, message: string, code: string, requestId?: string) {
  return NextResponse.json(
    { error: { message, type: status === 401 ? "authentication_error" : status === 429 ? "rate_limit_error" : status === 400 ? "invalid_request_error" : "api_error", code }, request_id: requestId },
    { status, headers: { "Cache-Control": "no-store", ...(requestId ? { "x-request-id": requestId } : {}) } },
  );
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let apiKeyId: string | undefined;
  let userId: string | undefined;
  let modelSlug = "unknown";
  let streamed = false;
  try {
    const apiKey = await authenticateVirtualKey(request);
    if (!apiKey) return apiError(401, "Invalid, revoked, or expired API key.", "invalid_api_key", requestId);
    apiKeyId = apiKey.id;
    userId = apiKey.userId;
    const [keyLimit, userLimit] = await Promise.all([
      checkRateLimit(`gateway:key:${apiKey.id}`, Number(process.env.GATEWAY_KEY_RATE_LIMIT) || 60, 60),
      checkRateLimit(`gateway:user:${apiKey.userId}`, Number(process.env.GATEWAY_USER_RATE_LIMIT) || 120, 60),
    ]);
    if (!keyLimit.success || !userLimit.success) {
      return apiError(429, "Rate limit exceeded. Slow down before retrying.", "rate_limited", requestId);
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 1_100_000) return apiError(413, "Request body is too large.", "request_too_large", requestId);
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 1_100_000) return apiError(413, "Request body is too large.", "request_too_large", requestId);
    let json: unknown;
    try { json = JSON.parse(rawBody); } catch { return apiError(400, "Request body must be valid JSON.", "invalid_json", requestId); }
    const parsed = chatCompletionSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(400, parsed.error.issues[0] ? `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` : "Invalid request.", "validation_failed", requestId);
    }
    const input = parsed.data;
    modelSlug = input.model;
    streamed = input.stream;
    const model = await db.model.findFirst({
      where: { slug: input.model, isActive: true, provider: { isEnabled: true } },
      include: { provider: true },
    });
    if (!model) return apiError(404, "The requested model is not available.", "model_not_found", requestId);
    if (input.stream && !model.supportsStreaming) return apiError(400, "This model does not support streaming.", "streaming_unsupported", requestId);
    const pricing = {
      inputMicrosPerMillion: model.inputMicrosPerMillion,
      outputMicrosPerMillion: model.outputMicrosPerMillion,
      cachedInputMicrosPerMillion: model.cachedInputMicrosPerMillion,
    };
    if (!hasSufficientBalance(apiKey.user.wallet?.balanceMicros ?? null, pricing)) {
      return apiError(402, "Insufficient credits. Add credits before making a request.", "insufficient_credits", requestId);
    }
    const definition = providerDefinitions[model.provider.slug as ProviderSlug];
    const apiKeyForProvider = await getProviderCredential(model.providerId, model.provider.slug);
    if (!definition || !apiKeyForProvider) return apiError(503, "The selected provider is not configured.", "provider_not_configured", requestId);

    await db.requestLog.create({ data: {
      requestId,
      userId,
      apiKeyId,
      modelSlug,
      providerSlug: model.provider.slug,
      statusCode: 102,
      latencyMs: 0,
      streamed,
    } });
    const timeout = Number(process.env.PROVIDER_TIMEOUT_MS) || 60_000;
    const providerController = new AbortController();
    const cancelProvider = () => providerController.abort();
    request.signal.addEventListener("abort", cancelProvider, { once: true });
    const providerTimer = setTimeout(cancelProvider, timeout);
    const signal = providerController.signal;
    const providerBody = {
      ...input,
      model: model.providerModel,
      ...(input.stream ? { stream_options: { ...input.stream_options, include_usage: true } } : {}),
    };
    const response = await callOpenAICompatibleProvider({ baseUrl: definition.baseUrl, apiKey: apiKeyForProvider, body: providerBody, signal });
    clearTimeout(providerTimer);

    if (input.stream) {
      if (!response.body) throw new ProviderError(502, "empty_provider_response", "The provider returned an empty stream.");
      const stream = createMeteredStream({
        body: response.body,
        modelSlug: model.slug,
        requestId,
        userId: userId!,
        apiKeyId: apiKey.id,
        modelId: model.id,
        pricing,
        prompt: JSON.stringify(input.messages),
        startedAt,
      });
      return new Response(stream, { headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "x-request-id": requestId,
      } });
    }

    const completion = await response.json() as Record<string, unknown>;
    const normalizedUsage = normalizeUsage(completion.usage);
    const usage = normalizedUsage ?? {
      promptTokens: Math.max(1, Math.ceil(Buffer.byteLength(JSON.stringify(input.messages)) / 4)),
      completionTokens: Math.max(1, Math.ceil(Buffer.byteLength(JSON.stringify(completion.choices ?? "")) / 4)),
      cachedTokens: 0,
      totalTokens: 0,
    };
    usage.totalTokens ||= usage.promptTokens + usage.completionTokens;
    await settleUsage({
      requestId,
      userId: userId!,
      apiKeyId: apiKey.id,
      modelId: model.id,
      usage,
      pricing,
      status: "COMPLETED",
      durationMs: Date.now() - startedAt,
      usageSource: normalizedUsage ? "provider" : "estimated",
    });
    await db.requestLog.update({ where: { requestId }, data: { statusCode: 200, latencyMs: Date.now() - startedAt } });
    return NextResponse.json({ ...completion, model: model.slug }, { headers: { "x-request-id": requestId, "Cache-Control": "no-store" } });
  } catch (error) {
    const providerError = error instanceof ProviderError ? error : null;
    const status = providerError?.status ?? 500;
    const code = providerError?.code ?? "internal_error";
    const message = providerError?.message ?? "The gateway could not complete the request.";
    if (userId) {
      await db.requestLog.upsert({
        where: { requestId },
        update: { statusCode: status, latencyMs: Date.now() - startedAt, errorCode: code },
        create: { requestId, userId, apiKeyId, modelSlug, statusCode: status, latencyMs: Date.now() - startedAt, streamed, errorCode: code },
      }).catch(() => undefined);
    }
    return apiError(status, message, code, requestId);
  }
}
