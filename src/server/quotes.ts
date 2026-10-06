"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { asLocale } from "@/i18n/config";
import { RATE_LIMITS, QUOTE_INCLUSIONS, type QuoteInclusion } from "@/lib/constants";
import { QUOTE_LIMITS, QUOTE_TRANSFERS, OTHER_TREATMENT, isCatalogItem } from "@/lib/quote-catalog";
import { computeQuoteTotals, priceCeilingMinor } from "@/lib/quote-pricing";
import { getConverter } from "@/lib/exchange-rates";
import { toMinor } from "@/lib/money";

/** Keeps a submitted count inside a sane range instead of trusting the form. */
function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
import { sendNewQuoteEmail } from "./quote-notifications";
import { loadEditableTarget } from "./quote-target";

/**
 * The shape of one treatment line as the form sends it. Prices in major units,
 * the way the clinic typed them.
 */
export type QuoteItemInput = {
  category: string;
  treatment: string;
  variant?: string | null;
  customLabel?: string | null;
  quantity: number;
  unitPriceMajor: number;
};

/**
 * Records a clinic's quote.
 *
 * The price is built from treatment lines (quantity x unit price) minus an
 * optional package discount, and computed HERE with computeQuoteTotals — the
 * form shows the same number, but a total the browser sent is never trusted.
 * Prices arrive in major units (4000, not 400000) and are converted once,
 * against the currency of the clinic's own country: a quote is always
 * denominated where the treatment happens, and any conversion into the
 * patient's currency is display-only (see lib/money).
 *
 * amountMinor keeps holding the FINAL price, so sorting, "cheapest" and the
 * approval flow are untouched by the line items.
 */
export async function submitQuote(input: {
  token: string;
  items: QuoteItemInput[];
  discountMajor?: number | null;
  note?: string;
  includes?: string[];
  flightsIncluded?: boolean;
  flightTickets?: number | null;
  transfers?: string[];
  tripsRequired?: number;
  daysPerTrip?: number;
  weeksBetweenTrips?: number | null;
  accommodationNights?: number | null;
  sessionsRequired?: number;
  weeksBetweenSessions?: number | null;
  warrantyYears?: number | null;
  warrantyNote?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const rl = await rateLimit(
    `quote:${input.token}`,
    RATE_LIMITS.submitQuote.limit,
    RATE_LIMITS.submitQuote.windowMs,
  );
  if (!rl.allowed) {
    return { ok: false, error: e.tooManyAttempts };
  }

  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length === 0 || rawItems.length > QUOTE_LIMITS.maxItems) {
    return { ok: false, error: e.noLineItems };
  }
  // Only catalog combinations are stored, so the patient compares a Turkish
  // and a Hungarian crown on the same axis.
  const items = rawItems.map((i) => ({
    category: String(i?.category ?? ""),
    treatment: String(i?.treatment ?? ""),
    variant: i?.variant ? String(i.variant) : null,
    customLabel: i?.treatment === OTHER_TREATMENT ? String(i?.customLabel ?? "").trim() : null,
    quantity: Number(i?.quantity),
    unitPriceMajor: Number(i?.unitPriceMajor),
  }));
  if (!items.every(isCatalogItem)) return { ok: false, error: e.invalidLineItem };

  const target = await loadEditableTarget(input.token);
  if (!target.ok) {
    return {
      ok: false,
      error: target.error === "INVALID_LINK" ? e.invalidLink : e.quoteAlreadyDecided,
    };
  }
  const rd = target.rd;
  const currency = rd.dentist.country.currency;

  const discountMajor =
    input.discountMajor === null || input.discountMajor === undefined
      ? null
      : Number(input.discountMajor);
  const toCurrency = await getConverter(currency);
  const eurLimit = toCurrency(toMinor(QUOTE_LIMITS.maxPriceEUR, "EUR"), "EUR");
  const totals = computeQuoteTotals(
    items,
    discountMajor,
    currency,
    priceCeilingMinor(eurLimit?.minor ?? null),
  );
  if (!totals.ok) {
    return {
      ok: false,
      error:
        totals.error === "BAD_DISCOUNT"
          ? e.invalidDiscount
          : totals.error === "BAD_LINE"
            ? e.invalidLineItem
            : totals.error === "NO_LINES"
              ? e.noLineItems
              : e.invalidPrice,
    };
  }
  const amountMinor = totals.finalMinor;
  const discountMinor = totals.discountMinor > 0 ? totals.discountMinor : null;
  const itemRows = items.map((i, position) => ({
    position,
    category: i.category,
    treatment: i.treatment,
    variant: i.variant,
    customLabel: i.customLabel,
    quantity: i.quantity,
    unitPriceMinor: totals.lines[position].unitPriceMinor,
  }));

  const isNew = !rd.quote;
  const note = input.note?.trim() || null;

  // Only canonical inclusion keys are stored, so the patient compares clinics
  // on the same axis instead of reading two differently-worded notes.
  // AIRPORT_TRANSFER is legacy: transfers now have their own field.
  const includes = [
    ...new Set(
      (input.includes ?? []).filter(
        (k): k is QuoteInclusion =>
          (QUOTE_INCLUSIONS as readonly string[]).includes(k) && k !== "AIRPORT_TRANSFER",
      ),
    ),
  ];
  const transfers = [
    ...new Set(
      (input.transfers ?? []).filter((k) => (QUOTE_TRANSFERS as readonly string[]).includes(k)),
    ),
  ];
  // Always answered on a new-format quote; null is reserved for legacy rows.
  const flightsIncluded = input.flightsIncluded === true;
  const flightTickets = flightsIncluded
    ? clampInt(input.flightTickets, 1, 1, QUOTE_LIMITS.maxFlightTickets)
    : null;

  const tripsRequired = clampInt(input.tripsRequired, 1, 1, 10);
  const daysPerTrip = clampInt(input.daysPerTrip, 1, 1, 60);
  // Only meaningful with more than one trip; forced null otherwise so the two
  // fields can never contradict each other.
  const weeksBetweenTrips = tripsRequired > 1 ? clampInt(input.weeksBetweenTrips, 1, 1, 104) : null;
  // Only meaningful once the clinic has checked ACCOMMODATION itself; forced
  // null otherwise, same rule as weeksBetweenTrips above.
  const accommodationNights = includes.includes("ACCOMMODATION")
    ? clampInt(input.accommodationNights, 1, 1, 60)
    : null;
  // A treatment-visit count, independent of tripsRequired: a local patient
  // has sessions with zero trips, and a traveling patient's sessions don't
  // have to equal their trip count.
  const sessionsRequired = clampInt(input.sessionsRequired, 1, 1, 10);
  const weeksBetweenSessions =
    sessionsRequired > 1 ? clampInt(input.weeksBetweenSessions, 1, 1, 104) : null;
  const warrantyYears =
    input.warrantyYears == null ? null : clampInt(input.warrantyYears, 0, 0, 50);
  const warrantyNote = input.warrantyNote?.trim() || null;

  const fields = {
    amountMinor,
    currency,
    discountMinor,
    note,
    includes,
    flightsIncluded,
    flightTickets,
    transfers,
    tripsRequired,
    daysPerTrip,
    weeksBetweenTrips,
    accommodationNights,
    sessionsRequired,
    weeksBetweenSessions,
    warrantyYears,
    warrantyNote,
  };

  let quoteId: string;
  if (isNew) {
    // No race risk here: a duplicate create would hit the `@unique`
    // constraint on `requestDentistId` and fail cleanly, which is acceptable
    // — two concurrent first-submits from the same clinic link is not a
    // scenario the spec needs to protect against.
    const quote = await db.quote.create({
      data: { requestDentistId: rd.id, ...fields, items: { create: itemRows } },
      select: { id: true },
    });
    quoteId = quote.id;
  } else {
    quoteId = rd.quote!.id;
    // Conditional on the quote's own status, so a clinic's edit landing at
    // nearly the same instant as the patient's approval can't silently
    // overwrite the price on a quote that just got decided. The lines are
    // replaced in the same transaction, so a refused edit leaves them as they
    // were and the price always matches its lines.
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.quote.updateMany({
        where: { requestDentistId: rd.id, status: "PENDING_DECISION" },
        data: fields,
      });
      if (result.count === 0) return false;
      await tx.quoteItem.deleteMany({ where: { quoteId } });
      await tx.quoteItem.createMany({ data: itemRows.map((r) => ({ ...r, quoteId })) });
      return true;
    });
    if (!updated) {
      return { ok: false, error: e.quoteAlreadyDecided };
    }
  }

  // Notify the patient — unless their account was deleted (user set to null),
  // in which case there is no address to notify. On a send failure we leave
  // patientNotifiedAt null so the daily retry cron picks it up later.
  if (isNew && rd.request.user) {
    const sent = await sendNewQuoteEmail({
      to: rd.request.user.email,
      patientName: rd.request.user.fullName,
      requestId: rd.request.id,
      locale: asLocale(rd.request.user.locale),
    });
    if (sent) {
      await db.quote.update({
        where: { id: quoteId },
        data: { patientNotifiedAt: new Date() },
      });
    }
  }

  return { ok: true };
}
