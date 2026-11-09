import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { callOpenAICompatibleProvider, ProviderError } from "@/lib/gateway/providers";

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI-compatible provider transport", () => {
  it("maps the model request to the configured chat completions endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "chatcmpl-test", choices: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await callOpenAICompatibleProvider({ baseUrl: "https://api.deepseek.com/v1", apiKey: "secret-provider-key", body: { model: "deepseek-flash" }, signal: new AbortController().signal });
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret-provider-key" });
  });

  it("sanitizes provider errors and never returns the credential", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret-provider-key leaked upstream", { status: 401 })));
    const promise = callOpenAICompatibleProvider({ baseUrl: "https://api.deepseek.com/v1", apiKey: "secret-provider-key", body: {}, signal: new AbortController().signal });
    await expect(promise).rejects.toMatchObject({ code: "provider_authentication" });
    await promise.catch((error: ProviderError) => expect(error.message).not.toContain("secret-provider-key"));
  });
});
