"use client";

import { useState } from "react";
import { submitQuote } from "@/server/quotes";
import { QUOTE_INCLUSIONS } from "@/lib/constants";
import { translateInclusion } from "@/lib/labels";
import { Button } from "@/components/ui/button";

const fieldClass =
  "border-border/60 focus:border-teal-deep w-full rounded-xl border px-4 py-3 outline-none";

export type QuoteFormInitial = {
  amount: number | null;
  note: string | null;
  includes: string[];
  tripsRequired: number;
  daysPerTrip: number;
  weeksBetweenTrips: number | null;
  warrantyYears: number | null;
  warrantyNote: string | null;
};

export function QuoteForm({
  token,
  currencyLabel,
  initial,
}: {
  token: string;
  /** The clinic's own currency, so the price field never claims to be shekels. */
  currencyLabel: string;
  initial: QuoteFormInitial;
}) {
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : "");
  const [note, setNote] = useState(initial.note ?? "");
  const [includes, setIncludes] = useState<string[]>(initial.includes);
  const [trips, setTrips] = useState(String(initial.tripsRequired));
  const [daysPerTrip, setDaysPerTrip] = useState(String(initial.daysPerTrip));
  const [weeksBetween, setWeeksBetween] = useState(
    initial.weeksBetweenTrips ? String(initial.weeksBetweenTrips) : "",
  );
  const [warrantyYears, setWarrantyYears] = useState(
    initial.warrantyYears === null ? "" : String(initial.warrantyYears),
  );
  const [warrantyNote, setWarrantyNote] = useState(initial.warrantyNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tripCount = Number(trips) || 1;
  const multiTrip = tripCount > 1;

  const toggleInclusion = (key: string) =>
    setIncludes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("יש להזין מחיר תקין");
      return;
    }
    setPending(true);
    const res = await submitQuote({
      token,
      amountMajor: parsed,
      note,
      includes,
      tripsRequired: tripCount,
      daysPerTrip: Number(daysPerTrip) || 1,
      weeksBetweenTrips: multiTrip ? Number(weeksBetween) || null : null,
      warrantyYears: warrantyYears === "" ? null : Number(warrantyYears),
      warrantyNote,
    });
    setPending(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  }

  if (done) {
    return (
      <div className="border-teal-deep/30 bg-teal-deep/5 rounded-2xl border p-6 text-center">
        <p className="text-foreground text-lg font-semibold">ההצעה נשלחה — תודה! 🎉</p>
        <p className="text-muted-foreground mt-1 text-sm">המטופל יקבל את הצעת המחיר שלך להשוואה.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="border-border/60 bg-card space-y-6 rounded-2xl border p-6">
      <div>
        <label htmlFor="amount" className="text-foreground mb-1.5 block text-sm font-semibold">
          מחיר כולל ({currencyLabel})
        </label>
        <input
          id="amount"
          type="number"
          inputMode="numeric"
          min={1}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${fieldClass} text-lg`}
          placeholder="לדוגמה: 7200"
        />
      </div>

      {/* What the price covers. Checkboxes rather than free text so the patient
          compares clinics on the same axis. */}
      <fieldset>
        <legend className="text-foreground mb-2 text-sm font-semibold">מה כלול במחיר?</legend>
        <div className="flex flex-wrap gap-2">
          {QUOTE_INCLUSIONS.map((key) => {
            const active = includes.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleInclusion(key)}
                aria-pressed={active}
                className={
                  active
                    ? "border-teal-deep bg-teal-deep text-cream rounded-full border px-3.5 py-1.5 text-sm font-medium"
                    : "border-border/60 text-muted-foreground hover:border-teal-deep/50 rounded-full border px-3.5 py-1.5 text-sm"
                }
              >
                {translateInclusion(key)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Trips — the number that moves the patient's real cost most. */}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-foreground mb-2 text-sm font-semibold">
          כמה נסיעות נדרשות?
        </legend>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">מספר נסיעות</span>
          <input
            type="number"
            min={1}
            max={10}
            value={trips}
            onChange={(e) => setTrips(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">ימים בכל נסיעה</span>
          <input
            type="number"
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
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="text-muted-foreground">שבועות בין הנסיעות</span>
            <input
              type="number"
              min={1}
              max={104}
              value={weeksBetween}
              onChange={(e) => setWeeksBetween(e.target.value)}
              className={fieldClass}
              placeholder="לדוגמה: 16"
            />
          </label>
        )}
      </fieldset>

      {/* Warranty — the dominant fear once the patient has flown home. */}
      <fieldset className="space-y-4">
        <legend className="text-foreground mb-2 text-sm font-semibold">אחריות</legend>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">שנות אחריות (אופציונלי)</span>
          <input
            type="number"
            min={0}
            max={50}
            value={warrantyYears}
            onChange={(e) => setWarrantyYears(e.target.value)}
            className={fieldClass}
            placeholder="לדוגמה: 5"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">
            מה קורה אם משהו משתבש אחרי החזרה הביתה?
          </span>
          <textarea
            rows={2}
            value={warrantyNote}
            onChange={(e) => setWarrantyNote(e.target.value)}
            className={fieldClass}
            placeholder="לדוגמה: תיקון ללא עלות, המטופל נושא בעלות הטיסה"
          />
        </label>
      </fieldset>

      <div>
        <label htmlFor="note" className="text-foreground mb-1.5 block text-sm font-semibold">
          הערה (אופציונלי)
        </label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={fieldClass}
          placeholder="לדוגמה: המחיר תקף 60 יום"
        />
      </div>

      {error && <p className="text-coral text-sm font-medium">{error}</p>}
      <Button
        type="submit"
        disabled={pending}
        className="bg-teal-deep hover:bg-teal-deep/90 text-cream h-12 w-full rounded-full text-base font-semibold"
      >
        {pending ? "שולח..." : "שליחת הצעת מחיר"}
      </Button>
    </form>
  );
}
