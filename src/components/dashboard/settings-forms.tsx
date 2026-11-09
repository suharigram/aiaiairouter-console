"use client";
import { useActionState } from "react";
import { updateEmail, updatePassword, updateProfile } from "@/app/settings/actions";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Message({ state }: { state: ActionState }) { return state.message ? <Alert variant={state.success ? "success" : "error"}>{state.message}</Alert> : null; }

export function SettingsForms({ name, email }: { name: string; email: string }) {
  const [profileState, profileAction] = useActionState(updateProfile, {});
  const [emailState, emailAction] = useActionState(updateEmail, {});
  const [passwordState, passwordAction] = useActionState(updatePassword, {});
  return <div className="grid max-w-4xl gap-6">
    <Card><CardHeader><CardTitle>Profile</CardTitle><CardDescription>Your display name and primary sign-in email.</CardDescription></CardHeader><CardContent><form action={profileAction} className="space-y-4"><Message state={profileState} /><div className="space-y-2"><Label htmlFor="name">Display name</Label><Input id="name" name="name" defaultValue={name} maxLength={80} /></div><div className="space-y-2"><Label>Current email</Label><Input value={email} disabled /></div><SubmitButton>Save profile</SubmitButton></form></CardContent></Card>
    <Card><CardHeader><CardTitle>Change email</CardTitle><CardDescription>A confirmation link is sent to the new address. A security notice is sent to the current address.</CardDescription></CardHeader><CardContent><form action={emailAction} className="space-y-4"><Message state={emailState} /><div className="space-y-2"><Label htmlFor="new-email">New email</Label><Input id="new-email" name="email" type="email" required /></div><SubmitButton variant="outline">Request email change</SubmitButton></form></CardContent></Card>
    <Card><CardHeader><CardTitle>Change password</CardTitle><CardDescription>Changing your password signs out all other sessions.</CardDescription></CardHeader><CardContent><form action={passwordAction} className="space-y-4"><Message state={passwordState} /><div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={10} required /></div><SubmitButton variant="outline">Update password</SubmitButton></form></CardContent></Card>
  </div>;
}
