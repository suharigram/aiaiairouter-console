import "server-only";
import type { User } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/request-context";
import { sendSecurityEmail } from "@/lib/email/mailer";

export async function recordSecurityEvent(
  userId: string | null,
  type: string,
  metadata?: Prisma.InputJsonValue,
) {
  const context = await getRequestContext();
  await db.securityEvent.create({
    data: { userId, type, ipHash: context.ipHash, userAgent: context.userAgent, metadata },
  });
}

export async function recordLogin(user: User) {
  const context = await getRequestContext();
  let isNewDevice = false;
  const existing = await db.userDevice.findUnique({
    where: { userId_fingerprint: { userId: user.id, fingerprint: context.fingerprint } },
  });
  if (existing) {
    await db.userDevice.update({ where: { id: existing.id }, data: { lastSeenAt: new Date(), ipHash: context.ipHash } });
  } else {
    try {
      await db.userDevice.create({
        data: {
          userId: user.id,
          fingerprint: context.fingerprint,
          ipHash: context.ipHash,
          userAgent: context.userAgent,
        },
      });
      isNewDevice = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  await db.securityEvent.create({
    data: {
      userId: user.id,
      type: "login_succeeded",
      ipHash: context.ipHash,
      userAgent: context.userAgent,
      metadata: { newDevice: isNewDevice },
    },
  });
  if (isNewDevice && user.email) {
    await sendSecurityEmail({
      userId: user.id,
      email: user.email,
      title: "New device sign-in",
      detail: `Your account was accessed from a new browser or device. Time: ${new Date().toUTCString()}. User agent: ${context.userAgent}`,
      dedupeKey: `new-device:${user.id}:${context.fingerprint}`,
    });
  }
}
