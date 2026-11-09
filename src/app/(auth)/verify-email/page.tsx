import Link from "next/link";
import { ResendVerificationForm } from "@/components/auth/auth-forms";

export default function VerifyEmailPage() {
  return <><div className="mb-6"><h1 className="text-xl font-semibold">Verify your email</h1><p className="mt-2 text-sm leading-6 text-stone-500">Request a new verification link if the original expired or did not arrive.</p></div><ResendVerificationForm /><p className="mt-6 text-center text-sm"><Link className="text-teal-700 hover:underline" href="/login">Back to sign in</Link></p></>;
}
