"use client";

import { useState } from "react";
import { submitQuote } from "@/server/quotes";
import { Button } from "@/components/ui/button";

export function QuoteForm({
  token,
  initialAmount,
  initialNote,
}: {
  token: string;
  initialAmount: number | null;
  initialNote: string | null;
}) {
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");
  const [note, setNote] = useState(initialNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("יש להזין מחיר תקין");
      return;
    }
    setPending(true);
    const res = await submitQuote({ token, amountILS: parsed, note });
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
    <form onSubmit={onSubmit} className="border-border/60 bg-card space-y-4 rounded-2xl border p-6">
      <div>
        <label htmlFor="amount" className="text-foreground mb-1.5 block text-sm font-semibold">
          מחיר כולל (₪)
        </label>
        <input
          id="amount"
          type="number"
          inputMode="numeric"
          min={1}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border-border/60 focus:border-teal-deep w-full rounded-xl border px-4 py-3 text-lg outline-none"
          placeholder="לדוגמה: 7200"
        />
      </div>
      <div>
        <label htmlFor="note" className="text-foreground mb-1.5 block text-sm font-semibold">
          הערה (אופציונלי)
        </label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="border-border/60 focus:border-teal-deep w-full rounded-xl border px-4 py-3 outline-none"
          placeholder="לדוגמה: כולל צילום, לא כולל שתל"
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
