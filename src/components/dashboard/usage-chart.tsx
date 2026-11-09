import { formatMoney } from "@/lib/utils";

export function UsageChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  if (!data.length) return <div className="flex h-48 items-center justify-center text-sm text-stone-500">Usage will appear after your first request.</div>;
  return <div><div className="flex h-48 items-end gap-1.5">{data.map((item) => <div key={item.label} className="group relative flex h-full flex-1 items-end"><div className="w-full rounded-t-sm bg-teal-700/80 transition-colors group-hover:bg-teal-600" style={{ height: `${Math.max(2, (item.value / max) * 100)}%` }} /><div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-stone-900 px-2 py-1 text-xs text-black group-hover:block">{item.label}: {formatMoney(item.value)}</div></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-stone-400"><span>{data[0]?.label}</span><span>{data.at(-1)?.label}</span></div></div>;
}
