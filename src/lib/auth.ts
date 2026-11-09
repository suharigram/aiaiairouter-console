import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function ensureProfile(user: User) {
  const email = user.email?.toLowerCase();
  if (!email) throw new Error("The account has no verified email address.");
  const profile = await db.profile.upsert({
    where: { id: user.id },
    update: { email },
    create: {
      id: user.id,
      email,
      name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
    },
  });
  await db.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  return profile;
}
