import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;

describe.skipIf(!hasDb)("ClinicSubscription.provider", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, 60_000);

  it("defaults an existing-shape row to PAYPLUS and accepts an explicit STRIPE row", async () => {
    const sfx = randomUUID().slice(0, 8);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `prov_${sfx}@example.com`,
        phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
        city: "Tel Aviv",
        address: "1 Main St",
        experienceYears: 5,
      },
    });
    const sub = await db.clinicSubscription.create({
      data: {
        dentistId: dentist.id,
        plan: "MONTHLY",
        priceMinor: 7900,
        currency: "USD",
        trialDays: 60,
        provider: "STRIPE",
        stripeCustomerId: "cus_test123",
        stripeSubscriptionId: `sub_test_${sfx}`,
        setupToken: randomUUID(),
      },
    });
    expect(sub.provider).toBe("STRIPE");
    expect(sub.stripeCustomerId).toBe("cus_test123");

    await db.subscriptionCharge.create({
      data: {
        subscriptionId: sub.id,
        amountMinor: 7900,
        currency: "USD",
        status: "PAID",
        stripeInvoiceId: `in_test_${sfx}`,
        periodStart: new Date(),
        periodEnd: new Date(),
        paidAt: new Date(),
      },
    });

    await db.dentist.delete({ where: { id: dentist.id } });
  });
});
