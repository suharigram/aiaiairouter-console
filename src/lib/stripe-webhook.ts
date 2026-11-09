import "server-only";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

function paidMicros(amountCents: number) {
  return BigInt(amountCents) * 10_000n;
}

export async function processStripeEvent(event: Stripe.Event) {
  try {
    await db.$transaction(async (tx) => {
      await tx.webhookEvent.create({ data: { provider: "stripe", eventId: event.id, type: event.type } });
      try {
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const session = event.data.object;
        if (session.payment_status !== "paid") return;
        const metadataTransactionId = z.string().uuid().safeParse(session.metadata?.transaction_id);
        const transaction = await tx.transaction.findUnique({ where: { stripeCheckoutSessionId: session.id } })
          ?? (metadataTransactionId.success ? await tx.transaction.findUnique({ where: { id: metadataTransactionId.data } }) : null);
        if (!transaction || !["PENDING", "FAILED"].includes(transaction.status)) return;
        if (session.metadata?.transaction_id !== transaction.id || session.client_reference_id !== transaction.userId) {
          throw new Error("Stripe session metadata does not match the pending transaction.");
        }
        if (session.amount_total !== transaction.amountCents || session.currency !== transaction.currency) {
          throw new Error("Stripe payment amount does not match the pending transaction.");
        }
        const wallet = await tx.wallet.upsert({
          where: { userId: transaction.userId },
          update: { balanceMicros: { increment: transaction.amountMicros } },
          create: { userId: transaction.userId, balanceMicros: transaction.amountMicros },
        });
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "COMPLETED",
            stripeCheckoutSessionId: session.id,
            balanceAfterMicros: wallet.balanceMicros,
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
            externalRef: `stripe:${event.id}`,
          },
        });
        await tx.securityEvent.create({ data: { userId: transaction.userId, type: "payment_succeeded", metadata: { transactionId: transaction.id } } });
      } else if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
        const session = event.data.object;
        const transaction = await tx.transaction.findUnique({ where: { stripeCheckoutSessionId: session.id } });
        if (transaction?.status === "PENDING") {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: event.type === "checkout.session.expired" ? "EXPIRED" : "FAILED" },
          });
          await tx.securityEvent.create({ data: { userId: transaction.userId, type: "payment_failed", metadata: { transactionId: transaction.id } } });
        }
      } else if (event.type === "charge.refunded") {
        const charge = event.data.object;
        const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (!paymentIntent || charge.amount_refunded <= 0) return;
        const original = await tx.transaction.findFirst({ where: { stripePaymentIntentId: paymentIntent, type: "CREDIT" } });
        if (!original) return;
        const previousRefunds = await tx.transaction.aggregate({ where: { stripePaymentIntentId: paymentIntent, type: "REFUND" }, _sum: { amountCents: true } });
        const refundedCents = Math.abs(previousRefunds._sum.amountCents ?? 0);
        const newRefundCents = charge.amount_refunded - refundedCents;
        if (newRefundCents <= 0) return;
        const amount = -paidMicros(newRefundCents);
        const wallet = await tx.wallet.update({ where: { userId: original.userId }, data: { balanceMicros: { increment: amount } } });
        await tx.transaction.create({ data: {
          userId: original.userId,
          type: "REFUND",
          status: "COMPLETED",
          amountMicros: amount,
          balanceAfterMicros: wallet.balanceMicros,
          amountCents: -newRefundCents,
          stripePaymentIntentId: paymentIntent,
          externalRef: `stripe:${event.id}`,
          description: "Stripe payment refund",
        } });
      } else if (event.type === "charge.dispute.created") {
        const dispute = event.data.object;
        const paymentIntent = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
        if (!paymentIntent) return;
        const original = await tx.transaction.findFirst({ where: { stripePaymentIntentId: paymentIntent, type: "CREDIT" } });
        if (!original) return;
        const amount = -paidMicros(dispute.amount);
        const wallet = await tx.wallet.update({ where: { userId: original.userId }, data: { balanceMicros: { increment: amount } } });
        await tx.transaction.create({ data: {
          userId: original.userId,
          type: "DISPUTE",
          status: "COMPLETED",
          amountMicros: amount,
          balanceAfterMicros: wallet.balanceMicros,
          amountCents: -dispute.amount,
          stripePaymentIntentId: paymentIntent,
          externalRef: `stripe:${event.id}`,
          description: "Stripe dispute hold",
        } });
        await tx.transaction.update({ where: { id: original.id }, data: { status: "DISPUTED" } });
      } else if (event.type === "charge.dispute.closed") {
        const dispute = event.data.object;
        if (dispute.status !== "won") return;
        const paymentIntent = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
        const original = paymentIntent ? await tx.transaction.findFirst({ where: { stripePaymentIntentId: paymentIntent, type: "CREDIT" } }) : null;
        if (!original) return;
        const amount = paidMicros(dispute.amount);
        const wallet = await tx.wallet.update({ where: { userId: original.userId }, data: { balanceMicros: { increment: amount } } });
        await tx.transaction.create({ data: {
          userId: original.userId,
          type: "ADJUSTMENT",
          status: "COMPLETED",
          amountMicros: amount,
          balanceAfterMicros: wallet.balanceMicros,
          amountCents: dispute.amount,
          stripePaymentIntentId: paymentIntent,
          externalRef: `stripe:${event.id}`,
          description: "Dispute won — funds restored",
        } });
        await tx.transaction.update({ where: { id: original.id }, data: { status: "COMPLETED" } });
      }
      } finally {
        await tx.webhookEvent.update({ where: { eventId: event.id }, data: { processedAt: new Date() } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { duplicate: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { duplicate: true };
    throw error;
  }
}
