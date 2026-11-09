import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { UsageChart } from "@/components/dashboard/usage-chart";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { daysAgo } from "@/lib/time";

export default async function OverviewPage() {
  const user = await requireUser();
  const since = daysAgo(30);
  const chartSince = daysAgo(13);
  chartSince.setUTCHours(0, 0, 0, 0);
  const [wallet, usage, requests, modelUsage, daily, recent] = await Promise.all([
    db.wallet.findUnique({ where: { userId: user.id } }),
    db.usageEvent.aggregate({ where: { userId: user.id, createdAt: { gte: since } }, _sum: { costMicros: true, totalTokens: true } }),
    db.requestLog.count({ where: { userId: user.id, createdAt: { gte: since } } }),
    db.usageEvent.groupBy({ by: ["modelId"], where: { userId: user.id, createdAt: { gte: since } }, _sum: { totalTokens: true, costMicros: true }, orderBy: { _sum: { costMicros: "desc" } }, take: 6 }),
    db.$queryRaw<Array<{ label: Date; value: bigint }>>`SELECT DATE("created_at") AS label, SUM("cost_micros")::bigint AS value FROM "usage_events" WHERE "user_id" = ${user.id}::uuid AND "created_at" >= ${chartSince} GROUP BY DATE("created_at") ORDER BY label`,
    db.requestLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const models = await db.model.findMany({ where: { id: { in: modelUsage.map((item) => item.modelId) } }, select: { id: true, slug: true } });
  const dailyMap = new Map(daily.map((item) => [new Date(item.label).toISOString().slice(0, 10), Number(item.value)]));
  const chart = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(chartSince.getTime() + index * 86400000);
    const key = date.toISOString().slice(0, 10);
    return { label: key.slice(5), value: dailyMap.get(key) ?? 0 };
  });
  return <>
    <PageHeader title="Overview" description="Account balance and gateway activity for the last 30 days."><Link href="/dashboard/keys" className={buttonVariants({ variant: "accent" })}>Create API key</Link></PageHeader>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Available balance" value={formatMoney(wallet?.balanceMicros ?? 0n)} detail="Credits available for inference" /><StatCard label="Spend" value={formatMoney(usage._sum.costMicros ?? 0n)} detail="Last 30 days" /><StatCard label="Requests" value={formatNumber(requests)} detail="Last 30 days" /><StatCard label="Tokens" value={formatNumber(usage._sum.totalTokens ?? 0)} detail="Input and output, last 30 days" /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-3"><Card className="xl:col-span-2"><CardHeader><CardTitle>Daily spend</CardTitle></CardHeader><CardContent><UsageChart data={chart} /></CardContent></Card><Card><CardHeader><CardTitle>Tokens by model</CardTitle></CardHeader><CardContent>{modelUsage.length ? <div className="space-y-4">{modelUsage.map((item) => <div key={item.modelId} className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-mono text-xs">{models.find((model) => model.id === item.modelId)?.slug ?? "Unknown"}</span><span className="shrink-0 text-stone-600">{formatNumber(item._sum.totalTokens ?? 0)}</span></div>)}</div> : <p className="text-sm text-stone-500">No model usage yet.</p>}</CardContent></Card></div>
    <Card className="mt-6"><CardHeader className="flex-row items-center justify-between"><CardTitle>Recent requests</CardTitle><Link href="/dashboard/usage" className="text-sm text-teal-700 hover:underline">View usage</Link></CardHeader><CardContent className="px-0 pb-0">{recent.length ? <Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Model</TableHead><TableHead>Status</TableHead><TableHead>Latency</TableHead><TableHead>Mode</TableHead></TableRow></TableHeader><TableBody>{recent.map((item) => <TableRow key={item.requestId}><TableCell className="whitespace-nowrap text-stone-500">{formatDate(item.createdAt)}</TableCell><TableCell className="font-mono text-xs">{item.modelSlug}</TableCell><TableCell><Badge variant={item.statusCode < 400 ? "success" : item.statusCode === 102 ? "warning" : "danger"}>{item.statusCode === 102 ? "processing" : item.statusCode}</Badge></TableCell><TableCell>{item.latencyMs} ms</TableCell><TableCell>{item.streamed ? "Stream" : "Standard"}</TableCell></TableRow>)}</TableBody></Table> : <div className="px-6 pb-6"><EmptyState title="No requests yet" description="Create an API key and make a request to /v1/chat/completions. Request content is never stored here." /></div>}</CardContent></Card>
  </>;
}
