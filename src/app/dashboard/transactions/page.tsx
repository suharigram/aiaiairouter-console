import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function TransactionsPage() {
  const user = await requireUser();
  const transactions = await db.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200 });
  return <><PageHeader title="Transactions" description="Immutable ledger of credit purchases, model charges, refunds, disputes, and adjustments." />{transactions.length ? <Card><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Amount</TableHead><TableHead>Balance after</TableHead></TableRow></TableHeader><TableBody>{transactions.map((transaction) => <TableRow key={transaction.id}><TableCell className="whitespace-nowrap text-stone-500">{formatDate(transaction.createdAt)}</TableCell><TableCell>{transaction.description}</TableCell><TableCell className="text-xs">{transaction.type}</TableCell><TableCell><Badge variant={transaction.status === "COMPLETED" ? "success" : transaction.status === "PENDING" ? "warning" : transaction.status === "FAILED" || transaction.status === "EXPIRED" ? "danger" : "outline"}>{transaction.status.toLowerCase()}</Badge></TableCell><TableCell className={transaction.amountMicros < 0n ? "text-stone-900" : "text-teal-800"}>{transaction.amountMicros > 0n ? "+" : ""}{formatMoney(transaction.amountMicros)}</TableCell><TableCell>{transaction.balanceAfterMicros === null ? "—" : formatMoney(transaction.balanceAfterMicros)}</TableCell></TableRow>)}</TableBody></Table></Card> : <EmptyState title="No transactions" description="Credit purchases and usage charges will appear here." />}</>;
}
