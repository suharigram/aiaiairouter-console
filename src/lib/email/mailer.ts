import "server-only";
import { Resend } from "resend";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isConfigured, serverEnv } from "@/lib/env";
import { brandedEmail } from "@/lib/email/templates";

type EmailInput = { userId?: string; to: string; subject: string; title: string; body: string; dedupeKey?: string };

async function deliver(to: string, subject: string, html: string, text: string) {
  const from = serverEnv.emailFrom;
  if (!from) return { status: "skipped", providerId: null };
  if (serverEnv.emailProvider === "postmark" && isConfigured(serverEnv.postmarkToken)) {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": serverEnv.postmarkToken!,
      },
      body: JSON.stringify({
        From: from,
        To: to,
        ReplyTo: serverEnv.emailReplyTo,
        Subject: subject,
        HtmlBody: html,
        TextBody: text,
        MessageStream: "outbound",
      }),
    });
    const result = await response.json() as { MessageID?: string; Message?: string };
    if (!response.ok) throw new Error(result.Message || "Postmark rejected the message.");
    return { status: "sent", providerId: result.MessageID ?? null };
  }
  if (serverEnv.emailProvider === "resend" && isConfigured(serverEnv.resendApiKey)) {
    const resend = new Resend(serverEnv.resendApiKey);
    const result = await resend.emails.send({
      from,
      to,
      replyTo: serverEnv.emailReplyTo,
      subject,
      html,
      text,
    });
    if (result.error) throw new Error(result.error.message);
    return { status: "sent", providerId: result.data?.id ?? null };
  }
  return { status: "skipped", providerId: null };
}

async function send(input: EmailInput) {
  let logId: string | null = null;
  try {
    const log = await db.emailLog.create({
      data: {
        userId: input.userId,
        toEmail: input.to,
        template: input.title,
        status: "pending",
        dedupeKey: input.dedupeKey,
      },
    });
    logId = log.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }

  try {
    const content = brandedEmail(input);
    const result = await deliver(input.to, input.subject, content.html, content.text);
    await db.emailLog.update({ where: { id: logId! }, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Email delivery failed";
    await db.emailLog.update({ where: { id: logId! }, data: { status: "failed", error: message } });
  }
}

export async function sendWelcomeEmail(userId: string, email: string) {
  await send({
    userId,
    to: email,
    subject: "Welcome to AiAiAiRouter",
    title: "Account created",
    body: "Your AiAiAiRouter account is ready. Verify your email, add credits, and create an API key to make your first request.",
    dedupeKey: `account-created:${userId}`,
  });
}

export async function sendSecurityEmail({ userId, email, title, detail, dedupeKey }: { userId: string; email: string; title: string; detail: string; dedupeKey: string }) {
  await send({ userId, to: email, subject: `${title} — AiAiAiRouter`, title, body: `${detail} If you did not initiate this, reset your password and contact support.`, dedupeKey });
}
