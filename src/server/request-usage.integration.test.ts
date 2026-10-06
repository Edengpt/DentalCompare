import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { recordVerifiedRequest as RecordFn } from "@/server/request-usage";

const chargeByToken = vi.fn();
const isPayPlusConfigured = vi.fn(() => true);
vi.mock("@/lib/payplus", async (orig) => {
  const actual = (await orig()) as object;
  return { ...actual, chargeByToken, isPayPlusConfigured };
});

const endStripeTrialNow = vi.fn(async () => {});
vi.mock("@/lib/stripe", async (orig) => {
  const actual = (await orig()) as object;
  return { ...actual, endStripeTrialNow };
});

vi.mock("@/server/subscription-notifications", () => ({
  sendPaymentFailedEmail: vi.fn(async () => true),
  sendTrialUnbilledAdminEmail: vi.fn(async () => true),
}));

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let recordVerifiedRequest: typeof RecordFn;
const created = { dentistIds: [] as string[] };

describe.skipIf(!hasDb)("recordVerifiedRequest", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ recordVerifiedRequest } = await import("@/server/request-usage"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
    chargeByToken.mockReset();
    isPayPlusConfigured.mockReset().mockReturnValue(true);
    endStripeTrialNow.mockClear();
  }, DB_TIMEOUT);

  async function seedTrialing(args: {
    provider: "PAYPLUS" | "STRIPE";
    trialRequestCap: number;
    stripeSubscriptionId?: string;
    recurringToken?: string;
  }): Promise<string> {
    const sfx = randomUUID().slice(0, 8);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `usage_${sfx}@example.com`,
        phone: `+9725${Math.floor(Math.random() * 1e8)
          .toString()
          .padStart(8, "0")}`,
        city: "Tel Aviv",
        address: "1 Main St",
        experienceYears: 5,
      },
    });
    created.dentistIds.push(dentist.id);
    await db.clinicSubscription.create({
      data: {
        dentistId: dentist.id,
        plan: "MONTHLY",
        priceMinor: 29900,
        currency: "ILS",
        trialDays: 60,
        trialRequestCap: args.trialRequestCap,
        setupToken: randomUUID(),
        status: "TRIALING",
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        provider: args.provider,
        stripeSubscriptionId: args.stripeSubscriptionId,
        recurringToken: args.recurringToken,
      },
    });
    return dentist.id;
  }

  it("increments verifiedRequestCount by 1 per call", async () => {
    const dentistId = await seedTrialing({ provider: "PAYPLUS", trialRequestCap: 5 });
    await recordVerifiedRequest(dentistId);
    await recordVerifiedRequest(dentistId);
    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
    expect(sub.verifiedRequestCount).toBe(2);
  });

  it("creates a MonthlyRequestUsage row on first call, increments on later calls", async () => {
    const dentistId = await seedTrialing({ provider: "PAYPLUS", trialRequestCap: 5 });
    const yearMonth = new Date().toISOString().slice(0, 7);
    await recordVerifiedRequest(dentistId);
    let usage = await db.monthlyRequestUsage.findUniqueOrThrow({
      where: { dentistId_yearMonth: { dentistId, yearMonth } },
    });
    expect(usage.count).toBe(1);
    await recordVerifiedRequest(dentistId);
    usage = await db.monthlyRequestUsage.findUniqueOrThrow({
      where: { dentistId_yearMonth: { dentistId, yearMonth } },
    });
    expect(usage.count).toBe(2);
  });

  it("does not attempt conversion below the threshold", async () => {
    const dentistId = await seedTrialing({
      provider: "PAYPLUS",
      trialRequestCap: 3,
      recurringToken: "tok_1",
    });
    await recordVerifiedRequest(dentistId);
    await recordVerifiedRequest(dentistId);
    expect(chargeByToken).not.toHaveBeenCalled();
  });

  it("PayPlus: crossing the threshold charges immediately and marks ACTIVE", async () => {
    chargeByToken.mockResolvedValue({
      ok: true,
      transactionUid: `txn_${randomUUID().slice(0, 8)}`,
    });
    const dentistId = await seedTrialing({
      provider: "PAYPLUS",
      trialRequestCap: 2,
      recurringToken: "tok_1",
    });
    await recordVerifiedRequest(dentistId);
    expect(chargeByToken).not.toHaveBeenCalled();
    await recordVerifiedRequest(dentistId);
    expect(chargeByToken).toHaveBeenCalledTimes(1);
    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
    expect(sub.status).toBe("ACTIVE");
  });

  it("PayPlus: a request beyond the threshold does not charge a second time", async () => {
    chargeByToken.mockResolvedValue({
      ok: true,
      transactionUid: `txn_${randomUUID().slice(0, 8)}`,
    });
    const dentistId = await seedTrialing({
      provider: "PAYPLUS",
      trialRequestCap: 1,
      recurringToken: "tok_1",
    });
    await recordVerifiedRequest(dentistId);
    expect(chargeByToken).toHaveBeenCalledTimes(1);
    await recordVerifiedRequest(dentistId);
    expect(chargeByToken).toHaveBeenCalledTimes(1);
  });

  it("Stripe: crossing the threshold ends the trial early via the Stripe API", async () => {
    const dentistId = await seedTrialing({
      provider: "STRIPE",
      trialRequestCap: 1,
      stripeSubscriptionId: "sub_test123",
    });
    await recordVerifiedRequest(dentistId);
    expect(endStripeTrialNow).toHaveBeenCalledWith("sub_test123");
    expect(chargeByToken).not.toHaveBeenCalled();
  });

  it("Stripe: crossing the threshold with no stripeSubscriptionId yet does nothing (not an error)", async () => {
    const dentistId = await seedTrialing({ provider: "STRIPE", trialRequestCap: 1 });
    await expect(recordVerifiedRequest(dentistId)).resolves.toBeUndefined();
    expect(endStripeTrialNow).not.toHaveBeenCalled();
  });

  it("PayPlus: a declined immediate charge leaves the clinic retryable, not stuck", async () => {
    chargeByToken.mockResolvedValue({ ok: false, error: "declined" });
    const dentistId = await seedTrialing({
      provider: "PAYPLUS",
      trialRequestCap: 1,
      recurringToken: "tok_1",
    });
    const before = new Date();
    await recordVerifiedRequest(dentistId);
    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
    expect(sub.status).toBe("PAST_DUE");
    expect(sub.currentPeriodEnd).not.toBeNull();
    expect(sub.currentPeriodEnd!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  it("PayPlus: two concurrent calls at the threshold charge exactly once, not twice", async () => {
    chargeByToken.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ ok: true, transactionUid: `txn_${randomUUID().slice(0, 8)}` }),
            20,
          ),
        ),
    );
    const dentistId = await seedTrialing({
      provider: "PAYPLUS",
      trialRequestCap: 1,
      recurringToken: "tok_1",
    });
    // Two "different requests to the same clinic, fulfilled around the same
    // moment" — the exact scenario that raced before this fix.
    await Promise.all([recordVerifiedRequest(dentistId), recordVerifiedRequest(dentistId)]);
    expect(chargeByToken).toHaveBeenCalledTimes(1);
    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
    expect(sub.verifiedRequestCount).toBe(2);
    expect(sub.status).toBe("ACTIVE");
  });
});
