import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export default function ForgotPasswordPage() {
  return <><div className="mb-6"><h1 className="text-xl font-semibold">Reset your password</h1><p className="mt-2 text-sm leading-6 text-stone-500">We will send a time-limited recovery link if the account exists.</p></div><ForgotPasswordForm /><p className="mt-6 text-center text-sm"><Link className="text-teal-700 hover:underline" href="/login">Back to sign in</Link></p></>;
}
