"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, CreditCard, KeyRound, LayoutDashboard, ReceiptText, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/keys", label: "API Keys", icon: KeyRound },
  { href: "/dashboard/models", label: "Models", icon: Boxes },
  { href: "/dashboard/usage", label: "Usage", icon: BarChart3 },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/dashboard/settings", label: "Settings / Profile", icon: Settings },
  { href: "/dashboard/security", label: "Security / Activity", icon: ShieldCheck },
];

export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav className="space-y-1">{items.map(({ href, label, icon: Icon }) => {
    const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
    return <Link key={href} href={href} onClick={onNavigate} className={cn("flex items-center gap-3 rounded-sm border px-3 py-2.5 text-xs transition-colors", active ? "border-teal-700 bg-teal-700 font-medium text-black" : "border-transparent text-stone-500 hover:border-stone-200 hover:bg-stone-100 hover:text-stone-950")}><Icon className="h-4 w-4" />{label}</Link>;
  })}</nav>;
}
