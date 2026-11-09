import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { daysAgo } from "@/lib/time";

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const { range: rawRange } = await searchParams;
  const days = [7, 30, 90].includes(Number(rawRange)) ? Number(rawRange) : 30;
  const since = daysAgo(days);
  const [totals, modelUsage, events] = await Promise.all([
    db.usageEvent.aggregate({ where: { userId: user.id, createdAt: { gte: since } }, _sum: { costMicros: true, promptTokens: true, completionTokens: true, cachedTokens: true }, _count: true }),
    db.usageEvent.groupBy({ by: ["modelId"], where: { userId: user.id, createdAt: { gte: since } }, _sum: { promptTokens: true, completionTokens: true, costMicros: true }, orderBy: { _sum: { costMicros: "desc" } } }),
    db.usageEvent.findMany({ where: { userId: user.id, createdAt: { gte: since } }, include: { model: { select: { slug: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const models = await db.model.findMany({ where: { id: { in: modelUsage.map((item) => item.modelId) } }, select: { id: true, slug: true } });
  return <>
    <PageHeader title="Usage" description="Token consumption and settled charges. Estimated usage is explicitly marked."><div className="flex rounded-md border bg-stone-100 p-1">{[7, 30, 90].map((value) => <Link key={value} href={`/dashboard/usage?range=${value}`} className={cn("rounded px-3 py-1.5 text-sm", days === value ? "bg-stone-900 text-black" : "text-stone-600 hover:bg-stone-100")}>{value}d</Link>)}</div></PageHeader>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total cost" value={formatMoney(totals._sum.costMicros ?? 0n)} detail={`Last ${days} days`} /><StatCard label="Input tokens" value={formatNumber(totals._sum.promptTokens ?? 0)} detail={`${formatNumber(totals._sum.cachedTokens ?? 0)} cached`} /><StatCard label="Output tokens" value={formatNumber(totals._sum.completionTokens ?? 0)} detail={`Last ${days} days`} /><StatCard label="Metered requests" value={formatNumber(totals._count)} detail="Completed, aborted, and failed" /></div>
    <Card className="mt-6 overflow-hidden"><div className="border-b px-6 py-4"><h2 className="font-medium">Model breakdown</h2></div>{modelUsage.length ? <Table><TableHeader><TableRow><TableHead>Model</TableHead><TableHead>Input</TableHead><TableHead>Output</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader><TableBody>{modelUsage.map((item) => <TableRow key={item.modelId}><TableCell className="font-mono text-xs">{models.find((model) => model.id === item.modelId)?.slug}</TableCell><TableCell>{formatNumber(item._sum.promptTokens ?? 0)}</TableCell><TableCell>{formatNumber(item._sum.completionTokens ?? 0)}</TableCell><TableCell>{formatMoney(item._sum.costMicros ?? 0n)}</TableCell></TableRow>)}</TableBody></Table> : <p className="p-6 text-sm text-stone-500">No usage in this period.</p>}</Card>
    <Card className="mt-6 overflow-hidden"><div className="border-b px-6 py-4"><h2 className="font-medium">Recent usage events</h2></div>{events.length ? <Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Model</TableHead><TableHead>Tokens</TableHead><TableHead>Cost</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{events.map((event) => <TableRow key={event.id}><TableCell className="whitespace-nowrap text-stone-500">{formatDate(event.createdAt)}</TableCell><TableCell className="font-mono text-xs">{event.model.slug}</TableCell><TableCell>{formatNumber(event.totalTokens)} <span className="text-xs text-stone-400">({event.promptTokens} in / {event.completionTokens} out)</span></TableCell><TableCell>{formatMoney(event.costMicros)}</TableCell><TableCell><Badge variant={event.usageSource === "provider" ? "outline" : "warning"}>{event.usageSource}</Badge></TableCell><TableCell>{event.status.toLowerCase()}</TableCell></TableRow>)}</TableBody></Table> : <div className="p-6"><EmptyState title="No usage in this period" description="Try a wider date range or make a gateway request." /></div>}</Card>
  </>;
}
