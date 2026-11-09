import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const models = await db.model.findMany({
    where: { OR: [{ slug: { contains: query, mode: "insensitive" } }, { displayName: { contains: query, mode: "insensitive" } }, { provider: { name: { contains: query, mode: "insensitive" } } }] },
    include: { provider: true },
    orderBy: [{ provider: { slug: "asc" } }, { slug: "asc" }],
  });
  return <>
    <PageHeader title="Models" description="Explore model identifiers, context limits, and per-million-token prices. Availability requires a configured provider credential." />
    <form className="mb-5 flex max-w-lg gap-2" action="/dashboard/models"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" /><Input name="q" defaultValue={query} placeholder="Search models or providers" className="pl-9" /></div><Button variant="outline">Search</Button></form>
    {models.length ? <Card><Table><TableHeader><TableRow><TableHead>Model</TableHead><TableHead>Provider</TableHead><TableHead>Context</TableHead><TableHead>Input / 1M</TableHead><TableHead>Output / 1M</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{models.map((model) => <TableRow key={model.id}><TableCell><div className="font-medium">{model.displayName}</div><code className="mt-1 block text-xs text-stone-500">{model.slug}</code><p className="mt-2 max-w-sm text-xs leading-5 text-stone-500">{model.description}</p></TableCell><TableCell>{model.provider.name}</TableCell><TableCell>{model.contextLength.toLocaleString()}</TableCell><TableCell>${Number(model.inputMicrosPerMillion) / 1_000_000}</TableCell><TableCell>${Number(model.outputMicrosPerMillion) / 1_000_000}</TableCell><TableCell><Badge variant={model.isActive && model.provider.isEnabled ? "success" : "outline"}>{model.isActive && model.provider.isEnabled ? "Available" : "Not configured"}</Badge></TableCell></TableRow>)}</TableBody></Table></Card> : <EmptyState title="No models found" description="Clear the search or run the database seed to populate the model catalog." />}
  </>;
}
