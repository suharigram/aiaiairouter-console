import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export default async function SecurityPage() {
  const user = await requireUser();
  const [events, devices] = await Promise.all([
    db.securityEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.userDevice.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: "desc" } }),
  ]);
  return <>
    <PageHeader title="Security / Activity" description="Sign-ins, account changes, key operations, and payment audit events. IP addresses are stored only as keyed hashes." />
    <Card className="mb-6"><div className="border-b px-6 py-4"><h2 className="font-medium">Recognized devices</h2></div>{devices.length ? <Table><TableHeader><TableRow><TableHead>Browser / device</TableHead><TableHead>First seen</TableHead><TableHead>Last active</TableHead></TableRow></TableHeader><TableBody>{devices.map((device) => <TableRow key={device.id}><TableCell className="max-w-md truncate text-xs" title={device.userAgent}>{device.userAgent}</TableCell><TableCell>{formatDate(device.firstSeenAt)}</TableCell><TableCell>{formatDate(device.lastSeenAt)}</TableCell></TableRow>)}</TableBody></Table> : <p className="p-6 text-sm text-stone-500">Devices appear after a successful sign-in.</p>}</Card>
    {events.length ? <Card><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Event</TableHead><TableHead>User agent</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{events.map((event) => <TableRow key={event.id}><TableCell className="whitespace-nowrap text-stone-500">{formatDate(event.createdAt)}</TableCell><TableCell><Badge variant={event.type.includes("failed") ? "danger" : "outline"}>{event.type.replaceAll("_", " ")}</Badge></TableCell><TableCell className="max-w-xs truncate text-xs text-stone-500" title={event.userAgent ?? undefined}>{event.userAgent ?? "System / webhook"}</TableCell><TableCell className="max-w-xs truncate font-mono text-xs text-stone-500">{event.metadata ? JSON.stringify(event.metadata) : "—"}</TableCell></TableRow>)}</TableBody></Table></Card> : <EmptyState title="No security activity" description="Authentication and account events will be recorded here." />}
  </>;
}
