import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BillingActions } from "@/components/dashboard/billing-actions";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; cancelled?: string }> }) {
  const user = await requireUser();
  const [{ success, cancelled }, wallet, profile] = await Promise.all([searchParams, db.wallet.findUnique({ where: { userId: user.id } }), db.profile.findUniqueOrThrow({ where: { id: user.id } })]);
  return <>
    <PageHeader title="Billing" description="Add prepaid credits through Stripe Checkout. Card details never pass through AiAiAiRouter servers."><Link href="/dashboard/transactions" className={buttonVariants({ variant: "outline" })}>Transaction history</Link></PageHeader>
    {success && <Alert variant="success" className="mb-5">Checkout completed. Credits appear after the signed Stripe webhook confirms payment.</Alert>}
    {cancelled && <Alert className="mb-5">Checkout was cancelled. No credits were added.</Alert>}
    <Card className="mb-8 p-6"><p className="text-sm text-stone-500">Available balance</p><p className="mt-2 font-mono text-3xl font-semibold">{formatMoney(wallet?.balanceMicros ?? 0n)}</p><p className="mt-2 text-xs text-stone-500">1 credit unit equals 1 USD of model usage. Final charges follow catalog pricing.</p></Card>
    <h2 className="mb-4 text-lg font-semibold">Add credits</h2><BillingActions hasCustomer={Boolean(profile.stripeCustomerId)} />
  </>;
}
