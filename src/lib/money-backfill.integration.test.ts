import { describe, it, expect } from "vitest";
import { db } from "./db";

/**
 * Guards the M2 money backfill against the database itself.
 *
 * A wrong multiplier here is a 100x error on a live customer charge, so this
 * asserts the invariant directly rather than trusting that the migration ran
 * correctly. It also keeps failing usefully during M3: any code path that
 * writes an ILS column without its minor-unit twin shows up here.
 *
 * These assertions retire with M4, when the ILS columns are dropped.
 */
describe("money backfill (integration, real DB)", () => {
  it("leaves no subscription without its minor-unit twin", async () => {
    const orphans = await db.clinicSubscription.findMany({
      where: { OR: [{ priceMinor: null }, { currency: null }] },
      select: { id: true },
    });
    expect(orphans).toEqual([]);
  });

  it("leaves no charge without its minor-unit twin", async () => {
    const orphans = await db.subscriptionCharge.findMany({
      where: { OR: [{ amountMinor: null }, { currency: null }] },
      select: { id: true },
    });
    expect(orphans).toEqual([]);
  });

  it("leaves no quote without its minor-unit twin", async () => {
    const orphans = await db.quote.findMany({
      where: { OR: [{ amountMinor: null }, { currency: null }] },
      select: { id: true },
    });
    expect(orphans).toEqual([]);
  });

  it("keeps every minor amount exactly 100x its shekel column", async () => {
    const [subs, charges, quotes] = await Promise.all([
      db.clinicSubscription.findMany({
        select: { id: true, priceILS: true, priceMinor: true, currency: true },
      }),
      db.subscriptionCharge.findMany({
        select: { id: true, amountILS: true, amountMinor: true, currency: true },
      }),
      db.quote.findMany({
        select: { id: true, amountILS: true, amountMinor: true, currency: true },
      }),
    ]);

    for (const s of subs) {
      expect({ id: s.id, minor: s.priceMinor, currency: s.currency }).toEqual({
        id: s.id,
        minor: s.priceILS * 100,
        currency: "ILS",
      });
    }
    for (const row of [...charges, ...quotes]) {
      expect({ id: row.id, minor: row.amountMinor, currency: row.currency }).toEqual({
        id: row.id,
        minor: row.amountILS * 100,
        currency: "ILS",
      });
    }
  });
});
