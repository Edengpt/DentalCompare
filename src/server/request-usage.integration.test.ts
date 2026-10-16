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

  // The trial is a number of days from approval and nothing else (2026-10-16).
  // A clinic that gets more requests than the old threshold of 5 during its
  // trial must not be charged early.
  it("PayPlus: requests past the old trial threshold never charge during the trial", async () => {
    const dentistId = await seedTrialing({
      provider: "PAYPLUS",
      trialRequestCap: 1,
      recurringToken: "tok_1",
    });
    for (let i = 0; i < 6; i++) await recordVerifiedRequest(dentistId);
    expect(chargeByToken).not.toHaveBeenCalled();
    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
    expect(sub.status).toBe("TRIALING");
    expect(sub.verifiedRequestCount).toBe(6);
  });

  it("Stripe: requests past the old trial threshold never end the trial early", async () => {
    const dentistId = await seedTrialing({
      provider: "STRIPE",
      trialRequestCap: 1,
      stripeSubscriptionId: "sub_test123",
    });
    await recordVerifiedRequest(dentistId);
    await recordVerifiedRequest(dentistId);
    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
    expect(sub.status).toBe("TRIALING");
  });

  it("two concurrent calls both count", async () => {
    const dentistId = await seedTrialing({ provider: "PAYPLUS", trialRequestCap: 1 });
    await Promise.all([recordVerifiedRequest(dentistId), recordVerifiedRequest(dentistId)]);
    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
    expect(sub.verifiedRequestCount).toBe(2);
  });
});
