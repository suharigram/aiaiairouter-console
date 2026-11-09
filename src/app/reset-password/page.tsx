import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ResetPasswordPage() {
  await requireUser();
  return <main className="console-grid flex min-h-screen items-center justify-center px-4"><div className="w-full max-w-[420px]"><div className="mb-8 flex justify-center"><Logo /></div><div className="rounded-sm border border-stone-200 bg-[#141414] p-8"><h1 className="text-xl font-semibold">Choose a new password</h1><p className="mb-6 mt-2 text-xs leading-6 text-stone-500">Use at least 10 characters. Other sessions will be signed out.</p><ResetPasswordForm /></div></div></main>;
}
