import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const { currentClinic } = vi.hoisted(() => ({
  currentClinic: { value: null as null | { id: string; email: string } },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/server/clinic-account", () => ({
  getClinicForCurrentUser: async () => currentClinic.value,
}));

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;

let db: typeof Db;
let upgradeToPaid: typeof import("./clinic-upgrade").upgradeToPaid;
const created: string[] = [];

async function seedClinic(tier: "FREE" | "BASIC", status: "ACTIVE" | "PENDING" = "ACTIVE") {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Up ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `up_${sfx}@example.com`,
      phone: "0500000000",
      city: "חיפה",
      address: "רחוב 2",
      experienceYears: 3,
      specialties: [],
      treatments: [],
      insurerAffiliations: [],
      subscription: {
        create: {
          plan: "MONTHLY",
          priceMinor: tier === "FREE" ? 0 : 29900,
          currency: "ILS",
          trialDays: 60,
          setupToken: `stk_${sfx}`,
          status,
          tier,
          monthlyRequestCap: tier === "FREE" ? 3 : 10,
          verifiedRequestCount: 3,
        },
      },
    },
  });
  created.push(dentist.id);
  return dentist;
}

describe.skipIf(!hasDb)("upgradeToPaid (integration, real DB)", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ upgradeToPaid } = await import("./clinic-upgrade"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created) {
      await db.auditLog.deleteMany({ where: { actor: { startsWith: "up_" } } }).catch(() => {});
      await db.dentist.delete({ where: { id } }).catch(() => {});
    }
    created.length = 0;
    currentClinic.value = null;
  }, DB_TIMEOUT);

  it(
    "moves a free clinic onto the paid tier and returns its payment link",
    async () => {
      const dentist = await seedClinic("FREE");
      currentClinic.value = { id: dentist.id, email: dentist.email };
      const basic = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
      });

      const result = await upgradeToPaid("BASIC", "YEARLY");
      expect(result).toEqual({ ok: true, setupToken: expect.any(String) });

      const sub = await db.clinicSubscription.findUniqueOrThrow({
        where: { dentistId: dentist.id },
      });
      expect(sub.tier).toBe("BASIC");
      expect(sub.plan).toBe("YEARLY");
      expect(sub.status).toBe("TRIALING");
      expect(sub.monthlyRequestCap).toBe(basic.monthlyRequestCap);
      expect(sub.isFounding ? sub.regularPriceMinor : sub.priceMinor).toBe(basic.yearlyPriceMinor);
      expect(sub.trialEndsAt).not.toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    "moves a free clinic onto Pro at the Pro price and cap",
    async () => {
      const dentist = await seedClinic("FREE");
      currentClinic.value = { id: dentist.id, email: dentist.email };
      const pro = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider: "PAYPLUS", tier: "PRO" } },
      });

      expect((await upgradeToPaid("PRO", "MONTHLY")).ok).toBe(true);

      const sub = await db.clinicSubscription.findUniqueOrThrow({
        where: { dentistId: dentist.id },
      });
      expect(sub.tier).toBe("PRO");
      expect(sub.monthlyRequestCap).toBe(pro.monthlyRequestCap);
      expect(sub.isFounding ? sub.regularPriceMinor : sub.priceMinor).toBe(pro.monthlyPriceMinor);
    },
    DB_TIMEOUT,
  );

  it(
    "refuses Featured, which is not sold",
    async () => {
      const dentist = await seedClinic("FREE");
      currentClinic.value = { id: dentist.id, email: dentist.email };
      const result = await upgradeToPaid("FEATURED" as "PRO", "MONTHLY");
      expect(result.ok).toBe(false);
    },
    DB_TIMEOUT,
  );

  it(
    "refuses a clinic that is already paying, or still in review",
    async () => {
      const paid = await seedClinic("BASIC");
      currentClinic.value = { id: paid.id, email: paid.email };
      expect((await upgradeToPaid("BASIC", "MONTHLY")).ok).toBe(false);

      const pending = await seedClinic("FREE", "PENDING");
      currentClinic.value = { id: pending.id, email: pending.email };
      expect((await upgradeToPaid("BASIC", "MONTHLY")).ok).toBe(false);
    },
    DB_TIMEOUT,
  );

  it(
    "refuses a visitor who is not a clinic",
    async () => {
      expect((await upgradeToPaid("BASIC", "MONTHLY")).ok).toBe(false);
    },
    DB_TIMEOUT,
  );
});
