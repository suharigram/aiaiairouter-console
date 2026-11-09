import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv, supabaseIsConfigured } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isPrivate = request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname === "/reset-password";

  if (!supabaseIsConfigured()) {
    if (!isPrivate) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("message", "Authentication requires Supabase environment configuration.");
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(serverEnv.supabaseUrl!, serverEnv.supabaseAnonKey!, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user && isPrivate) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (data.user && ["/login", "/signup", "/forgot-password"].includes(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  } catch {
    if (isPrivate) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("message", "The authentication service is temporarily unavailable.");
      return NextResponse.redirect(url);
    }
  }
  return response;
}
