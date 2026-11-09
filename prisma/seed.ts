import { PrismaClient } from "@prisma/client";
import { isConfigured } from "../src/lib/env";

const db = new PrismaClient();

const providers = [
  { slug: "deepseek", name: "DeepSeek", baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1", key: process.env.DEEPSEEK_API_KEY },
  { slug: "dashscope", name: "Alibaba Model Studio", baseUrl: process.env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", key: process.env.DASHSCOPE_API_KEY },
  { slug: "moonshot", name: "Moonshot AI", baseUrl: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1", key: process.env.MOONSHOT_API_KEY },
  { slug: "zhipu", name: "Z.AI / Zhipu AI", baseUrl: process.env.ZHIPU_BASE_URL || "https://api.z.ai/api/paas/v4", key: process.env.ZHIPU_API_KEY },
  { slug: "openrouter", name: "OpenRouter", baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1", key: process.env.OPENROUTER_API_KEY },
];

const models = [
  { provider: "deepseek", slug: "deepseek/deepseek-flash", providerModel: "deepseek-flash", displayName: "DeepSeek Flash", description: "General-purpose and reasoning model with a 1M-token context window.", contextLength: 1_000_000, input: 300_000n, output: 1_200_000n, cached: 6_000n },
  { provider: "deepseek", slug: "deepseek/deepseek-v4-pro", providerModel: "deepseek-v4-pro", displayName: "DeepSeek V4 Pro", description: "Higher-capability reasoning model for complex workloads.", contextLength: 1_000_000, input: 1_320_000n, output: 3_960_000n, cached: 44_000n },
  { provider: "dashscope", slug: "alibaba/qwen-plus", providerModel: "qwen-plus", displayName: "Qwen Plus", description: "Balanced Qwen model served through Alibaba Model Studio compatible mode.", contextLength: 1_000_000, input: 400_000n, output: 1_200_000n, cached: 100_000n },
  { provider: "moonshot", slug: "moonshot/kimi-k2.6", providerModel: "kimi-k2.6", displayName: "Kimi K2.6", description: "Kimi multimodal model for long-context reasoning, coding, and tool use.", contextLength: 262_144, input: 600_000n, output: 2_500_000n, cached: 150_000n },
  { provider: "zhipu", slug: "zhipu/glm-4.5-flash", providerModel: "glm-4.5-flash", displayName: "GLM-4.5 Flash", description: "Free Z.AI model for reasoning, coding, and agents. Provider rate limits apply.", contextLength: 128_000, input: 0n, output: 0n, cached: 0n },
  { provider: "zhipu", slug: "zhipu/glm-4.7-flash", providerModel: "glm-4.7-flash", displayName: "GLM-4.7 Flash", description: "Free Z.AI model for coding and multi-step reasoning. Provider rate limits apply.", contextLength: 200_000, input: 0n, output: 0n, cached: 0n },
  { provider: "zhipu", slug: "zhipu/glm-4.6v-flash", providerModel: "glm-4.6v-flash", displayName: "GLM-4.6V Flash", description: "Free Z.AI vision model for text and image understanding. Provider rate limits apply.", contextLength: 128_000, input: 0n, output: 0n, cached: 0n },
  { provider: "openrouter", slug: "openrouter/free", providerModel: "openrouter/free", displayName: "Free Models Router", description: "Routes each request to an available zero-price model. Model choice and availability vary; upstream rate limits apply.", contextLength: 200_000, input: 0n, output: 0n, cached: 0n },
];

async function main() {
  for (const provider of providers) {
    const storedKey = await db.providerKey.findFirst({ where: { provider: { slug: provider.slug } }, select: { id: true } });
    const enabled = isConfigured(provider.key) || Boolean(storedKey);
    await db.provider.upsert({
      where: { slug: provider.slug },
      update: { name: provider.name, baseUrl: provider.baseUrl, isEnabled: enabled },
      create: { slug: provider.slug, name: provider.name, baseUrl: provider.baseUrl, isEnabled: enabled },
    });
  }
  for (const model of models) {
    const provider = await db.provider.findUniqueOrThrow({ where: { slug: model.provider } });
    await db.model.upsert({
      where: { slug: model.slug },
      update: {
        providerId: provider.id,
        providerModel: model.providerModel,
        displayName: model.displayName,
        description: model.description,
        contextLength: model.contextLength,
        inputMicrosPerMillion: model.input,
        outputMicrosPerMillion: model.output,
        cachedInputMicrosPerMillion: model.cached,
      },
      create: {
        providerId: provider.id,
        slug: model.slug,
        providerModel: model.providerModel,
        displayName: model.displayName,
        description: model.description,
        contextLength: model.contextLength,
        inputMicrosPerMillion: model.input,
        outputMicrosPerMillion: model.output,
        cachedInputMicrosPerMillion: model.cached,
      },
    });
  }
  console.log(`Seeded ${providers.length} providers and ${models.length} models. Enabled providers: ${providers.filter((provider) => isConfigured(provider.key)).map((provider) => provider.slug).join(", ") || "none"}.`);
}

main().catch((error) => {
  console.error("Database seed failed. Verify DATABASE_URL and run migrations first.");
  process.exitCode = 1;
  if (process.env.DEBUG_SEED === "1") console.error(error);
}).finally(() => db.$disconnect());
