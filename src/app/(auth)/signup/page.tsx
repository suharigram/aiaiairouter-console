import Link from "next/link";
import { SignUpForm } from "@/components/auth/auth-forms";

export default function SignUpPage() {
  return <><div className="mb-6"><h1 className="text-xl font-semibold">Create your account</h1><p className="mt-2 text-sm text-stone-500">One API key for your Chinese AI model workloads.</p></div><SignUpForm /><p className="mt-6 text-center text-sm text-stone-500">Already have an account? <Link className="text-teal-700 hover:underline" href="/login">Sign in</Link></p></>;
}
