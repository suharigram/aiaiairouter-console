"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateVirtualApiKey } from "@/lib/api-keys";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security";
import type { ActionState } from "@/lib/action-state";

export type KeyActionState = ActionState & { apiKey?: string };

export async function createApiKey(_state: KeyActionState, formData: FormData): Promise<KeyActionState> {
  const user = await requireUser();
  const parsed = z.object({ name: z.string().trim().min(1).max(60) }).safeParse({ name: formData.get("name") });
  if (!parsed.success) return { message: "Enter a key name between 1 and 60 characters." };
  const limit = await checkRateLimit(`keys:${user.id}`, 10, 60);
  if (!limit.success) return { message: "Too many keys created. Please wait a minute." };
  const generated = generateVirtualApiKey();
  await db.apiKey.create({ data: { userId: user.id, name: parsed.data.name, prefix: generated.prefix, keyHash: generated.hash } });
  await recordSecurityEvent(user.id, "api_key_created", { name: parsed.data.name });
  revalidatePath("/dashboard/keys");
  return { success: true, message: "Copy this key now. It will not be shown again.", apiKey: generated.key };
}

export async function revokeApiKey(keyId: string) {
  const user = await requireUser();
  const id = z.string().uuid().parse(keyId);
  const result = await db.apiKey.updateMany({ where: { id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (result.count !== 1) throw new Error("API key not found or already revoked.");
  await recordSecurityEvent(user.id, "api_key_revoked", { keyId: id });
  revalidatePath("/dashboard/keys");
}
