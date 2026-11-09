import "server-only";
import { db } from "@/lib/db";
import { hashVirtualApiKey } from "@/lib/api-keys";

export async function authenticateVirtualKey(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const key = authorization.slice(7).trim();
  if (!key.startsWith("aiaiai_sk_") || key.length > 200) return null;
  const apiKey = await db.apiKey.findFirst({
    where: { keyHash: hashVirtualApiKey(key), revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: { user: { include: { wallet: true } } },
  });
  if (!apiKey) return null;
  await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
  return apiKey;
}
