"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendSecurityEmail } from "@/lib/email/mailer";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateProfile(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ name: z.string().trim().max(80) }).safeParse({ name: formData.get("name") });
  if (!parsed.success) return { message: "Name must be 80 characters or fewer." };
  await db.profile.update({ where: { id: user.id }, data: { name: parsed.data.name || null } });
  revalidatePath("/dashboard/settings");
  return { success: true, message: "Profile updated." };
}

export async function updatePassword(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ password: z.string().min(10, "Use at least 10 characters.").max(72) }).safeParse({ password: formData.get("password") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };
  const limit = await checkRateLimit(`password:${user.id}`, 5, 15 * 60);
  if (!limit.success) return { message: "Too many password changes. Try again later." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: "Password could not be updated. Try a different password or a fresh recovery link." };
  await supabase.auth.signOut({ scope: "others" });
  await recordSecurityEvent(user.id, "password_changed");
  if (user.email) await sendSecurityEmail({ userId: user.id, email: user.email, title: "Password changed", detail: "Your account password was changed and other sessions were signed out.", dedupeKey: `password:${user.id}:${Date.now()}` });
  return { success: true, message: "Password updated. Other sessions have been signed out." };
}

export async function updateEmail(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.string().trim().email().max(320).transform((value) => value.toLowerCase()).safeParse(formData.get("email"));
  if (!parsed.success) return { message: "Enter a valid email address." };
  const limit = await checkRateLimit(`email:${user.id}`, 5, 60 * 60);
  if (!limit.success) return { message: "Too many email changes. Try again later." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ email: parsed.data }, { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard/settings` });
  if (error) return { message: "Email could not be changed. It may already be in use." };
  await recordSecurityEvent(user.id, "email_change_requested", { newEmail: parsed.data });
  if (user.email) await sendSecurityEmail({ userId: user.id, email: user.email, title: "Email change requested", detail: `A request was made to change your sign-in email to ${parsed.data}. The change is not complete until verified.`, dedupeKey: `email:${user.id}:${Date.now()}` });
  return { success: true, message: "Check the new address for a confirmation link." };
}
