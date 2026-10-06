import { describe, it, expect, beforeAll } from "vitest";
import type { db as Db } from "@/lib/db";
import type { getConverter as GetConverterFn } from "@/lib/exchange-rates";

const hasDb = Boolean(process.env.DATABASE_URL);

// Imported lazily (only when a DB is configured) so the suite stays safe — and
// db.ts doesn't throw at import time — in environments without DATABASE_URL.
let db: typeof Db;
let getConverter: typeof GetConverterFn;

const ROLLBACK = Symbol("rollback");

/**
 * Runs a scenario against a rate table it fully owns, then throws it away.
 *
 * getConverter reads every stored rate, so leaving the real rows in place would
 * make the assertions depend on whatever the daily cron last wrote. Inside the
 * transaction the table starts empty and nothing survives the rollback.
 */
async function withRates<T>(
  rows: Array<{ base: string; quote: string; rate: number; fetchedAt: Date }>,
  scenario: (tx: typeof Db) => Promise<T>,
) {
  let result!: T;
  try {
    await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`DELETE FROM "ExchangeRate"`);
        for (const r of rows) await tx.exchangeRate.create({ data: r });
        result = await scenario(tx as unknown as typeof Db);
        throw ROLLBACK;
      },
      { timeout: 30_000 },
    );
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
  return result;
}

describe.skipIf(!hasDb)("getConverter", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ getConverter } = await import("@/lib/exchange-rates"));
  });

  const fetchedAt = new Date("2026-08-23T04:00:00Z");
  const now = new Date("2026-08-23T10:00:00Z");
  const rows = [
    { base: "EUR", quote: "ILS", rate: 4, fetchedAt },
    { base: "EUR", quote: "TRY", rate: 40, fetchedAt },
  ];

  // getConverter runs its own query, so it must see the transaction's rows.
  // These assertions therefore run inside the same transaction.
  it("converts a quote into the patient's currency", async () => {
    const result = await withRates(rows, async (tx) => {
      const convertTo = await getConverter("ILS", now, tx);
      // €100.00 at 4 ILS per EUR.
      return convertTo(10_000, "EUR");
    });

    expect(result?.minor).toBe(40_000);
    expect(result?.fetchedAt).toEqual(fetchedAt);
  });

  // The route the stored shape actually forces: neither side is the base.
  it("converts between two non-base currencies", async () => {
    const result = await withRates(rows, async (tx) => {
      const convertTo = await getConverter("TRY", now, tx);
      // ₪100.00 → €25.00 → ₺1,000.00
      return convertTo(10_000, "ILS");
    });

    expect(result?.minor).toBe(100_000);
  });

  it("leaves an amount alone when it is already in the target currency", async () => {
    const result = await withRates([], async (tx) => {
      const convertTo = await getConverter("ILS", now, tx);
      return convertTo(19_200_00, "ILS");
    });

    expect(result?.minor).toBe(19_200_00);
  });

  // Null means "show the original and nothing else" — which is still truthful.
  it("returns null when there is no route", async () => {
    const result = await withRates(rows, async (tx) => {
      const convertTo = await getConverter("JPY", now, tx);
      return convertTo(10_000, "ILS");
    });

    expect(result).toBeNull();
  });

  it("returns null when the only rate is too old to quote", async () => {
    const stale = [{ base: "EUR", quote: "ILS", rate: 4, fetchedAt: new Date("2026-08-01") }];
    const result = await withRates(stale, async (tx) => {
      const convertTo = await getConverter("ILS", now, tx);
      return convertTo(10_000, "EUR");
    });

    expect(result).toBeNull();
  });
});
