import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { KeyManager } from "@/components/dashboard/key-manager";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

export default async function ApiKeysPage() {
  const user = await requireUser();
  const keys = await db.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const rows = keys.map((key) => ({ ...key, createdAt: key.createdAt.toISOString(), lastUsedAt: key.lastUsedAt?.toISOString() ?? null, revokedAt: key.revokedAt?.toISOString() ?? null }));
  return <><PageHeader title="API Keys" description="Create revocable virtual keys for the unified API. Only a keyed hash is stored in the database." /><Card><KeyManager keys={rows} /></Card></>;
}
