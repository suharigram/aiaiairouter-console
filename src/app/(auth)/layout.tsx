import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="console-grid flex min-h-screen flex-col bg-[#0e0e0e]">
    <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-[#121212] px-5 sm:px-8">
      <Logo href="/login" />
      <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Console / Access</span>
    </header>
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-stone-500"><span className="h-2 w-2 bg-teal-700" />Developer authentication</div>
        <div className="border border-stone-200 bg-[#141414] shadow-[0_20px_70px_#00000066]">
          <div className="h-1 bg-teal-700" />
          <div className="p-6 sm:p-8">{children}</div>
        </div>
        <p className="mt-5 text-center text-[10px] uppercase tracking-[0.16em] text-stone-400">AiAiAiRouter by GonidonCloud</p>
      </div>
    </main>
  </div>;
}
