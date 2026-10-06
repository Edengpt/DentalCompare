"use client";

import { useMemo, useState } from "react";
import { submitQuote } from "@/server/quotes";
import { QUOTE_FORM_INCLUSIONS } from "@/lib/quote-catalog";
import { translateInclusion } from "@/lib/labels";
import {
  formTotals,
  initialLines,
  initialTransfers,
  linesPayload,
  newLine,
  parseDiscount,
  type QuoteFormInitial,
  type QuoteFormLine,
} from "@/lib/quote-form-state";
import { useT } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Chip, fieldClass } from "./chip";
import { TreatmentPicker } from "./treatment-picker";
import { TreatmentLines } from "./treatment-lines";
import { PriceSummary } from "./price-summary";
import { TravelFields } from "./travel-fields";
import { QuoteAttachments } from "./quote-attachments";

export type { QuoteFormInitial };

/**
 * The clinic's quote builder: treatments picked by clicking, each with a
 * quantity and unit price; an optional package discount; what the price
 * covers; travel; trips, sessions, warranty; documents for the patient; and the
 * submit button last.
 *
 * Used by the emailed magic-link page and by the clinic area. The sections are
 * their own components; this file holds the state and the submit.
 */
export function QuoteForm({
  token,
  currencyLabel,
  initial,
  onSubmitted,
  attachmentTarget,
  canPreviewAttachments,
}: {
  token: string;
  /** Called once the quote is saved — the clinic area uses it to refresh its statuses in place. */
  onSubmitted?: () => void;
  /** The clinic's own currency (ISO 4217), so prices never claim to be shekels. */
  currencyLabel: string;
  initial: QuoteFormInitial;
  /** Where this clinic's documents go; the server re-checks it against the token. */
  attachmentTarget: { requestId: string; requestDentistId: string };
  /** False on the emailed-link page, where the clinic has no session to view with. */
  canPreviewAttachments: boolean;
}) {
  const t = useT();
  const currency = currencyLabel;
  const [lines, setLines] = useState<QuoteFormLine[]>(() => initialLines(initial.items));
  const [discount, setDiscount] = useState(initial.discount ? String(initial.discount) : "");
  const [note, setNote] = useState(initial.note ?? "");
  // ACCOMMODATION is asked in the travel section and AIRPORT_TRANSFER is
  // legacy, so the chips only hold the rest.
  const [includes, setIncludes] = useState<string[]>(() =>
    initial.includes.filter((k) => (QUOTE_FORM_INCLUSIONS as readonly string[]).includes(k)),
  );
  const [lodging, setLodging] = useState(initial.includes.includes("ACCOMMODATION"));
  const [accommodationNights, setAccommodationNights] = useState(
    initial.accommodationNights ? String(initial.accommodationNights) : "",
  );
  const [flightsIncluded, setFlightsIncluded] = useState<boolean | null>(initial.flightsIncluded);
  const [flightTickets, setFlightTickets] = useState(
    initial.flightTickets ? String(initial.flightTickets) : "1",
  );
  const [transfers, setTransfers] = useState<string[]>(() => initialTransfers(initial));
  const [trips, setTrips] = useState(String(initial.tripsRequired));
  const [daysPerTrip, setDaysPerTrip] = useState(String(initial.daysPerTrip));
  const [weeksBetween, setWeeksBetween] = useState(
    initial.weeksBetweenTrips ? String(initial.weeksBetweenTrips) : "",
  );
  const [sessions, setSessions] = useState(String(initial.sessionsRequired));
  const [weeksBetweenSessions, setWeeksBetweenSessions] = useState(
    initial.weeksBetweenSessions ? String(initial.weeksBetweenSessions) : "",
  );
  const [warrantyYears, setWarrantyYears] = useState(
    initial.warrantyYears === null ? "" : String(initial.warrantyYears),
  );
  const [warrantyNote, setWarrantyNote] = useState(initial.warrantyNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const totals = useMemo(() => formTotals(lines, discount, currency), [lines, discount, currency]);

  const tripCount = Number(trips) || 1;
  const multiTrip = tripCount > 1;
  const sessionCount = Number(sessions) || 1;
  const multiSession = sessionCount > 1;

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (key: string) =>
    setter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lines.length === 0) {
      setError(t.errors.noLineItems);
      return;
    }
    if (!totals.ok) {
      setError(
        totals.error === "BAD_DISCOUNT"
          ? t.quoteForm.discountTooHigh
          : totals.error === "TOO_HIGH"
            ? t.errors.invalidPrice
            : t.errors.invalidLineItem,
      );
      return;
    }
    // Asked, not defaulted: a skipped question would otherwise tell the
    // patient "flights not included" without the clinic having said so.
    if (flightsIncluded === null) {
      setError(t.quoteForm.flightsQuestion);
      return;
    }
    setPending(true);
    const res = await submitQuote({
      token,
      items: linesPayload(lines),
      discountMajor: parseDiscount(discount),
      note,
      includes: lodging ? [...includes, "ACCOMMODATION"] : includes,
      accommodationNights: lodging ? Number(accommodationNights) || 1 : null,
      flightsIncluded,
      flightTickets: flightsIncluded ? Number(flightTickets) || 1 : null,
      transfers,
      tripsRequired: tripCount,
      daysPerTrip: Number(daysPerTrip) || 1,
      weeksBetweenTrips: multiTrip ? Number(weeksBetween) || null : null,
      sessionsRequired: sessionCount,
      weeksBetweenSessions: multiSession ? Number(weeksBetweenSessions) || null : null,
      warrantyYears: warrantyYears === "" ? null : Number(warrantyYears),
      warrantyNote,
    });
    setPending(false);
    if (res.ok) {
      setDone(true);
      onSubmitted?.();
    } else setError(res.error);
  }

  if (done) {
    return (
      <div className="border-teal-deep/30 bg-teal-deep/5 rounded-lg border p-6 text-center">
        <p className="text-foreground text-lg font-semibold">{t.quoteForm.sentTitle}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t.quoteForm.sentBody}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-border/60 bg-card space-y-6 rounded-lg border p-4 sm:p-6"
    >
      {/* Treatments — the heart of the quote. Picked from the catalog rather
          than typed, so the patient compares clinics on the same axis. */}
      <fieldset className="space-y-3">
        <legend className="text-foreground mb-1 text-sm font-semibold">
          {t.quoteForm.treatmentsLegend}
        </legend>
        <p className="text-muted-foreground -mt-1 text-xs">{t.quoteForm.treatmentsHint}</p>
        <TreatmentLines
          lines={lines}
          currency={currency}
          onChange={(key, patch) =>
            setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
          }
          onRemove={(key) => setLines((prev) => prev.filter((l) => l.key !== key))}
        />
        <TreatmentPicker onAdd={(pick) => setLines((prev) => [...prev, newLine(pick)])} />
      </fieldset>

      <PriceSummary
        totals={totals}
        currency={currency}
        discount={discount}
        onDiscountChange={setDiscount}
      />

      {/* What the price covers. Chips rather than free text so the patient
          compares clinics on the same axis. */}
      <fieldset>
        <legend className="text-foreground mb-2 text-sm font-semibold">
          {t.quoteForm.includedLegend}
        </legend>
        <div className="flex flex-wrap gap-2">
          {QUOTE_FORM_INCLUSIONS.map((key) => (
            <Chip
              key={key}
              active={includes.includes(key)}
              onClick={() => toggle(setIncludes)(key)}
            >
              {translateInclusion(t.labels, key)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <TravelFields
        flightsIncluded={flightsIncluded}
        onFlightsIncluded={setFlightsIncluded}
        flightTickets={flightTickets}
        onFlightTickets={setFlightTickets}
        lodging={lodging}
        onLodging={setLodging}
        nights={accommodationNights}
        onNights={setAccommodationNights}
        transfers={transfers}
        onToggleTransfer={toggle(setTransfers)}
      />

      {/* Trips — the number that moves the patient's real cost most. */}
      <fieldset className="grid grid-cols-2 gap-3 sm:gap-4">
        <legend className="text-foreground mb-2 text-sm font-semibold">
          {t.quoteForm.tripsLegend}
        </legend>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t.quoteForm.tripsCount}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={trips}
            onChange={(e) => setTrips(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t.quoteForm.daysPerTrip}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={daysPerTrip}
            onChange={(e) => setDaysPerTrip(e.target.value)}
            className={fieldClass}
          />
        </label>
        {/* Only asked when it can mean something — a gap between trips is
            nonsense with a single trip. */}
        {multiTrip && (
          <label className="col-span-2 flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">{t.quoteForm.weeksBetween}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={104}
              value={weeksBetween}
              onChange={(e) => setWeeksBetween(e.target.value)}
              className={fieldClass}
              placeholder={t.quoteForm.weeksPlaceholder}
            />
          </label>
        )}
      </fieldset>

      {/* Sessions — how many times the patient must physically return to the
          clinic. Independent of trips: a local patient has sessions with no
          travel at all. */}
      <fieldset className="grid grid-cols-2 gap-3 sm:gap-4">
        <legend className="text-foreground mb-2 text-sm font-semibold">
          {t.quoteForm.sessionsLegend}
        </legend>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t.quoteForm.sessionsCount}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={sessions}
            onChange={(e) => setSessions(e.target.value)}
            className={fieldClass}
          />
        </label>
        {multiSession && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">{t.quoteForm.weeksBetweenSessions}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={104}
              value={weeksBetweenSessions}
              onChange={(e) => setWeeksBetweenSessions(e.target.value)}
              className={fieldClass}
              placeholder={t.quoteForm.weeksBetweenSessionsPlaceholder}
            />
          </label>
        )}
      </fieldset>

      {/* Warranty — the dominant fear once the patient has flown home. */}
      <fieldset className="space-y-4">
        <legend className="text-foreground mb-2 text-sm font-semibold">
          {t.quoteForm.warrantyLegend}
        </legend>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t.quoteForm.warrantyYears}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            value={warrantyYears}
            onChange={(e) => setWarrantyYears(e.target.value)}
            className={fieldClass}
            placeholder={t.quoteForm.warrantyYearsPlaceholder}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t.quoteForm.warrantyNote}</span>
          <textarea
            rows={2}
            value={warrantyNote}
            onChange={(e) => setWarrantyNote(e.target.value)}
            className={fieldClass}
            placeholder={t.quoteForm.warrantyNotePlaceholder}
          />
        </label>
      </fieldset>

      <QuoteAttachments
        token={token}
        requestId={attachmentTarget.requestId}
        requestDentistId={attachmentTarget.requestDentistId}
        initial={initial.attachments}
        canPreview={canPreviewAttachments}
      />

      <div>
        <label htmlFor="note" className="text-foreground mb-1.5 block text-sm font-semibold">
          {t.quoteForm.noteLabel}
        </label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={fieldClass}
          placeholder={t.quoteForm.notePlaceholder}
        />
      </div>

      {error && <p className="text-alert text-sm font-medium">{error}</p>}
      <Button
        type="submit"
        disabled={pending}
        className="bg-teal-deep hover:bg-teal-deep/90 text-cream h-12 w-full rounded-lg text-base font-semibold"
      >
        {pending ? t.quoteForm.sending : t.quoteForm.submit}
      </Button>
    </form>
  );
}
