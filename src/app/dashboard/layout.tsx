import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { signOut } from "@/app/auth/actions";
import { DashboardNav } from "@/components/dashboard/nav";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
  return <div className="min-h-screen bg-[#0e0e0e]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-200 bg-[#121212] lg:flex">
      <div className="flex h-[72px] flex-col justify-center border-b border-stone-200 px-5"><Logo href="/dashboard" /><span className="mt-1 pl-[38px] text-[9px] uppercase tracking-[0.2em] text-stone-400">Developer console</span></div>
      <div className="flex-1 overflow-y-auto px-3 py-5"><p className="mb-3 px-3 text-[10px] uppercase tracking-[0.18em] text-stone-400">Workspace</p><DashboardNav /></div>
      <div className="border-t border-stone-200 p-4">
        <div className="border border-stone-200 bg-stone-100 p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">Available balance</p><p className="mt-2 font-mono text-lg font-medium text-teal-700">{formatMoney(wallet?.balanceMicros ?? 0n)}</p></div>
        <p className="mt-4 truncate text-xs text-stone-500">{user.email}</p>
        <form action={signOut} className="mt-2"><Button variant="ghost" size="sm" className="w-full justify-start px-0"><LogOut className="h-4 w-4" />Sign out</Button></form>
      </div>
    </aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-stone-200 bg-[#121212]/95 px-4 backdrop-blur lg:hidden"><Logo href="/dashboard" /><form action={signOut}><Button variant="ghost" size="sm"><LogOut className="h-4 w-4" /><span className="sr-only">Sign out</span></Button></form></header>
      <details className="border-b border-stone-200 bg-[#121212] px-4 py-3 lg:hidden"><summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-stone-500">Console navigation</summary><div className="pt-3"><DashboardNav /></div></details>
      <main className="console-grid min-h-screen"><div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div></main>
    </div>
  </div>;
}
