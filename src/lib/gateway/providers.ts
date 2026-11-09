import "server-only";
import { db } from "@/lib/db";
import { isConfigured } from "@/lib/env";
import { decryptProviderKey } from "@/lib/provider-crypto";

export const providerDefinitions = {
  deepseek: { envKey: "DEEPSEEK_API_KEY", baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1" },
  dashscope: { envKey: "DASHSCOPE_API_KEY", baseUrl: process.env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" },
  moonshot: { envKey: "MOONSHOT_API_KEY", baseUrl: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1" },
  zhipu: { envKey: "ZHIPU_API_KEY", baseUrl: process.env.ZHIPU_BASE_URL || "https://api.z.ai/api/paas/v4" },
  openrouter: { envKey: "OPENROUTER_API_KEY", baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1" },
} as const;

export type ProviderSlug = keyof typeof providerDefinitions;

export async function getProviderCredential(providerId: string, slug: string) {
  const definition = providerDefinitions[slug as ProviderSlug];
  const envValue = definition ? process.env[definition.envKey] : undefined;
  if (isConfigured(envValue)) return envValue!;
  const stored = await db.providerKey.findFirst({ where: { providerId }, orderBy: { createdAt: "desc" } });
  return stored ? decryptProviderKey(stored.encryptedKey) : null;
}

export class ProviderError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function callOpenAICompatibleProvider({ baseUrl, apiKey, body, signal }: { baseUrl: string; apiKey: string; body: unknown; signal: AbortSignal }) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/chat/completions`);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new ProviderError(500, "provider_configuration", "The provider endpoint must use HTTPS.");
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify(body),
      signal,
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    if (signal.aborted) throw new ProviderError(499, "client_cancelled", "The request was cancelled.");
    throw new ProviderError(502, "provider_unavailable", "The upstream provider could not be reached.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    const code = response.status === 401 || response.status === 403 ? "provider_authentication" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_rejected_request";
    const status = response.status === 429 ? 429 : response.status >= 400 && response.status < 500 ? 502 : 502;
    throw new ProviderError(status, code, code === "provider_rejected_request" ? "The provider rejected the request parameters." : "The provider could not complete the request.");
  }
  return response;
}
