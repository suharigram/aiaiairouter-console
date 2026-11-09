import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const settleMock = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("@/lib/gateway/billing", async (original) => ({ ...await original<typeof import("@/lib/gateway/billing")>(), settleUsage: settleMock }));
vi.mock("@/lib/db", () => ({ db: { requestLog: { update: vi.fn() } } }));

import { createMeteredStream } from "@/lib/gateway/stream";

const pricing = { inputMicrosPerMillion: 1_000_000n, outputMicrosPerMillion: 1_000_000n, cachedInputMicrosPerMillion: null };

describe("metered SSE stream", () => {
  it("normalizes model IDs and settles final provider usage once", async () => {
    const input = new TextEncoder().encode('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","model":"upstream","choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}\n\ndata: [DONE]\n\n');
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(input.slice(0, 47)); controller.enqueue(input.slice(47)); controller.close(); } });
    const stream = createMeteredStream({ body, modelSlug: "deepseek/deepseek-flash", requestId: crypto.randomUUID(), userId: crypto.randomUUID(), apiKeyId: crypto.randomUUID(), modelId: crypto.randomUUID(), pricing, prompt: "test", startedAt: Date.now() });
    const output = await new Response(stream).text();
    expect(output).toContain('"model":"deepseek/deepseek-flash"');
    expect(output).toContain("data: [DONE]");
    expect(settleMock).toHaveBeenCalledOnce();
    expect(settleMock).toHaveBeenCalledWith(expect.objectContaining({ usageSource: "provider", usage: { promptTokens: 4, completionTokens: 2, cachedTokens: 0, totalTokens: 6 } }));
  });
});
