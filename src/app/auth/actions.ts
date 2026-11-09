"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { ensureProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendSecurityEmail, sendWelcomeEmail } from "@/lib/email/mailer";
import { serverEnv, supabaseIsConfigured } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestContext } from "@/lib/request-context";
import { recordLogin, recordSecurityEvent } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(72);
const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema });

async function authLimit(ip: string) {
  const result = await checkRateLimit(`auth:${ip}`, 10, 15 * 60);
  if (!result.success) throw new Error("Too many attempts. Try again after the rate-limit window expires.");
}

export async function signUp(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const context = await getRequestContext();
    await authLimit(context.ipHash);
    const input = credentialsSchema.parse({ email: formData.get("email"), password: formData.get("password") });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      ...input,
      options: { emailRedirectTo: `${serverEnv.appUrl}/auth/callback?next=/dashboard` },
    });
    if (error) return { message: "Unable to create the account. Check the details and try again." };
    if (data.user && data.user.identities?.length !== 0) {
      await ensureProfile(data.user);
      await recordSecurityEvent(data.user.id, "account_created");
      await sendWelcomeEmail(data.user.id, input.email);
    }
    return { success: true, message: "Check your inbox for a verification link before signing in." };
  } catch (error) {
    return { message: error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Registration is temporarily unavailable." };
  }
}

export async function signIn(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const context = await getRequestContext();
    await authLimit(context.ipHash);
    const input = credentialsSchema.parse({ email: formData.get("email"), password: formData.get("password") });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(input);
    if (error) {
      const profile = await db.profile.findUnique({ where: { email: input.email } });
      if (profile) {
        await recordSecurityEvent(profile.id, "login_failed");
        const since = new Date(Date.now() - 15 * 60 * 1000);
        const attempts = await db.securityEvent.count({ where: { userId: profile.id, type: "login_failed", createdAt: { gte: since } } });
        if (attempts === 3) {
          await sendSecurityEmail({ userId: profile.id, email: profile.email, title: "Failed sign-in attempts", detail: "Several unsuccessful sign-in attempts were made within 15 minutes.", dedupeKey: `failed-login:${profile.id}:${Math.floor(Date.now() / 900000)}` });
        }
      }
      return { message: "Invalid credentials or an unverified email address." };
    }
    await ensureProfile(data.user);
    await recordLogin(data.user);
    redirect("/dashboard");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { message: error instanceof z.ZodError ? "Enter a valid email and a password of at least 10 characters." : error instanceof Error ? error.message : "Sign-in is temporarily unavailable." };
  }
}

export async function signInWithOAuth(provider: "google" | "github") {
  try {
    const context = await getRequestContext();
    await authLimit(context.ipHash);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${serverEnv.appUrl}/auth/callback?next=/dashboard`, skipBrowserRedirect: true },
    });
    if (error || !data.url) redirect(`/login?message=${encodeURIComponent("OAuth is not configured for this provider.")}`);
    redirect(data.url);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "OAuth is temporarily unavailable.";
    redirect(`/login?message=${encodeURIComponent(message)}`);
  }
}

export async function requestPasswordReset(_state: ActionState, formData: FormData): Promise<ActionState> {
  if (!supabaseIsConfigured()) return { message: "Password reset requires Supabase environment configuration." };
  try {
    const context = await getRequestContext();
    await authLimit(context.ipHash);
    const email = emailSchema.parse(formData.get("email"));
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${serverEnv.appUrl}/auth/callback?next=/reset-password` });
    return { success: true, message: "If the account exists, a password reset link has been sent." };
  } catch {
    return { success: true, message: "If the account exists, a password reset link has been sent." };
  }
}

export async function resendVerification(_state: ActionState, formData: FormData): Promise<ActionState> {
  if (!supabaseIsConfigured()) return { message: "Email verification requires Supabase environment configuration." };
  try {
    const context = await getRequestContext();
    await authLimit(context.ipHash);
    const email = emailSchema.parse(formData.get("email"));
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${serverEnv.appUrl}/auth/callback?next=/dashboard` } });
  } catch {
    // Do not reveal account existence or provider configuration through this endpoint.
  }
  return { success: true, message: "If an unverified account exists, a new verification email has been sent." };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
