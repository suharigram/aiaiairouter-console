import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ href = "/login", className }: { href?: string; className?: string }) {
  return <Link href={href} className={cn("inline-flex items-center gap-2.5 font-mono text-sm font-semibold tracking-[-0.04em] text-stone-950", className)}>
    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-[2px] bg-teal-700">
      <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-black" strokeWidth="2"><path d="M4 5h12M4 10h8M4 15h12" /><circle cx="15" cy="10" r="1.5" className="fill-black" /></svg>
    </span>
    <span>AiAiAiRouter</span>
  </Link>;
}
