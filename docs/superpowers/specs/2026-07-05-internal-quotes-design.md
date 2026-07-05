# Internal Quotes System — Design

**Date:** 2026-07-05
**Status:** Approved (pending spec review)
**Author:** Founder + Claude

## Problem

DentalCompare's core promise is **price comparison** ("השוו מחירים"). Today, after a
patient pays and their request is emailed to up to 10 dentists, each dentist replies
**directly to the patient by email** (`fulfillment.ts:51`, and the patient sees
"הצעות המחיר מגיעות ישירות לאימייל שלכם" on the request page, `request/[id]/page.tsx:125`).

Consequences:
- The actual comparison happens in the patient's Gmail, **not on the platform**.
- We have **no structured data** on how many quotes came back or at what price.
- The homepage stats (avg savings ₪3,400, 97%, etc.) are **mockups**, not real data.

**Burning need (per Founder):** the patient should see a **real comparison inside the
app** — a table sorted by price — instead of comparing alone in their inbox.

## Goal & Non-Goals

**Goal:** Capture each dentist's quote (total price + free-text note) as structured data
with **minimal dentist friction**, and surface it to the patient as an in-app comparison.

**Non-goals (explicitly out of scope — YAGNI):**
- Itemized per-treatment quote breakdown (future V3).
- Full dentist portal with accounts/dashboard (PRD V2).
- Rewiring the homepage stats to be data-driven (built later, on top of this data).

## Approach

**Chosen: magic-link quote form (no login).** The dentist email keeps working, but its
CTA becomes a single strong button leading to a token-scoped form. The dentist enters a
price + optional note and submits — no account. This directly solves the patient-facing
comparison need, keeps dentist friction to one click, and reuses the existing
token-scoped page pattern (`clinics/billing/[token]`). It can later grow into the full
portal without discarding work.

Rejected alternatives:
- **Patient-entered quotes** — zero dentist friction but data is patient-dependent,
  unverified, and double-entry; worse UX.
- **Full dentist portal** — highest data quality but highest friction and biggest build;
  this is PRD V2, overkill for the burning need.

## Design

### 1. Data model (Prisma)

Add to `RequestDentist`:
- `quoteToken String? @unique` — opaque random token (same style as
  `ClinicSubscription.setupToken`). Generated when the request email is sent.

New model `Quote` (1:1 with `RequestDentist`):
- `id String @id @default(uuid())`
- `requestDentistId String @unique`
- `requestDentist RequestDentist @relation(..., onDelete: Cascade)`
- `amountILS Int` — total price, **required**
- `note String? @db.Text` — free-text (e.g. "כולל צילום, לא כולל שתל")
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`

Rationale for a separate model over inline columns: the comparison query stays clean,
`RequestDentist` stays focused on "was emailed", and itemized quotes (V3) can be added
without a painful migration.

Migration: additive only (new nullable column + new table). Apply to Neon.

### 2. Dentist flow (no login)

**Token generation.** In `fulfillPaidSession` (`server/fulfillment.ts`), when emailing a
pending `RequestDentist`, generate and persist `quoteToken` in the same
`db.requestDentist.update` that sets `emailSent: true`.

**Email rewrite** (`buildEmailHtml`). Replace the weak
"להגשת הצעת מחיר, השיבו ישירות למטופל" with a strong, personalized, speed-promising CTA:

> **{patientName} ביקש/ה ממך הצעת מחיר לטיפול שיניים.**
> תוכנית הטיפול והצילום מצורפים למייל זה.
> **[ 💰 להזנת מחיר מהירה — לוקח 5 שניות ]**  ← single large button → `{APP_URL}/quote/{quoteToken}`

Attachments (treatment plan + x-ray) stay, so the dentist can price the case. Patient
contact details may remain as a fallback.

**Quote form route** — `app/quote/[token]/page.tsx`, **public (no Clerk)**, mirroring
`clinics/billing/[token]`. Looks up `RequestDentist` by `quoteToken` (→ `notFound()` if
missing). Shows: patient first name, links to treatment plan + x-ray, and a form:
- **מחיר כולל (₪)** — required positive integer
- **הערה** — optional textarea

A server action upserts the `Quote` (create, or update if the dentist re-submits) and
shows a success state ("ההצעה נשלחה, תודה"). On upsert, triggers the patient
notification (section 4).

### 3. Patient flow (the comparison)

On `request/[id]/page.tsx`, replace the "quotes arrive by email" banner with a
**comparison section**:
- One row per selected dentist, **sorted by `amountILS` ascending**.
- Columns: dentist name / clinic / city · **price** (visually emphasized) · note.
- "**המחיר הזול ביותר**" badge on the cheapest quote.
- Section heading: "**X מתוך Y רופאים הגיבו**" (X = quotes received, Y = dentists emailed).
- Dentists without a quote yet render as "ממתין להצעה".

Query: extend the existing `request.findUnique` select to include
`requestDentists.quote` and sort/derive the cheapest in the page component.

### 4. Patient notification (in scope)

When a `Quote` is created (first submission for that `RequestDentist`), email the patient:

> **קיבלת הצעת מחיר חדשה 🎉**
> רופא הגיש הצעת מחיר לבקשה שלך. היכנס/י להשוות: **[ צפייה בהשוואה ]** → `{APP_URL}/request/{requestId}`

Sent via the existing Resend client (`lib/email.ts`). Fire only on **create**, not on
update, to avoid spamming the patient when a dentist edits. Send failure must not fail
the dentist's submission (log and continue, same pattern as `fulfillment.ts`).

## Business rules & edge cases

- `quoteToken` is unguessable and unique → each dentist sees only their own request; no
  login required.
- One `Quote` per `RequestDentist` (upsert on re-submit).
- Tokens/quotes only exist for **PAID** requests (email is only sent post-payment).
- Form validation: `amountILS` is a positive integer with a sane upper bound.
- **No new data exposure** — the token page shows the same treatment plan + x-ray already
  emailed to the dentist as attachments.
- Patient authorization on the comparison view is unchanged (`request.userId === user.id`).

## Testing

- Unit: token generation is unique per `RequestDentist`; quote upsert (create + update
  same row); patient notification fires on create only, not on update.
- Unit: comparison sorting (cheapest first) and "X of Y responded" counts.
- Manual: paid request → dentist email CTA → `/quote/[token]` submit → patient sees
  sorted comparison + receives notification email.

## Files touched

- `prisma/schema.prisma` — `quoteToken` on `RequestDentist`, new `Quote` model (+ migration).
- `src/server/fulfillment.ts` — generate token; rewrite `buildEmailHtml` CTA.
- `src/app/quote/[token]/page.tsx` — new public quote form (+ its server action).
- `src/server/quotes.ts` (new) — submit/upsert quote + trigger patient notification.
- `src/lib/email.ts` / new helper — patient "new quote" email.
- `src/app/request/[id]/page.tsx` — comparison section replacing the email banner.
