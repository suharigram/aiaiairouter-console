"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { ensureProfile, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security";
import { getStripe, getStripePrice } from "@/lib/stripe";

export async function createCheckoutSession(tier: string) {
  const user = await requireUser();
  const parsedTier = z.enum(["small", "medium", "large"]).parse(tier);
  const limit = await checkRateLimit(`billing:${user.id}`, 10, 60);
  if (!limit.success) throw new Error("Too many checkout attempts. Please wait a minute.");
  const stripe = getStripe();
  const priceId = getStripePrice(parsedTier);
  const price = await stripe.prices.retrieve(priceId);
  if (!price.active || price.recurring || price.currency !== "usd" || !price.unit_amount) {
    throw new Error("The selected Stripe Price must be an active one-time USD price with a fixed amount.");
  }
  const profile = await ensureProfile(user);
  let customerId = profile.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      name: profile.name ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await db.profile.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }
  const transaction = await db.transaction.create({
    data: {
      userId: user.id,
      type: "CREDIT",
      status: "PENDING",
      amountMicros: BigInt(price.unit_amount) * 10_000n,
      amountCents: price.unit_amount,
      description: `Credit purchase (${parsedTier})`,
      metadata: { priceId },
    },
  });
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      success_url: `${serverEnv.appUrl}/dashboard/billing?success=1`,
      cancel_url: `${serverEnv.appUrl}/dashboard/billing?cancelled=1`,
      metadata: { transaction_id: transaction.id, user_id: user.id },
      payment_intent_data: { metadata: { transaction_id: transaction.id, user_id: user.id } },
    }, { idempotencyKey: `checkout:${transaction.id}` });
    await db.transaction.update({ where: { id: transaction.id }, data: { stripeCheckoutSessionId: session.id } });
    await recordSecurityEvent(user.id, "checkout_created", { transactionId: transaction.id });
    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
    redirect(session.url);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    await db.transaction.updateMany({ where: { id: transaction.id, status: "PENDING" }, data: { status: "FAILED" } });
    throw error;
  }
}

export async function createCustomerPortalSession() {
  const user = await requireUser();
  const profile = await db.profile.findUniqueOrThrow({ where: { id: user.id } });
  if (!profile.stripeCustomerId) throw new Error("Add credits once before opening the payment portal.");
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: `${serverEnv.appUrl}/dashboard/billing`,
  });
  redirect(session.url);
}
