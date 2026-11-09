import Link from "next/link";
import { SignInForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/alert";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  return <><div className="mb-6"><h1 className="text-xl font-semibold">Welcome back</h1><p className="mt-2 text-sm text-stone-500">Sign in to your developer console.</p></div>{message && <div className="mb-5"><Alert>{message}</Alert></div>}<SignInForm /><div className="mt-6 space-y-2 text-center text-sm text-stone-500"><p>New to AiAiAiRouter? <Link className="text-teal-700 hover:underline" href="/signup">Create an account</Link></p><p><Link className="text-xs hover:text-stone-800" href="/verify-email">Resend verification email</Link></p></div></>;
}
