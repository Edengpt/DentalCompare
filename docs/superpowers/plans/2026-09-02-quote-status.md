# Quote Status Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every clinic's quote a full lifecycle — sent → approved/rejected by the patient → in treatment → completed — visible and actionable from both the patient's request page and the clinic's dashboard, with an email on every transition.

**Architecture:** One `QuoteStatus` enum on the existing `Quote` model is the single source of truth every screen and gate reads — never derived from a combination of timestamps. Timestamps exist alongside it purely for display/audit. Five new server actions in `src/server/quote-decisions.ts` drive the transitions; each is guarded by a `WHERE status = <expected>` conditional update so a double-click or a race never silently corrupts state. Five new email templates reuse the existing retry-safe `*NotifiedAt` column pattern already used for the "new quote" email.

**Tech Stack:** Next.js 16.2.11, React 19.2, Prisma 7.8 + Postgres, Resend (email), vitest (node).

**Spec:** `docs/superpowers/specs/2026-09-02-quote-status-design.md` — read it first. This plan implements it task by task.

## Global Constraints

- **`Quote.status` is the only thing any gate, filter, or screen tests.** Never write `if (quote.approvedAt !== null)` — always `if (quote.status === "APPROVED")`. This is the exact bug family that hit `visibleSubscriptionFilter` and the licence gate twice already.
- **`he.ts` is the source of truth for the dictionary; `en.ts` must receive every new key in the same commit.** `he.ts` is not `as const`.
- **Dictionary values are templates, never functions.** Use `format()` from `@/i18n/format` for interpolation.
- **All decisions are final in v1** — no "undo" action anywhere in this plan.
- **Every new server action returns `{ ok: true } | { ok: false; error: string }`**, matching the `ActionResult` pattern already used in `src/server/request-deletion.ts`.
- **Test file naming:** `*.integration.test.ts` for anything touching the real Postgres database (`describe.skipIf(!hasDb)`, matching `src/server/requests-licence.integration.test.ts`). Local DB: `docker start dentalcompare-db` before running `npm test`.

---

### Task 1: Schema — `QuoteStatus` and the new `Quote` columns

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260902120000_quote_status/migration.sql`
- Test: `src/server/quote-status-schema.integration.test.ts`

**Interfaces:**
- Produces: `QuoteStatus` enum (`PENDING_DECISION | APPROVED | REJECTED | IN_TREATMENT | COMPLETION_REQUESTED | COMPLETED`), importable as `import type { QuoteStatus } from "@/generated/prisma/enums"`.
- Produces: `Quote.status` (default `PENDING_DECISION`), `Quote.decidedAt`, `Quote.rejectedAuto`, `Quote.treatmentStartedAt`, `Quote.completionRequestedAt`, `Quote.completedAt`, `Quote.decisionNotifiedAt`, `Quote.treatmentStartedNotifiedAt`, `Quote.completionRequestedNotifiedAt`, `Quote.completedNotifiedAt`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/quote-status-schema.integration.test.ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
const created = { dentistIds: [] as string[], userIds: [] as string[], requestIds: [] as string[] };

describe.skipIf(!hasDb)("Quote.status schema", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it("defaults a new quote to PENDING_DECISION with every transition timestamp null", async () => {
    const sfx = randomUUID().slice(0, 8);
    const user = await db.user.create({
      data: { clerkUserId: `qs_${sfx}`, fullName: "T", email: `qs_${sfx}@example.com` },
    });
    created.userIds.push(user.id);
    const request = await db.request.create({
      data: { userId: user.id, treatmentFileUrl: "https://blob/t", xrayFileUrl: "https://blob/x" },
    });
    created.requestIds.push(request.id);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `qsd_${sfx}@example.com`,
        phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
        city: "Tel Aviv",
        address: "1 Main St",
        experienceYears: 5,
      },
    });
    created.dentistIds.push(dentist.id);
    const rd = await db.requestDentist.create({
      data: { requestId: request.id, dentistId: dentist.id },
    });
    const quote = await db.quote.create({
      data: { requestDentistId: rd.id, amountMinor: 100000, currency: "ILS" },
    });

    expect(quote.status).toBe("PENDING_DECISION");
    expect(quote.decidedAt).toBeNull();
    expect(quote.rejectedAuto).toBe(false);
    expect(quote.treatmentStartedAt).toBeNull();
    expect(quote.completionRequestedAt).toBeNull();
    expect(quote.completedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- quote-status-schema` (needs `docker start dentalcompare-db` first)
Expected: FAIL — `status` does not exist on the Prisma `Quote` create input, or the field is `undefined`.

- [ ] **Step 3: Add the enum and columns to the schema**

In `prisma/schema.prisma`, add near the other enums (after `enum TravelScope`):

```prisma
enum QuoteStatus {
  PENDING_DECISION
  APPROVED
  REJECTED
  IN_TREATMENT
  COMPLETION_REQUESTED
  COMPLETED
}
```

In `model Quote`, after the existing `patientNotifiedAt` line, add:

```prisma
  status                        QuoteStatus @default(PENDING_DECISION)
  decidedAt                     DateTime?
  rejectedAuto                  Boolean     @default(false)
  treatmentStartedAt            DateTime?
  completionRequestedAt         DateTime?
  completedAt                   DateTime?
  decisionNotifiedAt            DateTime?
  treatmentStartedNotifiedAt    DateTime?
  completionRequestedNotifiedAt DateTime?
  completedNotifiedAt           DateTime?
```

- [ ] **Step 4: Write the migration**

```sql
-- prisma/migrations/20260902120000_quote_status/migration.sql
-- Every existing Quote row is an unresolved reply from before this lifecycle
-- existed, so PENDING_DECISION is the only honest default: a decision has
-- not been made yet, not "approved" and not "rejected".
CREATE TYPE "QuoteStatus" AS ENUM (
  'PENDING_DECISION',
  'APPROVED',
  'REJECTED',
  'IN_TREATMENT',
  'COMPLETION_REQUESTED',
  'COMPLETED'
);

ALTER TABLE "Quote" ADD COLUMN "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING_DECISION';
ALTER TABLE "Quote" ADD COLUMN "decidedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "rejectedAuto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quote" ADD COLUMN "treatmentStartedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "completionRequestedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "decisionNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "treatmentStartedNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "completionRequestedNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "completedNotifiedAt" TIMESTAMP(3);

CREATE INDEX "Quote_status_idx" ON "Quote"("status");
```

- [ ] **Step 5: Apply the migration and regenerate the client**

Run: `docker start dentalcompare-db && npx prisma migrate dev` (accept the generated name or confirm it matches the folder above), then `npx prisma generate`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- quote-status-schema`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260902120000_quote_status src/server/quote-status-schema.integration.test.ts
git commit -m "feat(quotes): add QuoteStatus as the single source of truth for the decision lifecycle"
```

---

### Task 2: Lock `submitQuote` once a decision exists

**Files:**
- Modify: `src/server/quotes.ts`
- Modify: `src/app/[locale]/quote/[token]/page.tsx`
- Modify: `src/i18n/dictionaries/he.ts`, `src/i18n/dictionaries/en.ts`
- Test: `src/server/quotes.integration.test.ts` (new)

**Interfaces:**
- Consumes: `QuoteStatus` from Task 1.
- Produces: `submitQuote` now returns `{ ok: false, error: t.errors.quoteAlreadyDecided }` when the quote's status is no longer `PENDING_DECISION`. No signature change.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/quotes.integration.test.ts
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { submitQuote as SubmitQuoteFn } from "@/server/quotes";

vi.mock("@/server/quote-notifications", () => ({ sendNewQuoteEmail: async () => true }));

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let submitQuote: typeof SubmitQuoteFn;
const created = { dentistIds: [] as string[], userIds: [] as string[], requestIds: [] as string[] };

async function seed() {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { clerkUserId: `sq_${sfx}`, fullName: "T", email: `sq_${sfx}@example.com` },
  });
  created.userIds.push(user.id);
  const request = await db.request.create({
    data: { userId: user.id, treatmentFileUrl: "https://blob/t", xrayFileUrl: "https://blob/x" },
  });
  created.requestIds.push(request.id);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `sqd_${sfx}@example.com`,
      phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      city: "Tel Aviv",
      address: "1 Main St",
      experienceYears: 5,
    },
  });
  created.dentistIds.push(dentist.id);
  const token = randomUUID();
  const rd = await db.requestDentist.create({
    data: { requestId: request.id, dentistId: dentist.id, quoteToken: token },
  });
  return { rd, token };
}

describe.skipIf(!hasDb)("submitQuote locking", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ submitQuote } = await import("@/server/quotes"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it("refuses to edit a quote the patient has already approved", async () => {
    const { rd, token } = await seed();
    await db.quote.create({
      data: { requestDentistId: rd.id, amountMinor: 100000, currency: "ILS", status: "APPROVED" },
    });

    const result = await submitQuote({ token, amountMajor: 2000 });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.amountMinor).toBe(100000); // unchanged
  });

  it("still allows editing while PENDING_DECISION", async () => {
    const { rd, token } = await seed();
    await db.quote.create({
      data: { requestDentistId: rd.id, amountMinor: 100000, currency: "ILS" },
    });

    const result = await submitQuote({ token, amountMajor: 2000 });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.amountMinor).toBe(200000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/quotes.integration.test.ts`
Expected: FAIL on the first test — today's `submitQuote` has no status guard, so the edit succeeds.

- [ ] **Step 3: Add the guard to `submitQuote`**

In `src/server/quotes.ts`, after the existing `const rd = await db.requestDentist.findUnique(...)` block, extend the `select` to also fetch the status, and add the guard right after `if (!rd) return { ok: false, error: e.invalidLink };`:

```ts
  const rd = await db.requestDentist.findUnique({
    where: { quoteToken: input.token },
    select: {
      id: true,
      quote: { select: { id: true, status: true } },
      dentist: { select: { country: { select: { currency: true } } } },
      request: {
        select: { id: true, user: { select: { fullName: true, email: true, locale: true } } },
      },
    },
  });
  if (!rd) return { ok: false, error: e.invalidLink };
  if (rd.quote && rd.quote.status !== "PENDING_DECISION") {
    return { ok: false, error: e.quoteAlreadyDecided };
  }
```

- [ ] **Step 4: Add the dictionary key**

In `src/i18n/dictionaries/he.ts`, inside the `errors` object, after `clinicNoSubscription`:

```ts
    quoteAlreadyDecided: "המטופל כבר הכריע לגבי הצעה זו — לא ניתן לערוך אותה יותר",
```

In `src/i18n/dictionaries/en.ts`, at the matching position in `errors`:

```ts
    quoteAlreadyDecided: "The patient has already decided on this quote — it can no longer be edited",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/server/quotes.integration.test.ts`
Expected: PASS (both tests)

- [ ] **Step 6: Read-only view on `/quote/[token]` once decided**

In `src/app/[locale]/quote/[token]/page.tsx`, extend the `select` on `rd.quote` to also fetch `status` (add `status: true` alongside the existing quote fields), then replace the unconditional `<QuoteForm .../>` render with:

```tsx
        <div className="mt-6">
          {rd.quote && rd.quote.status !== "PENDING_DECISION" ? (
            <div className="border-border/60 bg-card rounded-2xl border p-5 text-sm">
              <p className="text-foreground font-semibold">
                {t.quoteForm.statusLabel[rd.quote.status]}
              </p>
            </div>
          ) : (
            <QuoteForm
              token={token}
              currencyLabel={currency}
              initial={{
                amount: rd.quote ? toMajor(rd.quote.amountMinor ?? 0, currency) : null,
                note: rd.quote?.note ?? null,
                includes: rd.quote?.includes ?? [],
                tripsRequired: rd.quote?.tripsRequired ?? 1,
                daysPerTrip: rd.quote?.daysPerTrip ?? 1,
                weeksBetweenTrips: rd.quote?.weeksBetweenTrips ?? null,
                warrantyYears: rd.quote?.warrantyYears ?? null,
                warrantyNote: rd.quote?.warrantyNote ?? null,
              }}
            />
          )}
        </div>
```

Add to `he.ts`, inside `quoteForm` (find the object and add):

```ts
    statusLabel: {
      PENDING_DECISION: "ממתין להחלטת המטופל",
      APPROVED: "אושרה — המטופל בחר בכם",
      REJECTED: "המטופל בחר במרפאה אחרת",
      IN_TREATMENT: "בטיפול",
      COMPLETION_REQUESTED: "ממתין לאישור המטופל שהטיפול הסתיים",
      COMPLETED: "הושלם בהצלחה",
    },
```

Add the matching English object (same keys) to `en.ts`.

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/server/quotes.ts src/server/quotes.integration.test.ts "src/app/[locale]/quote/[token]/page.tsx" src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "fix(quotes): a decided quote can no longer be edited by the clinic"
```

---

### Task 3: Patient decisions — `approveQuote` and `rejectQuote`

**Files:**
- Create: `src/server/quote-decisions.ts`
- Create: `src/server/quote-decisions.integration.test.ts`
- Modify: `src/i18n/dictionaries/he.ts`, `src/i18n/dictionaries/en.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`, `audit` from `@/lib/audit`, `ActionResult` pattern from `src/server/request-deletion.ts`.
- Produces: `export type ActionResult = { ok: true } | { ok: false; error: string }`; `export async function approveQuote(requestDentistId: string): Promise<ActionResult>`; `export async function rejectQuote(requestDentistId: string): Promise<ActionResult>`. Later tasks (4, 6) add more exports to this same file.

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/quote-decisions.integration.test.ts
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { approveQuote as ApproveFn, rejectQuote as RejectFn } from "@/server/quote-decisions";

const authState = { clerkUserId: "" };
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: authState.clerkUserId }) }));

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let approveQuote: typeof ApproveFn;
let rejectQuote: typeof RejectFn;
const created = { dentistIds: [] as string[], userIds: [] as string[], requestIds: [] as string[] };

async function seedDentist(sfx: string) {
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `qd_${sfx}@example.com`,
      phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      city: "Tel Aviv",
      address: "1 Main St",
      experienceYears: 5,
    },
  });
  created.dentistIds.push(dentist.id);
  return dentist;
}

async function seedRequestWithTwoQuotes() {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { clerkUserId: `qp_${sfx}`, fullName: "T", email: `qp_${sfx}@example.com` },
  });
  created.userIds.push(user.id);
  authState.clerkUserId = user.clerkUserId;

  const request = await db.request.create({
    data: { userId: user.id, treatmentFileUrl: "https://blob/t", xrayFileUrl: "https://blob/x" },
  });
  created.requestIds.push(request.id);

  const dentistA = await seedDentist(`${sfx}a`);
  const dentistB = await seedDentist(`${sfx}b`);
  const rdA = await db.requestDentist.create({ data: { requestId: request.id, dentistId: dentistA.id } });
  const rdB = await db.requestDentist.create({ data: { requestId: request.id, dentistId: dentistB.id } });
  const quoteA = await db.quote.create({
    data: { requestDentistId: rdA.id, amountMinor: 100000, currency: "ILS" },
  });
  const quoteB = await db.quote.create({
    data: { requestDentistId: rdB.id, amountMinor: 120000, currency: "ILS" },
  });
  return { user, request, rdA, rdB, quoteA, quoteB };
}

describe.skipIf(!hasDb)("patient quote decisions", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ approveQuote, rejectQuote } = await import("@/server/quote-decisions"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it("approving one quote auto-rejects every other open quote in the same request", async () => {
    const { rdA, rdB } = await seedRequestWithTwoQuotes();

    const result = await approveQuote(rdA.id);

    expect(result.ok).toBe(true);
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    const b = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdB.id } });
    expect(a.status).toBe("APPROVED");
    expect(a.decidedAt).not.toBeNull();
    expect(b.status).toBe("REJECTED");
    expect(b.rejectedAuto).toBe(true);
  });

  it("refuses to approve a quote that was already decided", async () => {
    const { rdA } = await seedRequestWithTwoQuotes();
    expect((await approveQuote(rdA.id)).ok).toBe(true);

    const second = await approveQuote(rdA.id);

    expect(second.ok).toBe(false);
  });

  it("rejects a single quote independently, without touching the others", async () => {
    const { rdA, rdB } = await seedRequestWithTwoQuotes();

    const result = await rejectQuote(rdA.id);

    expect(result.ok).toBe(true);
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    const b = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdB.id } });
    expect(a.status).toBe("REJECTED");
    expect(a.rejectedAuto).toBe(false);
    expect(b.status).toBe("PENDING_DECISION");
  });

  it("refuses a decision from someone who doesn't own the request", async () => {
    const { rdA } = await seedRequestWithTwoQuotes();
    authState.clerkUserId = "someone-else-entirely";

    const result = await approveQuote(rdA.id);

    expect(result.ok).toBe(false);
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("PENDING_DECISION");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/server/quote-decisions.integration.test.ts`
Expected: FAIL — `@/server/quote-decisions` does not exist yet.

- [ ] **Step 3: Implement `approveQuote` and `rejectQuote`**

```ts
// src/server/quote-decisions.ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Loads the requestDentist row and confirms the signed-in user owns its request. */
async function loadOwnedRequestDentist(requestDentistId: string) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { error: "signInRequired" as const };

  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) return { error: "userNotSynced" as const };

  const rd = await db.requestDentist.findUnique({
    where: { id: requestDentistId },
    select: {
      id: true,
      requestId: true,
      request: { select: { userId: true } },
      quote: { select: { id: true, status: true } },
    },
  });
  if (!rd || rd.request.userId !== user.id || !rd.quote) return { error: "quoteNotFound" as const };

  return { rd };
}

/**
 * The patient chooses one clinic. Every other quote still awaiting a decision
 * in the same request is rejected in the same transaction — a patient travels
 * to one clinic, not several, so "approved" only ever means one thing.
 */
export async function approveQuote(requestDentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const loaded = await loadOwnedRequestDentist(requestDentistId);
  if ("error" in loaded) return { ok: false, error: e[loaded.error] };
  const { rd } = loaded;

  // Captured before the transaction: exactly the siblings that are about to
  // flip, for the notification step (Task 6) to read back afterward.
  const siblingQuoteIds = (
    await db.quote.findMany({
      where: {
        requestDentist: { requestId: rd.requestId },
        status: "PENDING_DECISION",
        NOT: { id: rd.quote!.id },
      },
      select: { id: true },
    })
  ).map((q) => q.id);

  const approved = await db.$transaction(async (tx) => {
    const result = await tx.quote.updateMany({
      where: { id: rd.quote!.id, status: "PENDING_DECISION" },
      data: { status: "APPROVED", decidedAt: new Date() },
    });
    if (result.count === 0) return false;

    if (siblingQuoteIds.length > 0) {
      await tx.quote.updateMany({
        where: { id: { in: siblingQuoteIds }, status: "PENDING_DECISION" },
        data: { status: "REJECTED", rejectedAuto: true, decidedAt: new Date() },
      });
    }
    return true;
  });

  if (!approved) return { ok: false, error: e.quoteAlreadyDecided };

  await audit({
    actor: "patient",
    action: "quote.approved",
    entity: "Quote",
    entityId: rd.quote!.id,
    metadata: { rejectedSiblings: siblingQuoteIds },
  });

  revalidatePath(`/request/${rd.requestId}`);
  return { ok: true };
}

/** The patient declines one quote on its own, independent of any other. */
export async function rejectQuote(requestDentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const loaded = await loadOwnedRequestDentist(requestDentistId);
  if ("error" in loaded) return { ok: false, error: e[loaded.error] };
  const { rd } = loaded;

  const result = await db.quote.updateMany({
    where: { id: rd.quote!.id, status: "PENDING_DECISION" },
    data: { status: "REJECTED", rejectedAuto: false, decidedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: e.quoteAlreadyDecided };

  await audit({ actor: "patient", action: "quote.rejected", entity: "Quote", entityId: rd.quote!.id });
  revalidatePath(`/request/${rd.requestId}`);
  return { ok: true };
}
```

- [ ] **Step 4: Add the dictionary key `quoteNotFound`**

In `src/i18n/dictionaries/he.ts` `errors`, next to `quoteAlreadyDecided`:

```ts
    quoteNotFound: "לא מצאנו את ההצעה הזו",
```

In `en.ts`, matching:

```ts
    quoteNotFound: "We couldn't find this quote",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/server/quote-decisions.integration.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/server/quote-decisions.ts src/server/quote-decisions.integration.test.ts src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "feat(quotes): the patient can approve one quote or reject any quote"
```

---

### Task 4: Clinic and completion transitions

**Files:**
- Modify: `src/server/quote-decisions.ts`
- Modify: `src/server/quote-decisions.integration.test.ts`
- Modify: `src/i18n/dictionaries/he.ts`, `src/i18n/dictionaries/en.ts`

**Interfaces:**
- Consumes: `getClinicForCurrentUser` from `@/server/clinic-account` (Task 3's file/pattern).
- Produces: `export async function markTreatmentStarted(requestDentistId: string): Promise<ActionResult>`; `export async function requestCompletionConfirmation(requestDentistId: string): Promise<ActionResult>`; `export async function confirmCompletion(requestDentistId: string): Promise<ActionResult>`.

- [ ] **Step 1: Write the failing tests**

Append to `src/server/quote-decisions.integration.test.ts` (extend the imports at the top first):

```ts
import type {
  approveQuote as ApproveFn,
  rejectQuote as RejectFn,
  markTreatmentStarted as MarkTreatmentStartedFn,
  requestCompletionConfirmation as RequestCompletionFn,
  confirmCompletion as ConfirmCompletionFn,
} from "@/server/quote-decisions";
```

Add the three new `let` declarations next to the existing ones, and load them in `beforeAll` alongside `approveQuote`/`rejectQuote`. Then add:

```ts
  it("only the owning clinic can mark treatment started, and only once approved", async () => {
    const { rdA, rdB } = await seedRequestWithTwoQuotes();
    await approveQuote(rdA.id);

    // Not yet approved — refused.
    const tooEarly = await markTreatmentStarted(rdB.id);
    expect(tooEarly.ok).toBe(false);

    const result = await markTreatmentStarted(rdA.id);
    expect(result.ok).toBe(true);
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("IN_TREATMENT");
    expect(a.treatmentStartedAt).not.toBeNull();
  });

  it("walks approved through completion, with the patient confirming the final step", async () => {
    const { rdA, user } = await seedRequestWithTwoQuotes();
    await approveQuote(rdA.id);
    await markTreatmentStarted(rdA.id);

    const requested = await requestCompletionConfirmation(rdA.id);
    expect(requested.ok).toBe(true);
    let a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("COMPLETION_REQUESTED");

    authState.clerkUserId = user.clerkUserId;
    const confirmed = await confirmCompletion(rdA.id);
    expect(confirmed.ok).toBe(true);
    a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("COMPLETED");
    expect(a.completedAt).not.toBeNull();
  });

  it("refuses completion confirmation before the clinic has requested it", async () => {
    const { rdA, user } = await seedRequestWithTwoQuotes();
    await approveQuote(rdA.id);
    await markTreatmentStarted(rdA.id);
    authState.clerkUserId = user.clerkUserId;

    const result = await confirmCompletion(rdA.id);

    expect(result.ok).toBe(false);
  });
```

Note: `markTreatmentStarted`/`requestCompletionConfirmation` need a clinic identity, not a patient one. To keep the seed helper reusable, extend `seedRequestWithTwoQuotes` to also stamp `dentistA.clerkUserId` and switch `authState.clerkUserId` to it right before the clinic-only calls above — add this inside the two new `it` blocks, immediately before calling `markTreatmentStarted`/`requestCompletionConfirmation`:

```ts
    await db.dentist.update({ where: { id: dentistA.id }, data: { clerkUserId: `clinic_${dentistA.id}` } });
    authState.clerkUserId = `clinic_${dentistA.id}`;
```

This requires `seedRequestWithTwoQuotes` to also return `dentistA`. Update its `return` statement to `return { user, request, rdA, rdB, quoteA, quoteB, dentistA };` and destructure `dentistA` at each call site above, inserting the two lines right before each clinic-only action call (and switching `authState.clerkUserId` back to `user.clerkUserId` before any subsequent patient call, as already shown for `confirmCompletion`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/server/quote-decisions.integration.test.ts`
Expected: FAIL — the three new exports don't exist.

- [ ] **Step 3: Implement the three transitions**

Append to `src/server/quote-decisions.ts` (add the import at the top: `import { getClinicForCurrentUser } from "@/server/clinic-account";`):

```ts
/** Loads the requestDentist row and confirms the signed-in account is the clinic it belongs to. */
async function loadOwnedByClinic(requestDentistId: string) {
  const clinic = await getClinicForCurrentUser();
  if (!clinic) return { error: "quoteNotFound" as const };

  const rd = await db.requestDentist.findUnique({
    where: { id: requestDentistId },
    select: {
      id: true,
      requestId: true,
      dentistId: true,
      quote: { select: { id: true, status: true } },
    },
  });
  if (!rd || rd.dentistId !== clinic.id || !rd.quote) return { error: "quoteNotFound" as const };

  return { rd };
}

/** The clinic marks that the patient has begun treatment. Only after APPROVED. */
export async function markTreatmentStarted(requestDentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const loaded = await loadOwnedByClinic(requestDentistId);
  if ("error" in loaded) return { ok: false, error: e[loaded.error] };
  const { rd } = loaded;

  const result = await db.quote.updateMany({
    where: { id: rd.quote!.id, status: "APPROVED" },
    data: { status: "IN_TREATMENT", treatmentStartedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: e.invalidQuoteTransition };

  await audit({ actor: "clinic", action: "quote.treatment_started", entity: "Quote", entityId: rd.quote!.id });
  revalidatePath("/clinics/dashboard");
  return { ok: true };
}

/** The clinic asks the patient to confirm the treatment is done. Only after IN_TREATMENT. */
export async function requestCompletionConfirmation(requestDentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const loaded = await loadOwnedByClinic(requestDentistId);
  if ("error" in loaded) return { ok: false, error: e[loaded.error] };
  const { rd } = loaded;

  const result = await db.quote.updateMany({
    where: { id: rd.quote!.id, status: "IN_TREATMENT" },
    data: { status: "COMPLETION_REQUESTED", completionRequestedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: e.invalidQuoteTransition };

  await audit({
    actor: "clinic",
    action: "quote.completion_requested",
    entity: "Quote",
    entityId: rd.quote!.id,
  });
  revalidatePath("/clinics/dashboard");
  return { ok: true };
}

/**
 * The patient confirms treatment is actually done — a one-sided "completed"
 * from the clinic is not enough, because the clinic is the party whose
 * completion rate benefits from saying so.
 */
export async function confirmCompletion(requestDentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const loaded = await loadOwnedRequestDentist(requestDentistId);
  if ("error" in loaded) return { ok: false, error: e[loaded.error] };
  const { rd } = loaded;

  const result = await db.quote.updateMany({
    where: { id: rd.quote!.id, status: "COMPLETION_REQUESTED" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: e.invalidQuoteTransition };

  await audit({ actor: "patient", action: "quote.completed", entity: "Quote", entityId: rd.quote!.id });
  revalidatePath(`/request/${rd.requestId}`);
  return { ok: true };
}
```

- [ ] **Step 4: Add the dictionary key `invalidQuoteTransition`**

`he.ts` `errors`:

```ts
    invalidQuoteTransition: "אי אפשר לבצע את הפעולה הזו במצב הנוכחי של ההצעה",
```

`en.ts` `errors`:

```ts
    invalidQuoteTransition: "This action isn't available for the quote's current status",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/server/quote-decisions.integration.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 6: Commit**

```bash
git add src/server/quote-decisions.ts src/server/quote-decisions.integration.test.ts src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "feat(quotes): the clinic marks treatment started and requests completion; the patient confirms it"
```

---

### Task 5: Email templates for the five transitions

**Files:**
- Modify: `src/server/emails/templates.ts`
- Modify: `src/i18n/dictionaries/he.ts`, `src/i18n/dictionaries/en.ts`
- Test: `src/server/emails/templates.test.ts` (extend if it exists, else create)

**Interfaces:**
- Consumes: `EmailStrings` (local type in `templates.ts`), `shell()`, `escapeHtml()`, `format()` — all already in that file.
- Produces: `quoteApprovedEmailHtml`, `quoteRejectedEmailHtml`, `treatmentStartedEmailHtml`, `completionRequestedEmailHtml`, `treatmentCompletedEmailHtml` — each `(opts: { locale: Locale; t: EmailStrings; ...; link: string }) => string`.

- [ ] **Step 1: Check for an existing test file and write the failing tests**

Run: `find src/server/emails -iname "*.test.ts"` first. If `templates.test.ts` exists, append the tests below into it (matching its existing import style); otherwise create it importing directly from `@/server/emails/templates`.

```ts
// (append to) src/server/emails/templates.test.ts
import { describe, it, expect } from "vitest";
import {
  quoteApprovedEmailHtml,
  quoteRejectedEmailHtml,
  treatmentStartedEmailHtml,
  completionRequestedEmailHtml,
  treatmentCompletedEmailHtml,
} from "@/server/emails/templates";
import { getDictionary } from "@/i18n/get-dictionary";

describe("quote lifecycle email templates", () => {
  it("renders the clinic's name into the approval email", async () => {
    const t = (await getDictionary("he")).emails;
    const html = quoteApprovedEmailHtml({
      locale: "he",
      t,
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/clinics/dashboard",
    });
    expect(html).toContain("מרפאת בדיקה");
    expect(html).toContain("https://example.com/clinics/dashboard");
  });

  it("renders the rejection email without claiming approval", async () => {
    const t = (await getDictionary("he")).emails;
    const html = quoteRejectedEmailHtml({
      locale: "he",
      t,
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/clinics/dashboard",
    });
    expect(html).toContain("מרפאת בדיקה");
  });

  it("greets the patient by name when one is on file, and omits it otherwise", async () => {
    const t = (await getDictionary("he")).emails;
    const withName = treatmentStartedEmailHtml({
      locale: "he",
      t,
      patientName: "דנה",
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/request/abc",
    });
    expect(withName).toContain("דנה");

    const withoutName = treatmentStartedEmailHtml({
      locale: "he",
      t,
      patientName: null,
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/request/abc",
    });
    expect(withoutName).not.toContain("null");
  });

  it("asks the patient to confirm completion with a working link", async () => {
    const t = (await getDictionary("he")).emails;
    const html = completionRequestedEmailHtml({
      locale: "he",
      t,
      patientName: "דנה",
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/request/abc",
    });
    expect(html).toContain("https://example.com/request/abc");
  });

  it("tells the clinic the patient confirmed completion", async () => {
    const t = (await getDictionary("he")).emails;
    const html = treatmentCompletedEmailHtml({
      locale: "he",
      t,
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/clinics/dashboard",
    });
    expect(html).toContain("מרפאת בדיקה");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/server/emails/templates.test.ts`
Expected: FAIL — the five functions don't exist yet.

- [ ] **Step 3: Add the dictionary strings**

In `src/i18n/dictionaries/he.ts`, inside `emails`, after the existing `newQuoteCta` line:

```ts
    quoteApprovedHeading: "המטופל בחר בכם 🎉",
    quoteApprovedBody: "{patient} אישר/ה את ההצעה שלכם. אפשר ליצור איתם קשר ולתאם המשך.",
    quoteApprovedCta: "לצפייה באזור שלי",
    quoteRejectedHeading: "המטופל בחר במרפאה אחרת",
    quoteRejectedBody: "{patient} החליט/ה להמשיך עם מרפאה אחרת עבור הבקשה הזו.",
    quoteRejectedCta: "לצפייה באזור שלי",
    treatmentStartedHeading: "הטיפול שלך החל",
    treatmentStartedBody: "{clinic} סימנה שהטיפול שלך החל.",
    treatmentStartedCta: "לצפייה בבקשה שלי",
    completionRequestedHeading: "אשר/י שהטיפול הסתיים",
    completionRequestedBody: "{clinic} מדווחת שהטיפול שלך הסתיים. אשר/י כדי לסגור את הבקשה.",
    completionRequestedCta: "אישור סיום הטיפול",
    treatmentCompletedHeading: "המטופל אישר שהטיפול הסתיים",
    treatmentCompletedBody: "{patient} אישר/ה שהטיפול עם {clinic} הסתיים בהצלחה.",
    treatmentCompletedCta: "לצפייה באזור שלי",
```

`{patient}` interpolation needs a fallback the way `newQuoteEmailHtml` handles it (`patientFallback`, already defined). Add the matching English block to `en.ts` (same keys, English copy) directly after the mirrored position.

- [ ] **Step 4: Implement the five template functions**

Append to `src/server/emails/templates.ts`:

```ts
export function quoteApprovedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, clinicName, link } = opts;
  return shell(
    locale,
    `    <h2 style="color: #0f4c4c;">${t.quoteApprovedHeading}</h2>
    <p>${format(t.greeting, { name: escapeHtml(clinicName) })}</p>
    <p>${format(t.quoteApprovedBody, { patient: t.patientFallback })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0f4c4c; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.quoteApprovedCta}
      </a>
    </div>`,
  );
}

export function quoteRejectedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, clinicName, link } = opts;
  return shell(
    locale,
    `    <h2 style="color: #0f4c4c;">${t.quoteRejectedHeading}</h2>
    <p>${format(t.greeting, { name: escapeHtml(clinicName) })}</p>
    <p>${format(t.quoteRejectedBody, { patient: t.patientFallback })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0f4c4c; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.quoteRejectedCta}
      </a>
    </div>`,
  );
}

export function treatmentStartedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  patientName: string | null;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, patientName, clinicName, link } = opts;
  const greeting = patientName
    ? format(t.greeting, { name: escapeHtml(patientName) })
    : t.greetingNoName;
  return shell(
    locale,
    `    <h2 style="color: #0f4c4c;">${t.treatmentStartedHeading}</h2>
    <p>${greeting}</p>
    <p>${format(t.treatmentStartedBody, { clinic: escapeHtml(clinicName) })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0f4c4c; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.treatmentStartedCta}
      </a>
    </div>`,
  );
}

export function completionRequestedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  patientName: string | null;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, patientName, clinicName, link } = opts;
  const greeting = patientName
    ? format(t.greeting, { name: escapeHtml(patientName) })
    : t.greetingNoName;
  return shell(
    locale,
    `    <h2 style="color: #0f4c4c;">${t.completionRequestedHeading}</h2>
    <p>${greeting}</p>
    <p>${format(t.completionRequestedBody, { clinic: escapeHtml(clinicName) })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0f4c4c; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.completionRequestedCta}
      </a>
    </div>`,
  );
}

export function treatmentCompletedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, clinicName, link } = opts;
  return shell(
    locale,
    `    <h2 style="color: #0f4c4c;">${t.treatmentCompletedHeading}</h2>
    <p>${format(t.greeting, { name: escapeHtml(clinicName) })}</p>
    <p>${format(t.treatmentCompletedBody, { patient: t.patientFallback, clinic: escapeHtml(clinicName) })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0f4c4c; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.treatmentCompletedCta}
      </a>
    </div>`,
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/server/emails/templates.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/emails/templates.ts src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts src/server/emails/templates.test.ts
git commit -m "feat(emails): five templates for the quote decision and treatment lifecycle"
```

---

### Task 6: Send the notifications from each transition

**Files:**
- Create: `src/server/quote-decision-notifications.ts`
- Modify: `src/server/quote-decisions.ts`
- Modify: `src/server/quote-decisions.integration.test.ts`

**Interfaces:**
- Consumes: The five template functions from Task 5, `getResend`/`fromAddress` from `@/lib/email`, `appUrl` from `@/lib/app-url`, all five transition functions from Tasks 3–4.
- Produces: `sendQuoteApprovedEmail`, `sendQuoteRejectedEmail`, `sendTreatmentStartedEmail`, `sendCompletionRequestedEmail`, `sendTreatmentCompletedEmail` — each `(args) => Promise<boolean>`, mirroring `sendNewQuoteEmail` in `src/server/quote-notifications.ts`.

- [ ] **Step 1: Write the failing test**

Add to `src/server/quote-decisions.integration.test.ts`, mocking the notification module the same way the licence-gate suite mocks `fulfillRequest`:

```ts
const notified: string[] = [];
vi.mock("@/server/quote-decision-notifications", () => ({
  sendQuoteApprovedEmail: async () => {
    notified.push("approved");
    return true;
  },
  sendQuoteRejectedEmail: async () => {
    notified.push("rejected");
    return true;
  },
  sendTreatmentStartedEmail: async () => {
    notified.push("started");
    return true;
  },
  sendCompletionRequestedEmail: async () => {
    notified.push("completion_requested");
    return true;
  },
  sendTreatmentCompletedEmail: async () => {
    notified.push("completed");
    return true;
  },
}));
```

Add `notified.length = 0;` to the top of the existing `afterEach`. Then add:

```ts
  it("notifies the clinic on approval and stamps decisionNotifiedAt", async () => {
    const { rdA } = await seedRequestWithTwoQuotes();

    await approveQuote(rdA.id);

    expect(notified).toContain("approved");
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.decisionNotifiedAt).not.toBeNull();
  });

  it("notifies every auto-rejected clinic too", async () => {
    const { rdA, rdB } = await seedRequestWithTwoQuotes();

    await approveQuote(rdA.id);

    expect(notified.filter((n) => n === "rejected")).toHaveLength(1);
    const b = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdB.id } });
    expect(b.decisionNotifiedAt).not.toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/server/quote-decisions.integration.test.ts`
Expected: FAIL — `@/server/quote-decision-notifications` does not exist, and no `*NotifiedAt` stamping happens yet.

- [ ] **Step 3: Implement the notification senders**

```ts
// src/server/quote-decision-notifications.ts
import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import {
  quoteApprovedEmailHtml,
  quoteRejectedEmailHtml,
  treatmentStartedEmailHtml,
  completionRequestedEmailHtml,
  treatmentCompletedEmailHtml,
} from "@/server/emails/templates";
import { appUrl } from "@/lib/app-url";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

async function send(to: string, subject: string, html: string, label: string): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({ from: fromAddress(), to, subject, html });
    if (error) {
      console.error(`Resend error for ${label} ${to}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send ${label} email to ${to}:`, err);
    return false;
  }
}

export async function sendQuoteApprovedEmail(args: {
  to: string;
  clinicName: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const html = quoteApprovedEmailHtml({
    locale: args.locale,
    t,
    clinicName: args.clinicName,
    link: `${appUrl()}/${args.locale}/clinics/dashboard`,
  });
  return send(args.to, t.subjectNewQuote, html, "quote-approved");
}

export async function sendQuoteRejectedEmail(args: {
  to: string;
  clinicName: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const html = quoteRejectedEmailHtml({
    locale: args.locale,
    t,
    clinicName: args.clinicName,
    link: `${appUrl()}/${args.locale}/clinics/dashboard`,
  });
  return send(args.to, t.quoteRejectedHeading, html, "quote-rejected");
}

export async function sendTreatmentStartedEmail(args: {
  to: string;
  patientName: string | null;
  clinicName: string;
  requestId: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const html = treatmentStartedEmailHtml({
    locale: args.locale,
    t,
    patientName: args.patientName,
    clinicName: args.clinicName,
    link: `${appUrl()}/${args.locale}/request/${args.requestId}`,
  });
  return send(args.to, t.treatmentStartedHeading, html, "treatment-started");
}

export async function sendCompletionRequestedEmail(args: {
  to: string;
  patientName: string | null;
  clinicName: string;
  requestId: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const html = completionRequestedEmailHtml({
    locale: args.locale,
    t,
    patientName: args.patientName,
    clinicName: args.clinicName,
    link: `${appUrl()}/${args.locale}/request/${args.requestId}`,
  });
  return send(args.to, t.completionRequestedHeading, html, "completion-requested");
}

export async function sendTreatmentCompletedEmail(args: {
  to: string;
  clinicName: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const html = treatmentCompletedEmailHtml({
    locale: args.locale,
    t,
    clinicName: args.clinicName,
    link: `${appUrl()}/${args.locale}/clinics/dashboard`,
  });
  return send(args.to, t.treatmentCompletedHeading, html, "treatment-completed");
}
```

- [ ] **Step 4: Wire the senders into `quote-decisions.ts`**

Add the import at the top: `import { asLocale } from "@/i18n/config";` and
`import { sendQuoteApprovedEmail, sendQuoteRejectedEmail, sendTreatmentStartedEmail, sendCompletionRequestedEmail, sendTreatmentCompletedEmail } from "@/server/quote-decision-notifications";`.

Change `loadOwnedRequestDentist`'s `select` to also pull the recipient contact fields it will need to hand back:

```ts
    select: {
      id: true,
      requestId: true,
      request: { select: { userId: true, user: { select: { fullName: true, locale: true } } } },
      dentist: { select: { id: true, email: true, locale: true, clinicName: true } },
      quote: { select: { id: true, status: true } },
    },
```

And `loadOwnedByClinic`'s `select` to also pull the patient's contact fields:

```ts
    select: {
      id: true,
      requestId: true,
      dentistId: true,
      dentist: { select: { clinicName: true } },
      request: {
        select: { id: true, user: { select: { fullName: true, email: true, locale: true } } },
      },
      quote: { select: { id: true, status: true } },
    },
```

In `approveQuote`, after the `audit(...)` call and before `revalidatePath`, look up the auto-rejected siblings' clinic contact info by their captured quote ids (`RequestDentist` has no `quoteId` field, so the query goes through the `quote` relation), then send and stamp both sides:

```ts
  const rejectedDentists =
    siblingQuoteIds.length > 0
      ? await db.requestDentist.findMany({
          where: { quote: { id: { in: siblingQuoteIds } } },
          select: {
            quote: { select: { id: true } },
            dentist: { select: { email: true, locale: true, clinicName: true } },
          },
        })
      : [];

  if (
    await sendQuoteApprovedEmail({
      to: rd.dentist.email,
      clinicName: rd.dentist.clinicName,
      locale: asLocale(rd.dentist.locale),
    })
  ) {
    await db.quote.update({ where: { id: rd.quote!.id }, data: { decisionNotifiedAt: new Date() } });
  }

  for (const sibling of rejectedDentists) {
    if (!sibling.quote) continue;
    const sent = await sendQuoteRejectedEmail({
      to: sibling.dentist.email,
      clinicName: sibling.dentist.clinicName,
      locale: asLocale(sibling.dentist.locale),
    });
    if (sent) {
      await db.quote.update({ where: { id: sibling.quote.id }, data: { decisionNotifiedAt: new Date() } });
    }
  }
```

Place this block right after the `audit(...)` call, before `revalidatePath`.

In `rejectQuote`, after its `audit(...)` call:

```ts
  if (
    await sendQuoteRejectedEmail({
      to: rd.dentist.email,
      clinicName: rd.dentist.clinicName,
      locale: asLocale(rd.dentist.locale),
    })
  ) {
    await db.quote.update({ where: { id: rd.quote!.id }, data: { decisionNotifiedAt: new Date() } });
  }
```

In `markTreatmentStarted`, after its `audit(...)` call (uses `rd.request.user` from `loadOwnedByClinic`'s updated select):

```ts
  if (rd.request.user) {
    const sent = await sendTreatmentStartedEmail({
      to: rd.request.user.email,
      patientName: rd.request.user.fullName,
      clinicName: rd.dentist.clinicName,
      requestId: rd.requestId,
      locale: asLocale(rd.request.user.locale),
    });
    if (sent) {
      await db.quote.update({ where: { id: rd.quote!.id }, data: { treatmentStartedNotifiedAt: new Date() } });
    }
  }
```

In `requestCompletionConfirmation`, same shape, after its `audit(...)`:

```ts
  if (rd.request.user) {
    const sent = await sendCompletionRequestedEmail({
      to: rd.request.user.email,
      patientName: rd.request.user.fullName,
      clinicName: rd.dentist.clinicName,
      requestId: rd.requestId,
      locale: asLocale(rd.request.user.locale),
    });
    if (sent) {
      await db.quote.update({
        where: { id: rd.quote!.id },
        data: { completionRequestedNotifiedAt: new Date() },
      });
    }
  }
```

In `confirmCompletion`, after its `audit(...)` (uses `rd.dentist` from `loadOwnedRequestDentist`'s updated select):

```ts
  if (
    await sendTreatmentCompletedEmail({
      to: rd.dentist.email,
      clinicName: rd.dentist.clinicName,
      locale: asLocale(rd.dentist.locale),
    })
  ) {
    await db.quote.update({ where: { id: rd.quote!.id }, data: { completedNotifiedAt: new Date() } });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/server/quote-decisions.integration.test.ts`
Expected: PASS (all 9 tests)

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/server/quote-decision-notifications.ts src/server/quote-decisions.ts src/server/quote-decisions.integration.test.ts
git commit -m "feat(emails): every quote transition notifies the other side"
```

---

### Task 7: Retry cron for the four new notification columns

**Files:**
- Modify: `src/app/api/cron/retry-notifications/route.ts`

**Interfaces:**
- Consumes: The five `send*` functions from Task 6.
- Produces: No new exports — extends the existing `GET` handler's coverage.

- [ ] **Step 1: Write the failing test**

Check first whether a test file already covers this route: `find src/app/api/cron -iname "*.test.ts"`. If `retry-notifications` has no test yet, create one; if it does, extend it. New/extended test:

```ts
// src/app/api/cron/retry-notifications/route.test.ts (create if absent)
import { describe, it, expect, vi, beforeEach } from "vitest";

const sent: string[] = [];
vi.mock("@/server/quote-notifications", () => ({
  sendNewQuoteEmail: async () => {
    sent.push("new_quote");
    return true;
  },
}));
vi.mock("@/server/quote-decision-notifications", () => ({
  sendQuoteApprovedEmail: async () => {
    sent.push("approved");
    return true;
  },
  sendQuoteRejectedEmail: async () => {
    sent.push("rejected");
    return true;
  },
  sendTreatmentStartedEmail: async () => {
    sent.push("started");
    return true;
  },
  sendCompletionRequestedEmail: async () => {
    sent.push("completion_requested");
    return true;
  },
  sendTreatmentCompletedEmail: async () => {
    sent.push("completed");
    return true;
  },
}));

const dbMock = {
  quote: {
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
  },
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("retry-notifications cron", () => {
  beforeEach(() => {
    sent.length = 0;
    vi.clearAllMocks();
    dbMock.quote.findMany.mockResolvedValue([]);
    process.env.CRON_SECRET = "test-secret";
  });

  it("rejects a request without the correct bearer token", async () => {
    const { GET } = await import("@/app/api/cron/retry-notifications/route");
    const res = await GET(new Request("http://x", { headers: { authorization: "Bearer wrong" } }));
    expect(res.status).toBe(401);
  });

  it("queries all five new notification columns, not just patientNotifiedAt", async () => {
    const { GET } = await import("@/app/api/cron/retry-notifications/route");
    await GET(new Request("http://x", { headers: { authorization: "Bearer test-secret" } }));

    const queriedFields = dbMock.quote.findMany.mock.calls.map((c) => Object.keys(c[0].where));
    const flat = queriedFields.flat();
    for (const field of [
      "patientNotifiedAt",
      "decisionNotifiedAt",
      "treatmentStartedNotifiedAt",
      "completionRequestedNotifiedAt",
      "completedNotifiedAt",
    ]) {
      expect(flat).toContain(field);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- retry-notifications`
Expected: FAIL — today's route only ever queries `patientNotifiedAt`.

- [ ] **Step 3: Extend the cron handler**

Replace the body of `src/app/api/cron/retry-notifications/route.ts` from the `const cutoff = ...` line onward with:

```ts
import { asLocale } from "@/i18n/config";
import {
  sendQuoteApprovedEmail,
  sendQuoteRejectedEmail,
  sendTreatmentStartedEmail,
  sendCompletionRequestedEmail,
  sendTreatmentCompletedEmail,
} from "@/server/quote-decision-notifications";

// ... (keep the existing imports, auth check, and ONE_HOUR_MS as-is)

  const cutoff = new Date(Date.now() - ONE_HOUR_MS);
  let sent = 0;

  // 1. New-quote notification to the patient (existing behavior, unchanged).
  const stuckNewQuote = await db.quote.findMany({
    where: {
      patientNotifiedAt: null,
      createdAt: { lt: cutoff },
      requestDentist: { request: { userId: { not: null } } },
    },
    select: {
      id: true,
      requestDentist: {
        select: {
          request: { select: { id: true, user: { select: { fullName: true, email: true, locale: true } } } },
        },
      },
    },
  });
  for (const q of stuckNewQuote) {
    const user = q.requestDentist.request.user;
    if (!user) continue;
    const ok = await sendNewQuoteEmail({
      to: user.email,
      patientName: user.fullName,
      requestId: q.requestDentist.request.id,
      locale: asLocale(user.locale),
    });
    if (ok) {
      await db.quote.update({ where: { id: q.id }, data: { patientNotifiedAt: new Date() } });
      sent += 1;
    }
  }

  // 2. Decision notification (approved or rejected) to the clinic.
  const stuckDecision = await db.quote.findMany({
    where: {
      decisionNotifiedAt: null,
      decidedAt: { lt: cutoff },
      status: { in: ["APPROVED", "REJECTED"] },
    },
    select: {
      id: true,
      status: true,
      requestDentist: { select: { dentist: { select: { email: true, locale: true, clinicName: true } } } },
    },
  });
  for (const q of stuckDecision) {
    const dentist = q.requestDentist.dentist;
    const send = q.status === "APPROVED" ? sendQuoteApprovedEmail : sendQuoteRejectedEmail;
    const ok = await send({ to: dentist.email, clinicName: dentist.clinicName, locale: asLocale(dentist.locale) });
    if (ok) {
      await db.quote.update({ where: { id: q.id }, data: { decisionNotifiedAt: new Date() } });
      sent += 1;
    }
  }

  // 3. Treatment-started notification to the patient.
  const stuckStarted = await db.quote.findMany({
    where: { treatmentStartedNotifiedAt: null, treatmentStartedAt: { lt: cutoff } },
    select: {
      id: true,
      requestDentist: {
        select: {
          requestId: true,
          dentist: { select: { clinicName: true } },
          request: { select: { user: { select: { fullName: true, email: true, locale: true } } } },
        },
      },
    },
  });
  for (const q of stuckStarted) {
    const user = q.requestDentist.request.user;
    if (!user) continue;
    const ok = await sendTreatmentStartedEmail({
      to: user.email,
      patientName: user.fullName,
      clinicName: q.requestDentist.dentist.clinicName,
      requestId: q.requestDentist.requestId,
      locale: asLocale(user.locale),
    });
    if (ok) {
      await db.quote.update({ where: { id: q.id }, data: { treatmentStartedNotifiedAt: new Date() } });
      sent += 1;
    }
  }

  // 4. Completion-requested notification to the patient.
  const stuckCompletionRequested = await db.quote.findMany({
    where: { completionRequestedNotifiedAt: null, completionRequestedAt: { lt: cutoff } },
    select: {
      id: true,
      requestDentist: {
        select: {
          requestId: true,
          dentist: { select: { clinicName: true } },
          request: { select: { user: { select: { fullName: true, email: true, locale: true } } } },
        },
      },
    },
  });
  for (const q of stuckCompletionRequested) {
    const user = q.requestDentist.request.user;
    if (!user) continue;
    const ok = await sendCompletionRequestedEmail({
      to: user.email,
      patientName: user.fullName,
      clinicName: q.requestDentist.dentist.clinicName,
      requestId: q.requestDentist.requestId,
      locale: asLocale(user.locale),
    });
    if (ok) {
      await db.quote.update({ where: { id: q.id }, data: { completionRequestedNotifiedAt: new Date() } });
      sent += 1;
    }
  }

  // 5. Completed notification to the clinic.
  const stuckCompleted = await db.quote.findMany({
    where: { completedNotifiedAt: null, completedAt: { lt: cutoff } },
    select: {
      id: true,
      requestDentist: { select: { dentist: { select: { email: true, locale: true, clinicName: true } } } },
    },
  });
  for (const q of stuckCompleted) {
    const dentist = q.requestDentist.dentist;
    const ok = await sendTreatmentCompletedEmail({
      to: dentist.email,
      clinicName: dentist.clinicName,
      locale: asLocale(dentist.locale),
    });
    if (ok) {
      await db.quote.update({ where: { id: q.id }, data: { completedNotifiedAt: new Date() } });
      sent += 1;
    }
  }

  return NextResponse.json({
    checked:
      stuckNewQuote.length +
      stuckDecision.length +
      stuckStarted.length +
      stuckCompletionRequested.length +
      stuckCompleted.length,
    sent,
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- retry-notifications`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/retry-notifications/route.ts src/app/api/cron/retry-notifications/route.test.ts
git commit -m "fix(cron): the daily retry now covers all five quote-lifecycle notifications, not just the first one"
```

---

### Task 8: Patient UI — approve/reject/confirm buttons on the request page

**Files:**
- Modify: `src/lib/quotes.ts`
- Modify: `src/app/[locale]/request/[id]/page.tsx`
- Create: `src/components/request/quote-decision-buttons.tsx`
- Modify: `src/components/request/quote-comparison.tsx`
- Modify: `src/i18n/dictionaries/he.ts`, `src/i18n/dictionaries/en.ts`

**Interfaces:**
- Consumes: `approveQuote`, `rejectQuote`, `confirmCompletion` from `@/server/quote-decisions` (Tasks 3–4); `QuoteStatus` from `@/generated/prisma/enums`.
- Produces: `QuoteRow` gains `requestDentistId: string` and `status: QuoteStatus | null`. `QuoteDecisionButtons({ requestDentistId, status }: { requestDentistId: string; status: QuoteStatus })` — client component.

- [ ] **Step 1: Extend `QuoteRow` and the request-detail query**

In `src/lib/quotes.ts`, add two fields to `QuoteRow`:

```ts
export type QuoteRow = {
  dentistId: string;
  requestDentistId: string;
  status: QuoteStatus | null; // null when no Quote exists yet
  dentistName: string;
  // ...rest unchanged
};
```

Add the import at the top: `import type { QuoteStatus } from "@/generated/prisma/enums";`.

In `src/app/[locale]/request/[id]/page.tsx`, add `id: true` and `quote: { select: { ..., status: true } }` to the `requestDentists.select` block (add `id: true` as a sibling of `emailSent`/`sentAt`, and `status: true` inside the existing `quote.select`). Then in the `quoteRows` mapping, add:

```ts
    requestDentistId: rd.id,
    status: rd.quote?.status ?? null,
```

(alongside the existing fields in that object literal).

- [ ] **Step 2: Add the dictionary keys**

In `he.ts` `requestDetail`, after `sent: "נשלח",`:

```ts
    quoteActionApprove: "אשר הצעה זו",
    quoteActionReject: "דחה",
    quoteActionConfirmComplete: "אשר שהטיפול הסתיים",
    quoteStatusApproved: "אישרת",
    quoteStatusRejected: "נדחתה",
    quoteStatusInTreatment: "בטיפול",
    quoteStatusCompletionRequested: "ממתין לאישורך",
    quoteStatusCompleted: "הסתיים בהצלחה",
    quoteActionFailed: "הפעולה נכשלה. נסו שוב.",
```

Add the matching English keys to `en.ts`.

- [ ] **Step 3: Write `QuoteDecisionButtons`**

```tsx
// src/components/request/quote-decision-buttons.tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import { approveQuote, rejectQuote, confirmCompletion } from "@/server/quote-decisions";
import type { QuoteStatus } from "@/generated/prisma/enums";

/**
 * The patient's per-quote action, one row of the comparison table at a time.
 *
 * Every button here fires a final, non-reversible transition (see the design
 * doc, §1.4) — there is deliberately no "undo" affordance.
 */
export function QuoteDecisionButtons({
  requestDentistId,
  status,
}: {
  requestDentistId: string;
  status: QuoteStatus;
}) {
  const t = useT().requestDetail;
  const [isPending, startTransition] = useTransition();

  const run = (action: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action(requestDentistId);
      if (!result.ok) {
        toast.error(result.error ?? t.quoteActionFailed);
      }
    });
  };

  if (status === "PENDING_DECISION") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(approveQuote)}
          className="bg-teal-deep text-cream rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {t.quoteActionApprove}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(rejectQuote)}
          className="text-coral border-coral/40 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {t.quoteActionReject}
        </button>
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <span className="text-teal-deep inline-flex items-center gap-1 text-xs font-semibold">
        <CheckCircle2 className="h-3.5 w-3.5" /> {t.quoteStatusApproved}
      </span>
    );
  }

  if (status === "REJECTED") {
    return <span className="text-muted-foreground text-xs">{t.quoteStatusRejected}</span>;
  }

  if (status === "IN_TREATMENT") {
    return <span className="text-teal-deep text-xs font-semibold">{t.quoteStatusInTreatment}</span>;
  }

  if (status === "COMPLETION_REQUESTED") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(confirmCompletion)}
        className="bg-teal-deep text-cream rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {t.quoteActionConfirmComplete}
      </button>
    );
  }

  // COMPLETED
  return (
    <span className="text-teal-deep inline-flex items-center gap-1 text-xs font-semibold">
      <CheckCircle2 className="h-3.5 w-3.5" /> {t.quoteStatusCompleted}
    </span>
  );
}
```

- [ ] **Step 4: Add a status/action row to `QuoteComparison`**

In `src/components/request/quote-comparison.tsx`, import the new component (`import { QuoteDecisionButtons } from "./quote-decision-buttons";`) and add one more entry to the `rows` array, right after the `d.rowClinic` header row is defined — i.e. as the **first** entry in the `rows` array (before `rowPrice`), so the decision is the first thing seen:

```ts
  const rows: Array<{ label: string; cell: (q: QuoteRow) => React.ReactNode }> = [
    {
      label: d.rowStatus,
      cell: (q) =>
        q.status ? (
          <QuoteDecisionButtons requestDentistId={q.requestDentistId} status={q.status} />
        ) : (
          <span className="text-muted-foreground text-xs">{d.awaitingQuote}</span>
        ),
    },
    { label: d.rowPrice, cell: priceCell },
    // ...rest unchanged
```

Add `rowStatus: "סטטוס"` to `he.ts` `requestDetail` (near `rowClinic`) and `rowStatus: "Status"` to `en.ts`.

- [ ] **Step 5: Verify manually and typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors. (No new automated test in this step — the underlying actions are already covered by `quote-decisions.integration.test.ts`; this step is wiring. Manual verification happens in the end-to-end pass already tracked in `docs/HANDOFF.md`.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/quotes.ts "src/app/[locale]/request/[id]/page.tsx" src/components/request/quote-decision-buttons.tsx src/components/request/quote-comparison.tsx src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "feat(patient): approve, reject, and confirm-completion buttons on the comparison table"
```

---

### Task 9: Clinic UI — status and action buttons on the dashboard

**Files:**
- Modify: `src/app/[locale]/clinics/dashboard/page.tsx`
- Create: `src/components/clinics/quote-status-actions.tsx`
- Modify: `src/i18n/dictionaries/he.ts`, `src/i18n/dictionaries/en.ts`

**Interfaces:**
- Consumes: `markTreatmentStarted`, `requestCompletionConfirmation` from `@/server/quote-decisions`; `QuoteStatus` from `@/generated/prisma/enums`.
- Produces: `QuoteStatusActions({ requestDentistId, status }: { requestDentistId: string; status: QuoteStatus | null })` — client component, replaces the current inline quoted/awaiting badge.

- [ ] **Step 1: Add the dictionary keys**

In `he.ts` `clinics`, after `dashLeadAwaiting: "ממתינה לתמחור",`:

```ts
    dashLeadPending: "נשלחה, ממתין לתשובה",
    dashLeadApproved: "אושרה ✓",
    dashLeadRejected: "נדחתה",
    dashLeadInTreatment: "בטיפול",
    dashLeadCompletionRequested: "ממתין לאישור המטופל",
    dashLeadCompleted: "הושלם בהצלחה ✓",
    dashLeadMarkStarted: "סמן שהטיפול החל",
    dashLeadRequestCompletion: "בקש אישור סיום",
    dashLeadActionFailed: "הפעולה נכשלה. נסו שוב.",
```

Add the matching English keys to `en.ts`.

- [ ] **Step 2: Write `QuoteStatusActions`**

```tsx
// src/components/clinics/quote-status-actions.tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { markTreatmentStarted, requestCompletionConfirmation } from "@/server/quote-decisions";
import type { QuoteStatus } from "@/generated/prisma/enums";

export function QuoteStatusActions({
  requestDentistId,
  status,
}: {
  requestDentistId: string;
  status: QuoteStatus | null;
}) {
  const t = useT().clinics;
  const [isPending, startTransition] = useTransition();

  const run = (action: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action(requestDentistId);
      if (!result.ok) toast.error(result.error ?? t.dashLeadActionFailed);
    });
  };

  if (status === null) return <span className="text-xs font-medium text-amber-700">{t.dashLeadAwaiting}</span>;

  switch (status) {
    case "PENDING_DECISION":
      return <span className="text-teal-deep text-xs font-medium">{t.dashLeadPending}</span>;
    case "APPROVED":
      return (
        <div className="ms-auto flex items-center gap-2">
          <span className="text-teal-deep text-xs font-semibold">{t.dashLeadApproved}</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(markTreatmentStarted)}
            className="bg-teal-deep text-cream rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50"
          >
            {t.dashLeadMarkStarted}
          </button>
        </div>
      );
    case "REJECTED":
      return <span className="text-muted-foreground text-xs">{t.dashLeadRejected}</span>;
    case "IN_TREATMENT":
      return (
        <div className="ms-auto flex items-center gap-2">
          <span className="text-teal-deep text-xs font-semibold">{t.dashLeadInTreatment}</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(requestCompletionConfirmation)}
            className="bg-teal-deep text-cream rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50"
          >
            {t.dashLeadRequestCompletion}
          </button>
        </div>
      );
    case "COMPLETION_REQUESTED":
      return <span className="text-xs font-medium text-amber-700">{t.dashLeadCompletionRequested}</span>;
    case "COMPLETED":
      return <span className="text-teal-deep text-xs font-semibold">{t.dashLeadCompleted}</span>;
  }
}
```

- [ ] **Step 3: Wire it into the dashboard**

In `src/app/[locale]/clinics/dashboard/page.tsx`:

1. Import: `import { QuoteStatusActions } from "@/components/clinics/quote-status-actions";`
2. Extend the `leads` query's `quote` select from `{ select: { id: true } }` to `{ select: { id: true, status: true } }`.
3. Replace the existing lead-row status span —

```tsx
                <span
                  className={
                    lead.quote
                      ? "text-teal-deep text-xs font-medium"
                      : "text-xs font-medium text-amber-700"
                  }
                >
                  {lead.quote ? t.clinics.dashLeadQuoted : t.clinics.dashLeadAwaiting}
                </span>
```

— with:

```tsx
                <QuoteStatusActions requestDentistId={lead.id} status={lead.quote?.status ?? null} />
```

Leave the existing `dashLeadOpen` link to `/quote/[token]` as-is (it already becomes read-only once decided, from Task 2).

- [ ] **Step 4: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/clinics/dashboard/page.tsx" src/components/clinics/quote-status-actions.tsx src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "feat(clinics): the dashboard shows full quote status and lets the clinic advance it"
```

---

## After Task 9

Update `docs/HANDOFF.md` with what landed and add the manual end-to-end pass for this feature (approve one of several quotes, confirm the others auto-reject, mark treatment started, request completion, confirm as the patient, verify every email arrived) to the existing list of pending manual passes — it belongs in the same browser session as the others already queued there.
