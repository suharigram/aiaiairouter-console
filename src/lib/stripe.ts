import "server-only";
import Stripe from "stripe";
import { isConfigured, serverEnv } from "@/lib/env";

export function getStripe() {
  if (!isConfigured(serverEnv.stripeSecretKey)) {
    throw new Error("Stripe is not configured. Add a live or test secret key to the environment.");
  }
  return new Stripe(serverEnv.stripeSecretKey!);
}

export function getStripePrice(tier: string) {
  const price = {
    small: process.env.STRIPE_PRICE_SMALL,
    medium: process.env.STRIPE_PRICE_MEDIUM,
    large: process.env.STRIPE_PRICE_LARGE,
  }[tier];
  if (!price || !isConfigured(price)) throw new Error("This credit package is not configured.");
  return price;
}
