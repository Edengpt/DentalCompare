import "server-only";
import { db } from "./db";
import { convert } from "./money";
import { findRate, type StoredRate } from "./exchange";

/**
 * The slice of the Prisma client this needs.
 *
 * Structural rather than the concrete client so a transaction client satisfies
 * it too — the only way a test can own the rate table without disturbing the
 * rows the daily cron writes.
 */
export type RatesClient = Pick<typeof db, "exchangeRate">;

/**
 * The stored rates, reduced to one function the UI can call.
 *
 * Built once per page load and handed down, so a comparison table never
 * reaches for the database while rendering — and can therefore be tested with
 * a plain function standing in for one.
 */
export type Converter = (minor: number, from: string) => { minor: number; fetchedAt: Date } | null;

/**
 * A converter into `toCurrency`.
 *
 * Returns null for an amount it cannot convert honestly — no route between the
 * currencies, or a rate too old to present as a price. Null means "show the
 * original and nothing else", which is the truthful rendering: the patient
 * still sees exactly what the clinic quoted.
 */
export async function getConverter(
  toCurrency: string,
  now: Date = new Date(),
  client: RatesClient = db,
) {
  const rows = await client.exchangeRate.findMany();

  // Decimal comes back from Prisma; findRate does arithmetic, so narrow here
  // rather than scattering conversions through the lookup.
  const rates: StoredRate[] = rows.map((r) => ({
    base: r.base,
    quote: r.quote,
    rate: Number(r.rate),
    fetchedAt: r.fetchedAt,
  }));

  const converter: Converter = (minor, from) => {
    const found = findRate(rates, from, toCurrency, now);
    if (!found) return null;
    return { minor: convert(minor, from, toCurrency, found.rate), fetchedAt: found.fetchedAt };
  };

  return converter;
}
