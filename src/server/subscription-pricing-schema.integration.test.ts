import { describe, it, expect, beforeAll } from "vitest";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;

describe.skipIf(!hasDb)("SubscriptionPricing seed rows", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, 60_000);

  it("seeds PAYPLUS with today's live values, unchanged", async () => {
    const row = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "PAYPLUS" } });
    expect(row.currency).toBe("ILS");
    expect(row.monthlyPriceMinor).toBe(29900);
    expect(row.yearlyPriceMinor).toBe(199000);
    expect(row.trialDays).toBe(60);
  });

  it("seeds STRIPE with the agreed default, ready but unused", async () => {
    const row = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "STRIPE" } });
    expect(row.currency).toBe("USD");
    expect(row.monthlyPriceMinor).toBe(7900);
    expect(row.yearlyPriceMinor).toBe(53000);
    expect(row.trialDays).toBe(60);
  });
});
