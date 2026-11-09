import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
const harness = vi.hoisted(() => ({ tx: {} as unknown }));
vi.mock("@/lib/db", () => ({ db: { $transaction: async (callback: (tx: unknown) => unknown) => callback(harness.tx) } }));

import { processStripeEvent } from "@/lib/stripe-webhook";

const transaction = {
  id: "5b46d9de-0eb0-45a9-a6a7-fd9dd89f1c05",
  userId: "37ac8a51-e79a-4f1f-a6f2-95f78843c282",
  status: "PENDING",
  amountCents: 1000,
  amountMicros: 10_000_000n,
  currency: "usd",
};

function makeTx() {
  return {
    webhookEvent: { create: vi.fn(), update: vi.fn() },
    transaction: {
      findUnique: vi.fn().mockResolvedValue(transaction),
      update: vi.fn().mockResolvedValue(transaction),
      findFirst: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    wallet: { upsert: vi.fn().mockResolvedValue({ balanceMicros: 10_000_000n }), update: vi.fn() },
    securityEvent: { create: vi.fn() },
  };
}

function checkoutEvent(type: string): Stripe.Event {
  return {
    id: "evt_test_checkout",
    type,
    data: { object: {
      id: "cs_test_123",
      payment_status: "paid",
      amount_total: 1000,
      currency: "usd",
      client_reference_id: transaction.userId,
      metadata: { transaction_id: transaction.id },
      payment_intent: "pi_test_123",
    } },
  } as unknown as Stripe.Event;
}

beforeEach(() => { harness.tx = makeTx(); });

describe("Stripe webhook processing", () => {
  it("verifies a real Stripe test signature", async () => {
    const stripe = new Stripe("sk_test_51ExampleNotARealCredential");
    const payload = JSON.stringify({ id: "evt_test", object: "event", type: "checkout.session.expired" });
    const secret = "whsec_test_only_secret";
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
    expect(event.id).toBe("evt_test");
    await expect(stripe.webhooks.constructEventAsync(payload, signature, "whsec_wrong")).rejects.toThrow();
  });

  it("credits a confirmed payment exactly once", async () => {
    const tx = harness.tx as ReturnType<typeof makeTx>;
    const result = await processStripeEvent(checkoutEvent("checkout.session.completed"));
    expect(result.duplicate).toBe(false);
    expect(tx.wallet.upsert).toHaveBeenCalledOnce();
    expect(tx.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }));
  });

  it("treats an already recorded event as a duplicate without another credit", async () => {
    const tx = harness.tx as ReturnType<typeof makeTx>;
    tx.webhookEvent.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6.19.3" }));
    const result = await processStripeEvent(checkoutEvent("checkout.session.completed"));
    expect(result).toEqual({ duplicate: true });
    expect(tx.wallet.upsert).not.toHaveBeenCalled();
  });

  it("expires a checkout without changing the wallet", async () => {
    const tx = harness.tx as ReturnType<typeof makeTx>;
    await processStripeEvent(checkoutEvent("checkout.session.expired"));
    expect(tx.wallet.upsert).not.toHaveBeenCalled();
    expect(tx.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "EXPIRED" } }));
  });

  it("debits only the delta between cumulative partial refunds", async () => {
    const tx = harness.tx as ReturnType<typeof makeTx>;
    tx.transaction.findFirst.mockResolvedValue({ ...transaction, status: "COMPLETED" });
    tx.wallet.update.mockResolvedValue({ balanceMicros: 7_000_000n });
    tx.transaction.aggregate.mockResolvedValueOnce({ _sum: { amountCents: null } }).mockResolvedValueOnce({ _sum: { amountCents: -300 } });
    const event = (id: string, amountRefunded: number) => ({ id, type: "charge.refunded", data: { object: { payment_intent: "pi_test_123", amount_refunded: amountRefunded } } }) as unknown as Stripe.Event;
    await processStripeEvent(event("evt_refund_1", 300));
    await processStripeEvent(event("evt_refund_2", 500));
    expect(tx.wallet.update.mock.calls[0][0].data.balanceMicros.increment).toBe(-3_000_000n);
    expect(tx.wallet.update.mock.calls[1][0].data.balanceMicros.increment).toBe(-2_000_000n);
  });
});
