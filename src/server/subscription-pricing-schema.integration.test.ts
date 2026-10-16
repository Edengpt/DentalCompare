import { describe, it, expect, beforeAll } from "vitest";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;

describe.skipIf(!hasDb)("SubscriptionPricing seed rows", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, 60_000);

  // The 2026-10-16 prices: Basic and Pro sold monthly or yearly, a year
  // costing ten months, and a 30-day trial on every row.
  it.each([
    ["PAYPLUS", "BASIC", "ILS", 29900, 10],
    ["PAYPLUS", "PRO", "ILS", 44900, 30],
    ["STRIPE", "BASIC", "USD", 7900, 10],
    ["STRIPE", "PRO", "USD", 17900, 30],
  ] as const)(
    "seeds %s/%s at its agreed price, a year at ten months",
    async (provider, tier, currency, monthly, cap) => {
      const row = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider, tier } },
      });
      expect(row.currency).toBe(currency);
      expect(row.monthlyPriceMinor).toBe(monthly);
      expect(row.yearlyPriceMinor).toBe(monthly * 10);
      expect(row.trialDays).toBe(30);
      expect(row.monthlyRequestCap).toBe(cap);
    },
  );

  it("locks every FREE row's price to 0 in both currencies", async () => {
    const rows = await db.subscriptionPricing.findMany({ where: { tier: "FREE" } });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.monthlyPriceMinor).toBe(0);
      expect(row.yearlyPriceMinor).toBe(0);
    }
  });

  it("seeds all eight (provider, tier) combinations", async () => {
    const rows = await db.subscriptionPricing.findMany();
    expect(rows).toHaveLength(8);
    const pairs = new Set(rows.map((r) => `${r.provider}:${r.tier}`));
    expect(pairs.size).toBe(8);
  });

  it("leaves FEATURED with no monthly request cap (unlimited)", async () => {
    const rows = await db.subscriptionPricing.findMany({ where: { tier: "FEATURED" } });
    for (const row of rows) {
      expect(row.monthlyRequestCap).toBeNull();
    }
  });
});
