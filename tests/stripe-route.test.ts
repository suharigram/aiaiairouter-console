import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  serverEnv: { stripeSecretKey: "sk_test_51ExampleNotARealCredential", stripeWebhookSecret: "whsec_route_test_secret" },
  isConfigured: () => true,
}));
const processMock = vi.hoisted(() => vi.fn().mockResolvedValue({ duplicate: false }));
vi.mock("@/lib/stripe-webhook", () => ({ processStripeEvent: processMock }));

import { POST } from "@/app/api/stripe/webhook/route";

const payload = JSON.stringify({ id: "evt_route_test", object: "event", type: "checkout.session.expired" });

describe("Stripe webhook route", () => {
  it("accepts a correctly signed test event", async () => {
    const stripe = new Stripe("sk_test_51ExampleNotARealCredential");
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_route_test_secret" });
    const response = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: false });
    expect(processMock).toHaveBeenCalled();
  });
  it("rejects an invalid signature before processing", async () => {
    const stripe = new Stripe("sk_test_51ExampleNotARealCredential");
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    const response = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
    expect(response.status).toBe(400);
  });
});
