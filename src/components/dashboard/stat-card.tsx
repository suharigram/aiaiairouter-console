import { Card } from "@/components/ui/card";

export function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card className="relative p-5"><span className="absolute right-4 top-4 h-1.5 w-1.5 bg-teal-700" /><p className="text-[10px] uppercase tracking-[0.12em] text-stone-500">{label}</p><p className="mt-4 font-mono text-2xl font-medium tracking-[-0.06em] text-stone-950">{value}</p><p className="mt-3 text-[10px] text-stone-400">{detail}</p></Card>;
}
