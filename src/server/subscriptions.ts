import { legacyMajor } from "@/lib/money";
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
      priceMinor: SUBSCRIPTION_PLANS[args.plan].priceMinor,
      currency: SUBSCRIPTION_PLANS[args.plan].currency,
      // Legacy mirror, unread. Dropped in M4.
      priceILS: legacyMajor(
        SUBSCRIPTION_PLANS[args.plan].priceMinor,
        SUBSCRIPTION_PLANS[args.plan].currency,
      ),
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
    select: {
      id: true,
      plan: true,
      priceMinor: true,
      currency: true,
      status: true,
      recurringToken: true,
    },
  });
  if (!sub) return { ok: false, error: "מנוי לא נמצא" };

  // Backfill the stored-card token if a later caller carries it and we activated
  // earlier without it — e.g. the return page (getPageRequestStatus) activates
  // first with only a transactionUid, then the IPN arrives with the token. Without
  // this, the renewal cron would never see a recurringToken and never renew.
  if (args.recurringToken && !sub.recurringToken) {
    await db.clinicSubscription.update({
      where: { id: sub.id },
      data: {
        recurringToken: args.recurringToken,
        payplusCustomerUid: args.customerUid ?? undefined,
      },
    });
  }

  // Idempotency: if we've already recorded this transaction, activation is done.
  const existing = await db.subscriptionCharge.findUnique({
    where: { payplusTransactionUid: args.transactionUid },
    select: { id: true },
  });
  if (existing) return { ok: true };

  // Refuse to record a charge for an amount we can't read — a 0 here would
  // mark the period paid while collecting nothing.
  if (sub.priceMinor === null || sub.currency === null) {
    console.error("activateSubscription: subscription has no price", { subscriptionId: sub.id });
    return { ok: false, error: "תקלה בהגדרת המנוי. פנו לתמיכה." };
  }
  const priceMinor = sub.priceMinor;
  const currency = sub.currency;

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
        amountMinor: priceMinor,
        currency,
        // Legacy mirror, unread. Dropped in M4.
        amountILS: legacyMajor(priceMinor, currency),
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
  amountMinor: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  const now = new Date();
  await db.$transaction([
    db.clinicSubscription.update({
      where: { id: args.subscriptionId },
      data: {
        status: "ACTIVE",
        currentPeriodEnd: args.periodEnd,
        lastChargeAt: now,
        // A successful charge resets the failure-notification gate so a future
        // failure notifies again.
        paymentFailedNotifiedAt: null,
      },
    }),
    db.subscriptionCharge.create({
      data: {
        subscriptionId: args.subscriptionId,
        amountMinor: args.amountMinor,
        currency: args.currency,
        // Legacy mirror, unread. Dropped in M4.
        amountILS: legacyMajor(args.amountMinor, args.currency),
        status: "PAID",
        payplusTransactionUid: args.transactionUid,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        paidAt: now,
      },
    }),
  ]);
}

/**
 * Marks a subscription PAST_DUE. Returns true only the FIRST time (stamping
 * paymentFailedNotifiedAt) so the caller sends the "charge failed" email once,
 * not on every daily retry within the grace window.
 */
export async function markPastDue(subscriptionId: string): Promise<boolean> {
  const firstTime = await db.clinicSubscription.updateMany({
    where: { id: subscriptionId, paymentFailedNotifiedAt: null },
    data: { status: "PAST_DUE", paymentFailedNotifiedAt: new Date() },
  });
  if (firstTime.count === 1) return true;
  // Already notified — just ensure the status is PAST_DUE.
  await db.clinicSubscription.update({
    where: { id: subscriptionId },
    data: { status: "PAST_DUE" },
  });
  return false;
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await db.clinicSubscription.update({
    where: { id: subscriptionId },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
}
