import { NextResponse } from "next/server";
import { isConfigured, serverEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { processStripeEvent } from "@/lib/stripe-webhook";

export async function POST(request: Request) {
  if (!isConfigured(serverEnv.stripeSecretKey) || !isConfigured(serverEnv.stripeWebhookSecret)) {
    return NextResponse.json({ error: "Stripe webhooks are not configured." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  const payload = await request.text();
  try {
    const event = await getStripe().webhooks.constructEventAsync(payload, signature, serverEnv.stripeWebhookSecret!);
    const result = await processStripeEvent(event);
    return NextResponse.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    const isSignatureError = error instanceof getStripe().errors.StripeSignatureVerificationError;
    return NextResponse.json(
      { error: isSignatureError ? "Invalid webhook signature." : "Webhook processing failed." },
      { status: isSignatureError ? 400 : 500 },
    );
  }
}
