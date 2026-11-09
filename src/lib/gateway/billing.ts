import { Prisma, UsageStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type TokenUsage = { promptTokens: number; completionTokens: number; cachedTokens: number; totalTokens: number };
export type ModelPricing = { inputMicrosPerMillion: bigint; outputMicrosPerMillion: bigint; cachedInputMicrosPerMillion: bigint | null };

export function calculateCostMicros(pricing: ModelPricing, usage: TokenUsage) {
  const cached = BigInt(Math.min(Math.max(usage.cachedTokens, 0), usage.promptTokens));
  const uncached = BigInt(Math.max(usage.promptTokens - usage.cachedTokens, 0));
  const cachedPrice = pricing.cachedInputMicrosPerMillion ?? pricing.inputMicrosPerMillion;
  const numerator = uncached * pricing.inputMicrosPerMillion + cached * cachedPrice + BigInt(usage.completionTokens) * pricing.outputMicrosPerMillion;
  return (numerator + 999_999n) / 1_000_000n;
}

export function hasSufficientBalance(balanceMicros: bigint | null, pricing: ModelPricing) {
  const free = pricing.inputMicrosPerMillion === 0n && pricing.outputMicrosPerMillion === 0n && (pricing.cachedInputMicrosPerMillion ?? 0n) === 0n;
  return balanceMicros !== null && (free || balanceMicros > 0n);
}

export function normalizeUsage(value: unknown): TokenUsage | null {
  if (!value || typeof value !== "object") return null;
  const usage = value as Record<string, unknown>;
  const promptTokens = Number(usage.prompt_tokens);
  const completionTokens = Number(usage.completion_tokens);
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return null;
  const details = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  const cachedTokens = Number(details?.cached_tokens ?? 0);
  return {
    promptTokens: Math.max(0, Math.floor(promptTokens)),
    completionTokens: Math.max(0, Math.floor(completionTokens)),
    cachedTokens: Number.isFinite(cachedTokens) ? Math.max(0, Math.floor(cachedTokens)) : 0,
    totalTokens: Math.max(0, Math.floor(Number(usage.total_tokens) || promptTokens + completionTokens)),
  };
}

export async function settleUsage(input: {
  requestId: string;
  userId: string;
  apiKeyId: string;
  modelId: string;
  usage: TokenUsage;
  pricing: ModelPricing;
  status: UsageStatus;
  durationMs: number;
  usageSource: "provider" | "estimated";
}) {
  const cost = calculateCostMicros(input.pricing, input.usage);
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.usageEvent.findUnique({ where: { requestId: input.requestId } });
      if (existing) return existing;
      const wallet = await tx.wallet.update({
        where: { userId: input.userId },
        data: { balanceMicros: { decrement: cost } },
      });
      const usageEvent = await tx.usageEvent.create({ data: {
        requestId: input.requestId,
        userId: input.userId,
        apiKeyId: input.apiKeyId,
        modelId: input.modelId,
        promptTokens: input.usage.promptTokens,
        completionTokens: input.usage.completionTokens,
        cachedTokens: input.usage.cachedTokens,
        totalTokens: input.usage.totalTokens,
        costMicros: cost,
        status: input.status,
        durationMs: input.durationMs,
        usageSource: input.usageSource,
      } });
      await tx.transaction.create({ data: {
        userId: input.userId,
        type: "USAGE",
        status: "COMPLETED",
        amountMicros: -cost,
        balanceAfterMicros: wallet.balanceMicros,
        externalRef: `usage:${input.requestId}`,
        description: "AI gateway usage",
        metadata: { requestId: input.requestId, modelId: input.modelId },
      } });
      return usageEvent;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.usageEvent.findUniqueOrThrow({ where: { requestId: input.requestId } });
    }
    throw error;
  }
}
