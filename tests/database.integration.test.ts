import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import { settleUsage } from "@/lib/gateway/billing";
import { processStripeEvent } from "@/lib/stripe-webhook";

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration("transactional ledger (TEST_DATABASE_URL)", () => {
  it("credits a Stripe event and settles usage exactly once", async () => {
    const userId = randomUUID();
    const eventId = `evt_integration_${randomUUID()}`;
    const sessionId = `cs_integration_${randomUUID()}`;
    const requestId = randomUUID();
    try {
      await db.profile.create({ data: { id: userId, email: `${userId}@integration.test` } });
      await db.wallet.create({ data: { userId } });
      const pending = await db.transaction.create({ data: { userId, type: "CREDIT", status: "PENDING", amountMicros: 10_000_000n, amountCents: 1000, stripeCheckoutSessionId: sessionId, description: "Integration credit" } });
      const event = { id: eventId, type: "checkout.session.completed", data: { object: { id: sessionId, payment_status: "paid", amount_total: 1000, currency: "usd", client_reference_id: userId, metadata: { transaction_id: pending.id }, payment_intent: `pi_${randomUUID()}` } } } as unknown as Stripe.Event;
      await processStripeEvent(event);
      const duplicate = await processStripeEvent(event);
      expect(duplicate.duplicate).toBe(true);
      expect((await db.wallet.findUniqueOrThrow({ where: { userId } })).balanceMicros).toBe(10_000_000n);

      const model = await db.model.findFirstOrThrow({ where: { slug: "deepseek/deepseek-flash" } });
      const apiKey = await db.apiKey.create({ data: { userId, name: "Integration", prefix: "aiaiai_sk_test…", keyHash: randomUUID().replaceAll("-", "").padEnd(64, "0") } });
      const usage = { promptTokens: 100, completionTokens: 50, cachedTokens: 20, totalTokens: 150 };
      const pricing = { inputMicrosPerMillion: model.inputMicrosPerMillion, outputMicrosPerMillion: model.outputMicrosPerMillion, cachedInputMicrosPerMillion: model.cachedInputMicrosPerMillion };
      await settleUsage({ requestId, userId, apiKeyId: apiKey.id, modelId: model.id, usage, pricing, status: "COMPLETED", durationMs: 10, usageSource: "provider" });
      await settleUsage({ requestId, userId, apiKeyId: apiKey.id, modelId: model.id, usage, pricing, status: "COMPLETED", durationMs: 10, usageSource: "provider" });
      expect(await db.usageEvent.count({ where: { requestId } })).toBe(1);
      expect(await db.transaction.count({ where: { userId, externalRef: `usage:${requestId}` } })).toBe(1);
      expect((await db.wallet.findUniqueOrThrow({ where: { userId } })).balanceMicros).toBe(9_999_915n);
    } finally {
      await db.profile.deleteMany({ where: { id: userId } });
      await db.webhookEvent.deleteMany({ where: { eventId } });
    }
  }, 20_000);
});
