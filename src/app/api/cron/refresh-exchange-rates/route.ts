import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { patientCurrencyFor, ratesToFetch } from "@/lib/price-display";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily FX refresh.
 *
 * Its own cron rather than a step inside an existing one: a failed rate fetch
 * must never take down subscription renewal. Stale rates degrade a price label;
 * a missed renewal loses money.
 *
 * Rates are for DISPLAY only. A quote is always stored in the currency the
 * clinic named — converting at save time would commit the platform to a price
 * it doesn't control and can't honour once the rate moves.
 *
 * frankfurter.app is keyless and ECB-sourced. It does not cover every currency;
 * a currency it omits is logged and skipped rather than failing the whole run,
 * because one unsupported market must not blank out conversion for the rest.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const active = await db.country.findMany({
    where: { isActive: true },
    select: { currency: true },
  });
  // Patients live anywhere, so their currencies are fetched too, or a patient
  // in Brazil would compare in dollars for want of a real rate.
  const patientCountries = await db.user.findMany({
    where: { countryCode: { not: null } },
    distinct: ["countryCode"],
    select: { countryCode: true },
  });

  // Clinic currencies, patient currencies and the fallback (USD), against EUR.
  const { base, quotes } = ratesToFetch([
    ...active.map((c) => c.currency),
    ...patientCountries.map((u) => patientCurrencyFor(u.countryCode)),
  ]);
  const url = `https://api.frankfurter.app/latest?base=${base}&symbols=${quotes.join(",")}`;

  let payload: { rates?: Record<string, number> };
  try {
    const res = await fetch(url);
    if (!res.ok) {
      logEvent("error", "exchange_rates.fetch_failed", { status: res.status, base });
      return NextResponse.json({ ok: false, status: res.status }, { status: 502 });
    }
    payload = await res.json();
  } catch (err) {
    logEvent("error", "exchange_rates.fetch_threw", { err: String(err), base });
    return NextResponse.json({ ok: false, error: "fetch failed" }, { status: 502 });
  }

  const rates = payload.rates ?? {};
  const missing = quotes.filter((q) => !(q in rates));
  if (missing.length) {
    logEvent("warn", "exchange_rates.unsupported_currencies", { base, missing });
  }

  const fetchedAt = new Date();
  for (const [quote, rate] of Object.entries(rates)) {
    await db.exchangeRate.upsert({
      where: { base_quote: { base, quote } },
      update: { rate, fetchedAt },
      create: { base, quote, rate, fetchedAt },
    });
  }

  return NextResponse.json({
    ok: true,
    base,
    updated: Object.keys(rates).length,
    missing,
  });
}
