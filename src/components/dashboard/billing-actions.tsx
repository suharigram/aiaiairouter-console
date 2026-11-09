"use client";
import { useState, useTransition } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { createCheckoutSession, createCustomerPortalSession } from "@/app/billing/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const packages = [{ tier: "small", name: "Starter", amount: "$10", text: "For evaluation and small projects." }, { tier: "medium", name: "Build", amount: "$25", text: "For regular development workloads." }, { tier: "large", name: "Scale", amount: "$100", text: "For sustained production traffic." }];

export function BillingActions({ hasCustomer }: { hasCustomer: boolean }) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState("");
  const [error, setError] = useState("");
  function run(name: string, action: () => Promise<void>) {
    setError(""); setActive(name);
    startTransition(async () => { try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "The payment action failed."); setActive(""); } });
  }
  return <div>{error && <Alert variant="error" className="mb-5">{error}</Alert>}<div className="grid gap-4 md:grid-cols-3">{packages.map((item) => <Card key={item.tier}><CardHeader><CardTitle>{item.name}</CardTitle><p className="font-mono text-3xl font-semibold">{item.amount}</p></CardHeader><CardContent><p className="mb-5 min-h-10 text-sm leading-6 text-stone-500">{item.text}</p><Button variant="accent" className="w-full" disabled={pending} onClick={() => run(item.tier, () => createCheckoutSession(item.tier))}><CreditCard className="h-4 w-4" />{active === item.tier && pending ? "Opening Checkout…" : "Add credits"}</Button></CardContent></Card>)}</div><div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-lg border bg-stone-100 p-5 sm:flex-row sm:items-center"><div><h2 className="font-medium">Payment methods</h2><p className="mt-1 text-sm text-stone-500">Manage cards and billing details in Stripe’s secure customer portal.</p></div><Button variant="outline" disabled={!hasCustomer || pending} onClick={() => run("portal", createCustomerPortalSession)}>{hasCustomer ? "Open customer portal" : "Portal available after first purchase"}<ExternalLink className="h-4 w-4" /></Button></div></div>;
}
