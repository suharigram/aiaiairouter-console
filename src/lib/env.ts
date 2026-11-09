import { z } from "zod";

const optionalUrl = z.union([z.literal(""), z.string().url()]).optional();

export function isConfigured(value: string | undefined) {
  if (!value) return false;
  return !/(replace|placeholder|local-development|project-ref|localhost\.test|local_)/i.test(value);
}

export const serverEnv = {
  databaseUrl: process.env.DATABASE_URL,
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  authSecret: process.env.AUTH_SECRET,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  emailProvider: process.env.EMAIL_PROVIDER,
  resendApiKey: process.env.RESEND_API_KEY,
  postmarkToken: process.env.POSTMARK_SERVER_TOKEN,
  emailFrom: process.env.EMAIL_FROM,
  emailReplyTo: process.env.EMAIL_REPLY_TO,
  upstashUrl: optionalUrl.safeParse(process.env.UPSTASH_REDIS_REST_URL).success
    ? process.env.UPSTASH_REDIS_REST_URL
    : undefined,
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
};

export function supabaseIsConfigured() {
  return Boolean(
    serverEnv.supabaseUrl &&
      serverEnv.supabaseAnonKey &&
      z.string().url().safeParse(serverEnv.supabaseUrl).success &&
      !serverEnv.supabaseUrl.includes("project-ref"),
  );
}

export function stripeIsConfigured() {
  return isConfigured(serverEnv.stripeSecretKey);
}
