import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type {
  syncStripeSubscription as SyncFn,
  recordStripeCharge as RecordChargeFn,
} from "@/server/subscriptions";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let syncStripeSubscription: typeof SyncFn;
let recordStripeCharge: typeof RecordChargeFn;
const created = { dentistIds: [] as string[] };

async function seedStripePendingSubscription() {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `strp_${sfx}@example.com`,
      phone: `+3620${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, "0")}`,
      city: "Budapest",
      address: "1 Main St",
      experienceYears: 5,
    },
  });
  created.dentistIds.push(dentist.id);
  const setupToken = randomUUID();
  const sub = await db.clinicSubscription.create({
    data: {
      dentistId: dentist.id,
      plan: "MONTHLY",
      priceMinor: 7900,
      currency: "USD",
      trialDays: 60,
      provider: "STRIPE",
      setupToken,
      status: "PENDING",
    },
  });
  return { dentist, sub, setupToken };
}

describe.skipIf(!hasDb)("syncStripeSubscription / recordStripeCharge", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ syncStripeSubscription, recordStripeCharge } = await import("@/server/subscriptions"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
  }, DB_TIMEOUT);

  it("links stripeSubscriptionId/stripeCustomerId and sets TRIALING by setupToken on first sync", async () => {
    const { sub, setupToken } = await seedStripePendingSubscription();
    const trialEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const result = await syncStripeSubscription({
      stripeSubscriptionId: `sub_${setupToken}`,
      stripeCustomerId: `cus_${setupToken}`,
      status: "trialing",
      currentPeriodEnd: null,
      trialEndsAt,
      setupToken,
    });

    expect(result.ok).toBe(true);
    const row = await db.clinicSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.status).toBe("TRIALING");
    expect(row.stripeSubscriptionId).toBe(`sub_${setupToken}`);
    expect(row.stripeCustomerId).toBe(`cus_${setupToken}`);
    expect(row.trialEndsAt?.getTime()).toBe(trialEndsAt.getTime());
  });

  it("finds the row by stripeSubscriptionId on later syncs, without a setupToken", async () => {
    const { sub, setupToken } = await seedStripePendingSubscription();
    await syncStripeSubscription({
      stripeSubscriptionId: `sub_${setupToken}`,
      stripeCustomerId: `cus_${setupToken}`,
      status: "trialing",
      currentPeriodEnd: null,
      trialEndsAt: new Date(),
      setupToken,
    });

    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const result = await syncStripeSubscription({
      stripeSubscriptionId: `sub_${setupToken}`,
      stripeCustomerId: `cus_${setupToken}`,
      status: "active",
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
    });

    expect(result.ok).toBe(true);
    const row = await db.clinicSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.status).toBe("ACTIVE");
    expect(row.currentPeriodEnd?.getTime()).toBe(periodEnd.getTime());
  });

  // Out-of-order-webhook regression (I4/3b): omitting currentPeriodEnd/trialEndsAt
  // entirely must leave the row's existing values untouched, not null them out.
  // This is what lets checkout.session.completed sync safely even if
  // customer.subscription.updated (which carries the real values) already ran.
  it("omitting currentPeriodEnd/trialEndsAt on a later sync leaves the existing values untouched", async () => {
    const { sub, setupToken } = await seedStripePendingSubscription();
    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const trialEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    await syncStripeSubscription({
      stripeSubscriptionId: `sub_${setupToken}`,
      stripeCustomerId: `cus_${setupToken}`,
      status: "trialing",
      currentPeriodEnd,
      trialEndsAt,
      setupToken,
    });

    const result = await syncStripeSubscription({
      stripeSubscriptionId: `sub_${setupToken}`,
      stripeCustomerId: `cus_${setupToken}`,
      status: "trialing",
      // currentPeriodEnd/trialEndsAt intentionally omitted.
    });

    expect(result.ok).toBe(true);
    const row = await db.clinicSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.currentPeriodEnd?.getTime()).toBe(currentPeriodEnd.getTime());
    expect(row.trialEndsAt?.getTime()).toBe(trialEndsAt.getTime());
  });

  it("returns ok:false when neither stripeSubscriptionId nor setupToken matches a row", async () => {
    const result = await syncStripeSubscription({
      stripeSubscriptionId: "sub_does_not_exist",
      stripeCustomerId: "cus_x",
      status: "active",
      currentPeriodEnd: null,
      trialEndsAt: null,
    });
    expect(result.ok).toBe(false);
  });

  it("recordStripeCharge inserts a PAID charge and is idempotent on stripeInvoiceId", async () => {
    const { sub } = await seedStripePendingSubscription();
    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await recordStripeCharge({
      subscriptionId: sub.id,
      stripeInvoiceId: "in_test_1",
      amountMinor: 7900,
      currency: "USD",
      periodStart,
      periodEnd,
    });
    // Second call with the same invoice id must not create a duplicate row.
    await recordStripeCharge({
      subscriptionId: sub.id,
      stripeInvoiceId: "in_test_1",
      amountMinor: 7900,
      currency: "USD",
      periodStart,
      periodEnd,
    });

    const charges = await db.subscriptionCharge.findMany({ where: { subscriptionId: sub.id } });
    expect(charges).toHaveLength(1);
    expect(charges[0].status).toBe("PAID");
  });
});
