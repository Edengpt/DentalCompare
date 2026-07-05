import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanType } from "@/lib/constants";
import { nextPeriodEnd } from "@/lib/subscription";

export async function createPendingSubscription(
  args: {
    dentistId: string;
    plan: SubscriptionPlanType;
    setupToken: string;
  },
  client: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  await client.clinicSubscription.create({
    data: {
      dentistId: args.dentistId,
      plan: args.plan,
      priceILS: SUBSCRIPTION_PLANS[args.plan].priceILS,
      setupToken: args.setupToken,
      status: "PENDING",
    },
  });
}

/**
 * Idempotently activates a subscription after its first paid charge: stores the
 * recurring token, opens the first paid period, and records a PAID charge. Safe
 * to call from both the webhook and the return page.
 */
export async function activateSubscriptionBySetupToken(args: {
  setupToken: string;
  transactionUid: string;
  recurringToken?: string;
  customerUid?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken: args.setupToken },
    select: { id: true, plan: true, priceILS: true, status: true },
  });
  if (!sub) return { ok: false, error: "מנוי לא נמצא" };

  // Idempotency: if we've already recorded this transaction, do nothing.
  const existing = await db.subscriptionCharge.findUnique({
    where: { payplusTransactionUid: args.transactionUid },
    select: { id: true },
  });
  if (existing) return { ok: true };

  const now = new Date();
  const periodEnd = nextPeriodEnd(now, sub.plan as SubscriptionPlanType);

  await db.$transaction([
    db.clinicSubscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        recurringToken: args.recurringToken ?? undefined,
        payplusCustomerUid: args.customerUid ?? undefined,
        currentPeriodEnd: periodEnd,
        lastChargeAt: now,
      },
    }),
    db.subscriptionCharge.create({
      data: {
        subscriptionId: sub.id,
        amountILS: sub.priceILS,
        status: "PAID",
        payplusTransactionUid: args.transactionUid,
        periodStart: now,
        periodEnd,
        paidAt: now,
      },
    }),
  ]);
  return { ok: true };
}

export async function recordRenewalCharge(args: {
  subscriptionId: string;
  transactionUid: string;
  amountILS: number;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  const now = new Date();
  await db.$transaction([
    db.clinicSubscription.update({
      where: { id: args.subscriptionId },
      data: { status: "ACTIVE", currentPeriodEnd: args.periodEnd, lastChargeAt: now },
    }),
    db.subscriptionCharge.create({
      data: {
        subscriptionId: args.subscriptionId,
        amountILS: args.amountILS,
        status: "PAID",
        payplusTransactionUid: args.transactionUid,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        paidAt: now,
      },
    }),
  ]);
}

export async function markPastDue(subscriptionId: string): Promise<void> {
  await db.clinicSubscription.update({
    where: { id: subscriptionId },
    data: { status: "PAST_DUE" },
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await db.clinicSubscription.update({
    where: { id: subscriptionId },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
}
