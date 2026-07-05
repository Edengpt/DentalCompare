# Internal Quotes System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let dentists submit a quote (price + note) via a no-login magic-link form, and show the patient an in-app price comparison sorted cheapest-first, notifying the patient when a new quote arrives.

**Architecture:** A new `Quote` table holds one quote per `RequestDentist`, reached by a per-recipient `quoteToken` embedded in the dentist email CTA. A public token-scoped page (`/quote/[token]`) mirrors the existing `clinics/billing/[token]` pattern. Pure comparison helpers (sort / cheapest / counts) are unit-tested; the patient request page renders the comparison from them. A patient notification email fires only on first submission.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), Prisma 7 / PostgreSQL (Neon), Resend, Vitest, Tailwind v4 + shadcn.

## Global Constraints

- All user-facing copy is **Hebrew, RTL** (`dir="rtl"` on email HTML, existing RTL app layout).
- Money is **integer ILS** (`amountILS: Int`) — no decimals, consistent with `priceILS` on `ClinicSubscription`.
- Tokens use `randomUUID()` from `node:crypto` (same as `setupToken`).
- App URL is resolved via `process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"` (existing convention).
- Server actions return `{ ok: true; ... } | { ok: false; error: string }`.
- Server-only modules start with `import "server-only";`.
- Prisma client is imported as `import { db } from "@/lib/db";`.
- Branch: `feat/clinic-subscriptions` (current). Commit per task.

---

### Task 1: Database schema — `quoteToken` + `Quote` model

**Files:**
- Modify: `prisma/schema.prisma` (RequestDentist model ~lines 97-108; add new model after it)
- Generated: `src/generated/prisma/**` (via `prisma generate`)
- Migration: `prisma/migrations/<timestamp>_internal_quotes/migration.sql`

**Interfaces:**
- Produces: `RequestDentist.quoteToken: string | null` (unique), `RequestDentist.quote: Quote | null`, and model `Quote { id, requestDentistId (unique), amountILS: Int, note: string | null, createdAt, updatedAt }`.

- [ ] **Step 1: Add `quoteToken` + `quote` relation to `RequestDentist`**

In `prisma/schema.prisma`, edit the `RequestDentist` model to add two lines before the closing `}`:

```prisma
model RequestDentist {
  id        String    @id @default(uuid())
  requestId String
  request   Request   @relation(fields: [requestId], references: [id], onDelete: Cascade)
  dentistId String
  dentist   Dentist   @relation(fields: [dentistId], references: [id], onDelete: Cascade)
  emailSent Boolean   @default(false)
  sentAt    DateTime?

  quoteToken String? @unique // per-recipient magic-link token for the quote form
  quote      Quote?

  @@unique([requestId, dentistId])
  @@index([dentistId])
}
```

- [ ] **Step 2: Add the `Quote` model**

Append after the `RequestDentist` model:

```prisma
model Quote {
  id               String         @id @default(uuid())
  requestDentistId String         @unique
  requestDentist   RequestDentist @relation(fields: [requestDentistId], references: [id], onDelete: Cascade)
  amountILS        Int // total quoted price in ILS
  note             String?        @db.Text // free-text, e.g. "כולל צילום, לא כולל שתל"
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([requestDentistId])
}
```

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Create and apply the migration to Neon**

Run: `npm run db:migrate -- --name internal_quotes`
Expected: migration created under `prisma/migrations/<timestamp>_internal_quotes/`, applied cleanly, and `prisma generate` runs (regenerating `src/generated/prisma`). No data loss warnings (additive only).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/generated/prisma
git commit -m "feat(quotes): add quoteToken + Quote model"
```

---

### Task 2: Pure comparison helpers (`src/lib/quotes.ts`)

**Files:**
- Create: `src/lib/quotes.ts`
- Test: `src/lib/quotes.test.ts`

**Interfaces:**
- Produces:
  - `type QuoteRow = { dentistId: string; dentistName: string; clinicName: string; city: string; amountILS: number | null; note: string | null }`
  - `sortByPrice(rows: QuoteRow[]): QuoteRow[]` — quoted rows ascending by price, un-quoted rows last (stable).
  - `cheapestDentistId(rows: QuoteRow[]): string | null` — dentistId of the lowest `amountILS`, or `null` if none quoted.
  - `responseCounts(rows: QuoteRow[]): { responded: number; total: number }`
  - `quotePath(token: string): string` — `/quote/${token}`

- [ ] **Step 1: Write the failing test**

Create `src/lib/quotes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  sortByPrice,
  cheapestDentistId,
  responseCounts,
  quotePath,
  type QuoteRow,
} from "./quotes";

const row = (dentistId: string, amountILS: number | null): QuoteRow => ({
  dentistId,
  dentistName: `Dr ${dentistId}`,
  clinicName: `Clinic ${dentistId}`,
  city: "תל אביב",
  amountILS,
  note: null,
});

describe("quote comparison helpers", () => {
  it("sorts quoted rows cheapest-first and puts un-quoted rows last", () => {
    const rows = [row("a", null), row("b", 9800), row("c", 7200)];
    expect(sortByPrice(rows).map((r) => r.dentistId)).toEqual(["c", "b", "a"]);
  });

  it("returns the cheapest quoted dentist id, or null when none quoted", () => {
    expect(cheapestDentistId([row("a", null), row("b", 9800), row("c", 7200)])).toBe("c");
    expect(cheapestDentistId([row("a", null), row("b", null)])).toBeNull();
  });

  it("counts responded vs total", () => {
    expect(responseCounts([row("a", null), row("b", 9800), row("c", 7200)])).toEqual({
      responded: 2,
      total: 3,
    });
  });

  it("builds the quote form path", () => {
    expect(quotePath("abc-123")).toBe("/quote/abc-123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/quotes.test.ts`
Expected: FAIL — cannot resolve `./quotes`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/quotes.ts`:

```ts
export type QuoteRow = {
  dentistId: string;
  dentistName: string;
  clinicName: string;
  city: string;
  amountILS: number | null;
  note: string | null;
};

/** Quoted rows ascending by price; un-quoted rows keep their order at the end. */
export function sortByPrice(rows: QuoteRow[]): QuoteRow[] {
  return [...rows].sort((a, b) => {
    if (a.amountILS === null && b.amountILS === null) return 0;
    if (a.amountILS === null) return 1;
    if (b.amountILS === null) return -1;
    return a.amountILS - b.amountILS;
  });
}

/** dentistId of the lowest quote, or null if nobody has quoted yet. */
export function cheapestDentistId(rows: QuoteRow[]): string | null {
  let best: QuoteRow | null = null;
  for (const r of rows) {
    if (r.amountILS === null) continue;
    if (best === null || r.amountILS < best.amountILS!) best = r;
  }
  return best?.dentistId ?? null;
}

export function responseCounts(rows: QuoteRow[]): { responded: number; total: number } {
  return {
    responded: rows.filter((r) => r.amountILS !== null).length,
    total: rows.length,
  };
}

export function quotePath(token: string): string {
  return `/quote/${token}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/quotes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/quotes.ts src/lib/quotes.test.ts
git commit -m "feat(quotes): pure comparison helpers"
```

---

### Task 3: Generate `quoteToken` + rewrite dentist email CTA (`fulfillment.ts`)

**Files:**
- Modify: `src/server/fulfillment.ts` (`buildEmailHtml` ~lines 22-55; send loop ~lines 119-146)

**Interfaces:**
- Consumes: `quotePath` from `@/lib/quotes`; `RequestDentist.quoteToken` from Task 1.
- Produces: every emailed `RequestDentist` gets a persisted `quoteToken`; email body links to `{APP_URL}/quote/{token}`.

- [ ] **Step 1: Import token + URL helpers**

At the top of `src/server/fulfillment.ts`, add:

```ts
import { randomUUID } from "node:crypto";
import { quotePath } from "@/lib/quotes";
```

Add an app-url helper below the imports (mirrors `subscription-notifications.ts`):

```ts
function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}
```

- [ ] **Step 2: Rewrite `buildEmailHtml` to a strong CTA**

Replace the `buildEmailHtml` function so it takes a `quoteUrl` and renders a single prominent button instead of "השיבו ישירות למטופל". New signature and body:

```ts
function buildEmailHtml(opts: {
  dentistName: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  requestId: string;
  date: string;
  quoteUrl: string;
}): string {
  const { dentistName, patientName, patientPhone, requestId, date, quoteUrl } = opts;
  return `
  <div dir="rtl" style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #0f4c4c;">${patientName} ביקש/ה ממך הצעת מחיר</h2>
    <p>שלום ${dentistName},</p>
    <p>${patientName} מבקש/ת הצעת מחיר לטיפול שיניים דרך DentalCompare. תוכנית הטיפול והצילום מצורפים למייל זה.</p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${quoteUrl}"
         style="display: inline-block; background: #ff6b4a; color: #fff; text-decoration: none;
                font-size: 17px; font-weight: bold; padding: 16px 32px; border-radius: 999px;">
        💰 להזנת מחיר מהירה — לוקח 5 שניות
      </a>
    </div>

    <ul style="padding-inline-start: 18px; color: #555; font-size: 13px;">
      <li>מספר בקשה: ${requestId.slice(0, 8)}</li>
      <li>תאריך: ${date}</li>
      <li>ליצירת קשר ישיר: ${patientPhone || "ראו כפתור למעלה"}</li>
    </ul>

    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
    <p style="font-size: 12px; color: #777;">מייל זה נשלח אוטומטית על ידי DentalCompare.</p>
  </div>`;
}
```

- [ ] **Step 3: Generate the token and pass the URL in the send loop**

In `fulfillPaidSession`, inside the `for (const rd of pending)` loop, before `resend.emails.send`, add:

```ts
    const quoteToken = randomUUID();
    const quoteUrl = `${appUrl()}${quotePath(quoteToken)}`;
```

Add `quoteUrl` to the `buildEmailHtml({ ... })` call, and add `quoteToken` to the success `db.requestDentist.update`:

```ts
      await db.requestDentist.update({
        where: { id: rd.id },
        data: { emailSent: true, sentAt: new Date(), quoteToken },
      });
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/fulfillment.ts
git commit -m "feat(quotes): generate quoteToken + strong email CTA"
```

---

### Task 4: Quote submission action + patient notification

**Files:**
- Create: `src/server/quote-notifications.ts`
- Create: `src/server/quotes.ts`

**Interfaces:**
- Consumes: `RequestDentist.quoteToken`, `Quote` (Task 1).
- Produces:
  - `sendNewQuoteEmail(args: { to: string; patientName: string; requestId: string }): Promise<void>`
  - `submitQuote(input: { token: string; amountILS: number; note?: string }): Promise<{ ok: true } | { ok: false; error: string }>` — upserts the quote; fires `sendNewQuoteEmail` **only on first create**.

- [ ] **Step 1: Patient notification email helper**

Create `src/server/quote-notifications.ts`:

```ts
import "server-only";
import { getResend, fromAddress } from "@/lib/email";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function sendNewQuoteEmail(args: {
  to: string;
  patientName: string;
  requestId: string;
}): Promise<void> {
  const link = `${appUrl()}/request/${args.requestId}`;
  const html = `
  <div dir="rtl" style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #0f4c4c;">קיבלת הצעת מחיר חדשה 🎉</h2>
    <p>שלום ${args.patientName},</p>
    <p>רופא הגיש הצעת מחיר לבקשה שלך ב-DentalCompare. היכנס/י כדי לראות את ההשוואה ולבחור.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0f4c4c; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        צפייה בהשוואה
      </a>
    </div>
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
    <p style="font-size: 12px; color: #777;">מייל זה נשלח אוטומטית על ידי DentalCompare.</p>
  </div>`;

  await getResend().emails.send({
    from: fromAddress(),
    to: args.to,
    subject: "קיבלת הצעת מחיר חדשה 🎉",
    html,
  });
}
```

- [ ] **Step 2: `submitQuote` server action**

Create `src/server/quotes.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { sendNewQuoteEmail } from "./quote-notifications";

export async function submitQuote(input: {
  token: string;
  amountILS: number;
  note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const amount = Math.round(input.amountILS);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return { ok: false, error: "יש להזין מחיר תקין" };
  }

  const rd = await db.requestDentist.findUnique({
    where: { quoteToken: input.token },
    select: {
      id: true,
      quote: { select: { id: true } },
      request: {
        select: { id: true, user: { select: { fullName: true, email: true } } },
      },
    },
  });
  if (!rd) return { ok: false, error: "קישור לא תקין" };

  const isNew = !rd.quote;
  const note = input.note?.trim() || null;

  await db.quote.upsert({
    where: { requestDentistId: rd.id },
    create: { requestDentistId: rd.id, amountILS: amount, note },
    update: { amountILS: amount, note },
  });

  if (isNew) {
    try {
      await sendNewQuoteEmail({
        to: rd.request.user.email,
        patientName: rd.request.user.fullName,
        requestId: rd.request.id,
      });
    } catch (err) {
      console.error("sendNewQuoteEmail failed:", err);
    }
  }

  return { ok: true };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/quotes.ts src/server/quote-notifications.ts
git commit -m "feat(quotes): submitQuote action + patient notification"
```

---

### Task 5: Public quote form page (`/quote/[token]`)

**Files:**
- Create: `src/app/quote/[token]/page.tsx` (server component)
- Create: `src/components/quote/quote-form.tsx` (client component)

**Interfaces:**
- Consumes: `submitQuote` from `@/server/quotes`; `RequestDentist.quoteToken`, `Quote` (Task 1).

- [ ] **Step 1: The client form component**

Create `src/components/quote/quote-form.tsx`:

```tsx
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
```

- [ ] **Step 2: The token-scoped page**

Create `src/app/quote/[token]/page.tsx` (mirrors `clinics/billing/[token]/page.tsx`):

```tsx
import { notFound } from "next/navigation";
import { FileText, Image as ImageIcon } from "lucide-react";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { QuoteForm } from "@/components/quote/quote-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "הגשת הצעת מחיר" };

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rd = await db.requestDentist.findUnique({
    where: { quoteToken: token },
    select: {
      quote: { select: { amountILS: true, note: true } },
      dentist: { select: { dentistName: true } },
      request: {
        select: {
          treatmentFileUrl: true,
          xrayFileUrl: true,
          user: { select: { fullName: true } },
        },
      },
    },
  });
  if (!rd) notFound();

  const firstName = rd.request.user.fullName.split(" ")[0];
  const files = [
    { icon: FileText, label: "תוכנית הטיפול", url: rd.request.treatmentFileUrl },
    { icon: ImageIcon, label: "צילום שיניים", url: rd.request.xrayFileUrl },
  ].filter((f) => !!f.url);

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-16">
        <h1 className="font-display text-foreground text-3xl font-bold">
          הצעת מחיר עבור {firstName}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          עיינו בתוכנית הטיפול ובצילום, והזינו מחיר. שלב אחד — לוקח 5 שניות.
        </p>

        {files.length > 0 && (
          <ul className="border-border/60 bg-card divide-border/60 mt-6 divide-y rounded-2xl border">
            {files.map((f) => (
              <li key={f.label} className="flex items-center justify-between gap-3 p-4">
                <span className="text-foreground inline-flex items-center gap-2.5 text-sm font-medium">
                  <f.icon className="text-teal-deep h-4 w-4" />
                  {f.label}
                </span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-deep text-sm font-semibold underline-offset-4 hover:underline"
                >
                  צפייה בקובץ
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <QuoteForm
            token={token}
            initialAmount={rd.quote?.amountILS ?? null}
            initialNote={rd.quote?.note ?? null}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual smoke (dev server running)**

With a paid request that has an emailed dentist, read its `quoteToken` from the DB (`npm run db:studio`), open `http://localhost:3000/quote/<token>`, submit a price, confirm the success state renders.

- [ ] **Step 5: Commit**

```bash
git add src/app/quote src/components/quote
git commit -m "feat(quotes): public token-scoped quote form"
```

---

### Task 6: Patient comparison view (`request/[id]/page.tsx`)

**Files:**
- Modify: `src/app/request/[id]/page.tsx` (query select ~lines 49-60; paid banner ~lines 122-127; dentists section ~lines 187-220)

**Interfaces:**
- Consumes: `sortByPrice`, `cheapestDentistId`, `responseCounts`, `type QuoteRow` from `@/lib/quotes`.

- [ ] **Step 1: Import the helpers**

Add to the imports in `src/app/request/[id]/page.tsx`:

```ts
import { sortByPrice, cheapestDentistId, responseCounts, type QuoteRow } from "@/lib/quotes";
```

- [ ] **Step 2: Extend the query to include quotes**

In the `requestDentists.select`, add `quote` and the dentist `clinicName`/`city` (already partly selected). Replace the `requestDentists` select block with:

```ts
      requestDentists: {
        select: {
          emailSent: true,
          sentAt: true,
          quote: { select: { amountILS: true, note: true } },
          dentist: {
            select: { id: true, dentistName: true, clinicName: true, city: true },
          },
        },
        orderBy: { dentist: { dentistName: "asc" } },
      },
```

- [ ] **Step 3: Build comparison rows after `const dentists = ...`**

After `const dentists = request.requestDentists;`, add:

```ts
  const quoteRows: QuoteRow[] = dentists.map((rd) => ({
    dentistId: rd.dentist.id,
    dentistName: rd.dentist.dentistName,
    clinicName: rd.dentist.clinicName,
    city: rd.dentist.city,
    amountILS: rd.quote?.amountILS ?? null,
    note: rd.quote?.note ?? null,
  }));
  const sortedQuotes = sortByPrice(quoteRows);
  const cheapestId = cheapestDentistId(quoteRows);
  const { responded, total } = responseCounts(quoteRows);
  const ils = new Intl.NumberFormat("he-IL");
```

- [ ] **Step 4: Replace the paid banner with the comparison section**

Replace the `{isPaid && ( ... )}` block (the "הצעות המחיר מגיעות ישירות לאימייל שלכם" banner) with:

```tsx
          {isPaid && (
            <section>
              <div className="border-teal-deep/30 bg-teal-deep/5 text-foreground mb-4 flex items-center gap-2.5 rounded-2xl border px-5 py-4 text-sm">
                <Mail className="text-teal-deep h-4 w-4 shrink-0" />
                {responded > 0
                  ? `${responded} מתוך ${total} רופאים הגיבו. השוו את ההצעות למטה.`
                  : `הבקשה נשלחה ל-${total} רופאים. ההצעות יופיעו כאן ברגע שיגיבו.`}
              </div>

              {responded > 0 && (
                <ul className="border-border/60 bg-card divide-border/60 divide-y rounded-2xl border">
                  {sortedQuotes.map((q) => {
                    const isCheapest = q.dentistId === cheapestId;
                    return (
                      <li key={q.dentistId} className="flex items-start justify-between gap-4 p-4">
                        <div>
                          <p className="text-foreground font-semibold">
                            {q.dentistName}
                            {isCheapest && (
                              <span className="bg-teal-deep/10 text-teal-deep mr-2 rounded-full px-2 py-0.5 text-xs font-semibold">
                                המחיר הזול ביותר
                              </span>
                            )}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {q.clinicName} ✦ {q.city}
                          </p>
                          {q.note && (
                            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                              {q.note}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-left">
                          {q.amountILS !== null ? (
                            <span className="text-foreground text-lg font-bold">
                              ₪{ils.format(q.amountILS)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">ממתין להצעה</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual smoke**

Open the request from Task 5 at `http://localhost:3000/request/<id>` (signed in as its owner). Confirm the comparison table shows the submitted quote, the "המחיר הזול ביותר" badge on the lowest, and "X מתוך Y רופאים הגיבו".

- [ ] **Step 7: Commit**

```bash
git add src/app/request/[id]/page.tsx
git commit -m "feat(quotes): in-app price comparison on request page"
```

---

## Self-Review

**Spec coverage:**
- Data model (`quoteToken` + `Quote`) → Task 1. ✅
- Dentist flow (email CTA + token form) → Tasks 3, 5. ✅
- Patient flow (comparison sorted cheapest-first, X-of-Y, cheapest badge, "ממתין להצעה") → Tasks 2, 6. ✅
- Patient notification (create-only) → Task 4. ✅
- Business rules: unguessable token (`randomUUID`, Task 3), one quote per dentist / upsert (Task 4), PAID-only (tokens only minted in `fulfillPaidSession`, Task 3), amount validation (Task 4 + 5), no new data exposure (Task 5 shows already-emailed files). ✅
- Testing: pure helpers unit-tested (Task 2); manual smokes (Tasks 5, 6). ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✅

**Type consistency:** `QuoteRow`, `sortByPrice`, `cheapestDentistId`, `responseCounts`, `quotePath`, `submitQuote`, `sendNewQuoteEmail` names/signatures match across Tasks 2/4/5/6. `amountILS: Int` consistent everywhere. ✅

**Note on tests:** The pure comparison logic is the only unit-tested surface (Task 2), matching the repo's convention of unit-testing `src/lib/*` pure functions (`subscription.test.ts`, `payplus.test.ts`) and manually verifying pages/actions. The "notify on create only" branch in `submitQuote` is verified manually (Task 5/6 smoke) since it hits the DB + Resend.
