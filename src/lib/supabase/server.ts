import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serverEnv, supabaseIsConfigured } from "@/lib/env";

export class AuthConfigurationError extends Error {
  constructor() {
    super("Authentication is not configured. Add the Supabase URL and anon key to the environment.");
  }
}

export async function createSupabaseServerClient() {
  if (!supabaseIsConfigured()) throw new AuthConfigurationError();
  const cookieStore = await cookies();
  return createServerClient(serverEnv.supabaseUrl!, serverEnv.supabaseAnonKey!, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; middleware refreshes sessions.
        }
      },
    },
  });
}

export function createSupabaseAdminClient() {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseServiceRoleKey) {
    throw new AuthConfigurationError();
  }
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
