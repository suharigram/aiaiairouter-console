import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email/mailer";
import { recordLogin, recordSecurityEvent } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
  if (!code) return NextResponse.redirect(new URL("/login?message=Missing authentication code.", url.origin));

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?message=The authentication link is invalid or expired.", url.origin));
    await ensureProfile(data.user);
    if (next !== "/reset-password") {
      await recordLogin(data.user);
      if (data.user.email) await sendWelcomeEmail(data.user.id, data.user.email);
    } else {
      await recordSecurityEvent(data.user.id, "password_recovery_verified");
    }
    return NextResponse.redirect(new URL(next, url.origin));
  } catch {
    return NextResponse.redirect(new URL("/login?message=Authentication is temporarily unavailable.", url.origin));
  }
}
