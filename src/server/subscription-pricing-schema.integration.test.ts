import { describe, it, expect, beforeAll } from "vitest";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;

describe.skipIf(!hasDb)("SubscriptionPricing seed rows", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, 60_000);

  it("seeds PAYPLUS/BASIC with today's live values, unchanged", async () => {
    const row = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
    });
    expect(row.currency).toBe("ILS");
    expect(row.monthlyPriceMinor).toBe(29900);
    expect(row.yearlyPriceMinor).toBe(199000);
    expect(row.trialDays).toBe(60);
    expect(row.monthlyRequestCap).toBe(10);
  });

  it("seeds STRIPE/BASIC with the agreed default, ready but unused", async () => {
    const row = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "STRIPE", tier: "BASIC" } },
    });
    expect(row.currency).toBe("USD");
    expect(row.monthlyPriceMinor).toBe(7900);
    expect(row.yearlyPriceMinor).toBe(53000);
    expect(row.trialDays).toBe(60);
  });

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
