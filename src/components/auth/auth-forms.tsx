"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, resendVerification, signIn, signInWithOAuth, signUp } from "@/app/auth/actions";
import { updatePassword } from "@/app/settings/actions";
import type { ActionState } from "@/lib/action-state";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

const initial: ActionState = {};

function StateMessage({ state }: { state: ActionState }) {
  return state.message ? <Alert variant={state.success ? "success" : "error"}>{state.message}</Alert> : null;
}

function OAuthButtons() {
  return <div className="grid grid-cols-2 gap-3"><form action={signInWithOAuth.bind(null, "google")}><SubmitButton variant="outline" className="w-full">Google</SubmitButton></form><form action={signInWithOAuth.bind(null, "github")}><SubmitButton variant="outline" className="w-full">GitHub</SubmitButton></form></div>;
}

export function SignInForm() {
  const [state, action] = useActionState(signIn, initial);
  return <div className="space-y-5"><OAuthButtons /><div className="flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200" />OR CONTINUE WITH EMAIL<span className="h-px flex-1 bg-stone-200" /></div><form action={action} className="space-y-4"><StateMessage state={state} /><div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div><div className="space-y-2"><div className="flex justify-between"><Label htmlFor="password">Password</Label><Link href="/forgot-password" className="text-xs text-teal-700 hover:underline">Forgot password?</Link></div><Input id="password" name="password" type="password" autoComplete="current-password" required /></div><SubmitButton className="w-full" variant="accent">Sign in</SubmitButton></form></div>;
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initial);
  return <div className="space-y-5"><OAuthButtons /><div className="flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200" />OR USE EMAIL<span className="h-px flex-1 bg-stone-200" /></div><form action={action} className="space-y-4"><StateMessage state={state} /><div className="space-y-2"><Label htmlFor="email">Work email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div><div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /><p className="text-xs text-stone-500">At least 10 characters.</p></div><SubmitButton className="w-full" variant="accent">Create account</SubmitButton></form></div>;
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  return <form action={action} className="space-y-4"><StateMessage state={state} /><div className="space-y-2"><Label htmlFor="email">Account email</Label><Input id="email" name="email" type="email" required /></div><SubmitButton className="w-full" variant="accent">Send reset link</SubmitButton></form>;
}

export function ResendVerificationForm() {
  const [state, action] = useActionState(resendVerification, initial);
  return <form action={action} className="space-y-4"><StateMessage state={state} /><div className="space-y-2"><Label htmlFor="email">Account email</Label><Input id="email" name="email" type="email" required /></div><SubmitButton className="w-full" variant="accent">Resend verification</SubmitButton></form>;
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initial);
  return <form action={action} className="space-y-4"><StateMessage state={state} /><div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></div><SubmitButton className="w-full" variant="accent">Update password</SubmitButton>{state.success && <Link href="/dashboard" className="block text-center text-sm text-teal-700 hover:underline">Continue to dashboard</Link>}</form>;
}
