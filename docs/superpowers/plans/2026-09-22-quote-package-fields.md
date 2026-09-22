# Quote Package Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a clinic's quote describe a real treatment/travel package — how many nights of accommodation it includes, and how many separate clinic visits (sessions) the treatment itself needs — instead of the accommodation being a bare yes/no checkbox and trips being the only "how many times" dimension.

**Architecture:** Two new structured dimensions on the existing `Quote` model, following the exact pattern `tripsRequired`/`daysPerTrip`/`weeksBetweenTrips` already established: `accommodationNights` (meaningful only when `includes` contains `"ACCOMMODATION"`, forced `null` otherwise) and `sessionsRequired`/`weeksBetweenSessions` (a treatment-visit count independent of travel — relevant to a local patient with zero trips too). No new tables, no per-component pricing breakdown, no change to how `AIRPORT_TRANSFER` works. Threaded through the same three touchpoints every other quote field already goes through: the clinic's quote-submission form, the `submitQuote` server action, and the patient-facing comparison table.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 7 + Postgres, Vitest, bilingual dictionaries (`src/i18n/dictionaries/{he,en}.ts`).

**Spec:** No separate spec file — this is a bounded extension of the existing quote-package brainstorm (chat-approved 2026-09-22), not an architectural change. This plan document is the spec.

## Global Constraints

- Every new nullable/optional numeric field follows the existing "two fields can never contradict each other" rule: a dependent field (`accommodationNights`, `weeksBetweenSessions`) is forced to `null` server-side whenever its trigger condition doesn't hold, regardless of what the client sent.
- All clamping goes through the existing `clampInt(value, fallback, min, max)` helper already defined in `src/server/quotes.ts` — do not write a second copy.
- Migrations are additive only — no column drops, no type changes to existing columns.
- `DATABASE_URL` is not configured in this environment (Docker Desktop is not running locally), so `describe.skipIf(!hasDb)` integration tests will report as skipped, not passing, when run locally. That is expected — the existing test suite already has this shape. Every new integration test still gets written and must be structurally correct; it will run for real in CI (which does have a database) and at review time.
- This codebase has no React component-testing infrastructure (no `@testing-library/react`, no jsdom config in `vitest.config.ts`) — do not add one as part of this plan. UI changes (`quote-form.tsx`, `quote-comparison.tsx`) are verified by `tsc` + manual reasoning, consistent with how `weeksBetweenTrips`/`warrantyYears` shipped without component tests.
- Hebrew and English dictionary files must be edited together in the same task — never ship a key in one language only.

---

### Task 1: Schema — add the three new `Quote` columns

**Files:**
- Modify: `prisma/schema.prisma` (the `Quote` model, around line 313-325)
- Create: `prisma/migrations/20260922120000_quote_package_fields/migration.sql`

**Interfaces:**
- Consumes: nothing (schema-only change).
- Produces: `Quote.accommodationNights: number | null`, `Quote.sessionsRequired: number` (default `1`), `Quote.weeksBetweenSessions: number | null` — the Prisma Client types every later task reads from `db.quote`.

- [ ] **Step 1: Edit `prisma/schema.prisma`**

Find this block inside `model Quote`:

```prisma
  /// What the price covers. Canonical keys (QUOTE_INCLUSIONS); labels live in
  /// the i18n layer so they translate with the rest of the site.
  includes                      String[]
  /// How many separate trips abroad the treatment needs. Implants routinely
  /// need two, months apart — the single biggest hidden cost.
  tripsRequired                 Int         @default(1)
  daysPerTrip                   Int         @default(1)
  /// Null when one trip is enough.
  weeksBetweenTrips             Int?
  /// The dominant fear for a dental-tourism patient: what happens when
  /// something goes wrong after they have flown home.
  warrantyYears                 Int?
  warrantyNote                  String?     @db.Text
```

Replace it with:

```prisma
  /// What the price covers. Canonical keys (QUOTE_INCLUSIONS); labels live in
  /// the i18n layer so they translate with the rest of the site.
  includes                      String[]
  /// How many nights of accommodation the price covers. Meaningful only when
  /// `includes` contains "ACCOMMODATION" — forced null otherwise, the same
  /// rule `weeksBetweenTrips` already follows relative to `tripsRequired`.
  accommodationNights           Int?
  /// How many separate trips abroad the treatment needs. Implants routinely
  /// need two, months apart — the single biggest hidden cost.
  tripsRequired                 Int         @default(1)
  daysPerTrip                   Int         @default(1)
  /// Null when one trip is enough.
  weeksBetweenTrips             Int?
  /// How many separate times the patient must physically be at the clinic —
  /// independent of tripsRequired. A local patient has sessions with zero
  /// trips; an implant abroad needs both a trip count and a session count,
  /// and they are not always equal (a clinic could schedule two sessions
  /// inside one trip).
  sessionsRequired               Int         @default(1)
  /// Null when one session is enough. Forced null otherwise, same rule as
  /// weeksBetweenTrips.
  weeksBetweenSessions           Int?
  /// The dominant fear for a dental-tourism patient: what happens when
  /// something goes wrong after they have flown home.
  warrantyYears                 Int?
  warrantyNote                  String?     @db.Text
```

- [ ] **Step 2: Write the migration file**

Create `prisma/migrations/20260922120000_quote_package_fields/migration.sql`:

```sql
-- Package-pricing fields on Quote: how many nights of accommodation the
-- price covers (meaningful only when `includes` contains "ACCOMMODATION"),
-- and how many separate clinic visits the treatment itself needs,
-- independent of travel (tripsRequired). All additive — existing rows get
-- the same one-trip/one-session default tripsRequired already uses.
ALTER TABLE "Quote" ADD COLUMN "accommodationNights" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "sessionsRequired" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Quote" ADD COLUMN "weeksBetweenSessions" INTEGER;
```

- [ ] **Step 3: Regenerate the Prisma Client**

Run: `npx prisma generate`
Expected: completes without error, no database connection required for this step. `src/generated/prisma/models/Quote.ts` now lists the three new fields.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: fails elsewhere (later tasks aren't written yet) referencing the new fields is fine, but there must be **no** error about the schema/migration files themselves and no error inside `src/generated/prisma/**`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260922120000_quote_package_fields/migration.sql
git commit -m "feat(quote): add accommodationNights and sessions fields to Quote schema"
```

---

### Task 2: Server — validate and persist the new fields in `submitQuote`

**Files:**
- Modify: `src/server/quotes.ts`
- Modify: `src/server/quotes.integration.test.ts`

**Interfaces:**
- Consumes: `Quote.accommodationNights`/`sessionsRequired`/`weeksBetweenSessions` from Task 1; the existing `clampInt` helper already in this file.
- Produces: `submitQuote` accepts and persists `accommodationNights?: number | null`, `sessionsRequired?: number`, `weeksBetweenSessions?: number | null` on its `input` object — the exact shape Task 4's form calls.

- [ ] **Step 1: Write the failing integration tests**

Add this `describe` block to the end of `src/server/quotes.integration.test.ts`, inside the existing file (after the closing `});` of `describe.skipIf(!hasDb)("submitQuote locking", ...)`, at the same indentation level — i.e. a sibling top-level `describe`:

```ts
describe.skipIf(!hasDb)("submitQuote package fields", () => {
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

  it("forces accommodationNights to null when ACCOMMODATION is not included", async () => {
    const { rd, token } = await seed();

    const result = await submitQuote({
      token,
      amountMajor: 2000,
      includes: ["XRAYS"],
      accommodationNights: 5,
    });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.accommodationNights).toBeNull();
  });

  it("saves accommodationNights, clamped to 1-60, when ACCOMMODATION is included", async () => {
    const { rd, token } = await seed();

    const result = await submitQuote({
      token,
      amountMajor: 2000,
      includes: ["ACCOMMODATION"],
      accommodationNights: 500,
    });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.accommodationNights).toBe(60);
  });

  it("defaults accommodationNights to 1 when ACCOMMODATION is included but no count was sent", async () => {
    const { rd, token } = await seed();

    const result = await submitQuote({
      token,
      amountMajor: 2000,
      includes: ["ACCOMMODATION"],
    });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.accommodationNights).toBe(1);
  });

  it("defaults sessionsRequired to 1 and forces weeksBetweenSessions to null for a single session", async () => {
    const { rd, token } = await seed();

    const result = await submitQuote({ token, amountMajor: 2000 });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.sessionsRequired).toBe(1);
    expect(quote.weeksBetweenSessions).toBeNull();
  });

  it("saves sessionsRequired and weeksBetweenSessions, both clamped, for a multi-session quote", async () => {
    const { rd, token } = await seed();

    const result = await submitQuote({
      token,
      amountMajor: 2000,
      sessionsRequired: 99,
      weeksBetweenSessions: 999,
    });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.sessionsRequired).toBe(10);
    expect(quote.weeksBetweenSessions).toBe(104);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail (or skip)**

Run: `npx vitest run src/server/quotes.integration.test.ts`
Expected: without `DATABASE_URL` set, every test in the file reports **skipped**, not failed — this confirms the suite still loads and parses correctly. If `DATABASE_URL` happens to be set, these five new tests must FAIL (the fields don't exist on `submitQuote`'s input type yet, or aren't persisted) before Step 3.

- [ ] **Step 3: Implement in `src/server/quotes.ts`**

Extend the `submitQuote` input type. Find:

```ts
export async function submitQuote(input: {
  token: string;
  amountMajor: number;
  note?: string;
  includes?: string[];
  tripsRequired?: number;
  daysPerTrip?: number;
  weeksBetweenTrips?: number | null;
  warrantyYears?: number | null;
  warrantyNote?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
```

Replace with:

```ts
export async function submitQuote(input: {
  token: string;
  amountMajor: number;
  note?: string;
  includes?: string[];
  tripsRequired?: number;
  daysPerTrip?: number;
  weeksBetweenTrips?: number | null;
  accommodationNights?: number | null;
  sessionsRequired?: number;
  weeksBetweenSessions?: number | null;
  warrantyYears?: number | null;
  warrantyNote?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
```

Find:

```ts
  const tripsRequired = clampInt(input.tripsRequired, 1, 1, 10);
  const daysPerTrip = clampInt(input.daysPerTrip, 1, 1, 60);
  // Only meaningful with more than one trip; forced null otherwise so the two
  // fields can never contradict each other.
  const weeksBetweenTrips =
    tripsRequired > 1 ? clampInt(input.weeksBetweenTrips, 1, 1, 104) : null;
  const warrantyYears =
    input.warrantyYears == null ? null : clampInt(input.warrantyYears, 0, 0, 50);
  const warrantyNote = input.warrantyNote?.trim() || null;
```

Replace with:

```ts
  const tripsRequired = clampInt(input.tripsRequired, 1, 1, 10);
  const daysPerTrip = clampInt(input.daysPerTrip, 1, 1, 60);
  // Only meaningful with more than one trip; forced null otherwise so the two
  // fields can never contradict each other.
  const weeksBetweenTrips =
    tripsRequired > 1 ? clampInt(input.weeksBetweenTrips, 1, 1, 104) : null;
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
```

Then add the three new fields to **both** `db.quote.create`'s `data` object and `db.quote.updateMany`'s `data` object — in each, right after `weeksBetweenTrips,` insert:

```ts
        accommodationNights,
        sessionsRequired,
        weeksBetweenSessions,
```

(Both blocks already list `weeksBetweenTrips,` immediately before `warrantyYears,` — insert the three new lines between them, in both the `create` and the `updateMany` data objects.)

- [ ] **Step 4: Run the tests again**

Run: `npx tsc --noEmit && npx vitest run src/server/quotes.integration.test.ts`
Expected: `tsc` clean. Tests skip without a database (expected in this environment) or pass with one.

- [ ] **Step 5: Commit**

```bash
git add src/server/quotes.ts src/server/quotes.integration.test.ts
git commit -m "feat(quote): validate and persist accommodationNights + sessions in submitQuote"
```

---

### Task 3: `QuoteRow` type + pure test fixtures

**Files:**
- Modify: `src/lib/quotes.ts`
- Modify: `src/lib/quotes.test.ts`

**Interfaces:**
- Consumes: nothing beyond the field names introduced in Task 1.
- Produces: `QuoteRow` now carries `accommodationNights: number | null`, `sessionsRequired: number | null`, `weeksBetweenSessions: number | null` — the shape Task 4 and Task 5's page components must fill in, and the shape `quote-comparison.tsx` (Task 5) reads.

- [ ] **Step 1: Edit the type in `src/lib/quotes.ts`**

Find:

```ts
  includes: string[];
  tripsRequired: number | null;
  daysPerTrip: number | null;
  weeksBetweenTrips: number | null;
  warrantyYears: number | null;
  warrantyNote: string | null;
};
```

Replace with:

```ts
  includes: string[];
  /** Only meaningful when `includes` contains "ACCOMMODATION". */
  accommodationNights: number | null;
  tripsRequired: number | null;
  daysPerTrip: number | null;
  weeksBetweenTrips: number | null;
  /** How many separate clinic visits the treatment needs — independent of
   * tripsRequired; relevant even when the patient never travels. */
  sessionsRequired: number | null;
  weeksBetweenSessions: number | null;
  warrantyYears: number | null;
  warrantyNote: string | null;
};
```

- [ ] **Step 2: Update both fixtures in `src/lib/quotes.test.ts`**

First fixture — find:

```ts
  includes: [],
  tripsRequired: 1,
  daysPerTrip: 1,
  weeksBetweenTrips: null,
  warrantyYears: null,
  warrantyNote: null,
});
```

Replace with:

```ts
  includes: [],
  accommodationNights: null,
  tripsRequired: 1,
  daysPerTrip: 1,
  weeksBetweenTrips: null,
  sessionsRequired: 1,
  weeksBetweenSessions: null,
  warrantyYears: null,
  warrantyNote: null,
});
```

Second fixture — find:

```ts
      includes: [],
      tripsRequired: null,
      daysPerTrip: null,
      weeksBetweenTrips: null,
      warrantyYears: null,
      warrantyNote: null,
    }) as QuoteRow;
```

Replace with:

```ts
      includes: [],
      accommodationNights: null,
      tripsRequired: null,
      daysPerTrip: null,
      weeksBetweenTrips: null,
      sessionsRequired: null,
      weeksBetweenSessions: null,
      warrantyYears: null,
      warrantyNote: null,
    }) as QuoteRow;
```

- [ ] **Step 3: Run the tests**

Run: `npx tsc --noEmit && npx vitest run src/lib/quotes.test.ts`
Expected: both PASS. This file needs no database, so it actually runs (not skipped) in this environment — use it as the real pass/fail signal for this task.

- [ ] **Step 4: Commit**

```bash
git add src/lib/quotes.ts src/lib/quotes.test.ts
git commit -m "feat(quote): add package fields to QuoteRow"
```

---

### Task 4: Clinic quote-submission form + its page

**Files:**
- Modify: `src/components/quote/quote-form.tsx`
- Modify: `src/app/[locale]/quote/[token]/page.tsx`
- Modify: `src/i18n/dictionaries/he.ts`
- Modify: `src/i18n/dictionaries/en.ts`

**Interfaces:**
- Consumes: `submitQuote`'s extended input (Task 2); `Quote.accommodationNights`/`sessionsRequired`/`weeksBetweenSessions` columns (Task 1).
- Produces: `QuoteFormInitial` gains `accommodationNights: number | null`, `sessionsRequired: number`, `weeksBetweenSessions: number | null` — the shape the token page (this task) and any future caller of `<QuoteForm>` must supply.

- [ ] **Step 1: Add the dictionary keys — `src/i18n/dictionaries/he.ts`**

Find (in the `quoteForm` section):

```ts
    weeksBetween: "שבועות בין הנסיעות",
    weeksPlaceholder: "לדוגמה: 16",
    warrantyLegend: "אחריות",
```

Replace with:

```ts
    weeksBetween: "שבועות בין הנסיעות",
    weeksPlaceholder: "לדוגמה: 16",
    accommodationNights: "כמה לילות לינה?",
    accommodationNightsPlaceholder: "לדוגמה: 5",
    sessionsLegend: "כמה מפגשים נדרשים בקליניקה?",
    sessionsCount: "מספר מפגשים",
    weeksBetweenSessions: "שבועות בין המפגשים",
    weeksBetweenSessionsPlaceholder: "לדוגמה: 16",
    warrantyLegend: "אחריות",
```

- [ ] **Step 2: Add the same dictionary keys — `src/i18n/dictionaries/en.ts`**

Find (in the `quoteForm` section):

```ts
    weeksBetween: "Weeks between trips",
    weeksPlaceholder: "e.g. 16",
    warrantyLegend: "Warranty",
```

Replace with:

```ts
    weeksBetween: "Weeks between trips",
    weeksPlaceholder: "e.g. 16",
    accommodationNights: "How many nights of accommodation?",
    accommodationNightsPlaceholder: "e.g. 5",
    sessionsLegend: "How many clinic visits are needed?",
    sessionsCount: "Number of sessions",
    weeksBetweenSessions: "Weeks between sessions",
    weeksBetweenSessionsPlaceholder: "e.g. 16",
    warrantyLegend: "Warranty",
```

- [ ] **Step 3: Edit `src/components/quote/quote-form.tsx`**

Find the `QuoteFormInitial` type:

```ts
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
```

Replace with:

```ts
export type QuoteFormInitial = {
  amount: number | null;
  note: string | null;
  includes: string[];
  accommodationNights: number | null;
  tripsRequired: number;
  daysPerTrip: number;
  weeksBetweenTrips: number | null;
  sessionsRequired: number;
  weeksBetweenSessions: number | null;
  warrantyYears: number | null;
  warrantyNote: string | null;
};
```

Find the state declarations:

```ts
  const [includes, setIncludes] = useState<string[]>(initial.includes);
  const [trips, setTrips] = useState(String(initial.tripsRequired));
  const [daysPerTrip, setDaysPerTrip] = useState(String(initial.daysPerTrip));
  const [weeksBetween, setWeeksBetween] = useState(
    initial.weeksBetweenTrips ? String(initial.weeksBetweenTrips) : "",
  );
```

Replace with:

```ts
  const [includes, setIncludes] = useState<string[]>(initial.includes);
  const [accommodationNights, setAccommodationNights] = useState(
    initial.accommodationNights ? String(initial.accommodationNights) : "",
  );
  const [trips, setTrips] = useState(String(initial.tripsRequired));
  const [daysPerTrip, setDaysPerTrip] = useState(String(initial.daysPerTrip));
  const [weeksBetween, setWeeksBetween] = useState(
    initial.weeksBetweenTrips ? String(initial.weeksBetweenTrips) : "",
  );
  const [sessions, setSessions] = useState(String(initial.sessionsRequired));
  const [weeksBetweenSessions, setWeeksBetweenSessions] = useState(
    initial.weeksBetweenSessions ? String(initial.weeksBetweenSessions) : "",
  );
```

Find:

```ts
  const tripCount = Number(trips) || 1;
  const multiTrip = tripCount > 1;
```

Replace with:

```ts
  const tripCount = Number(trips) || 1;
  const multiTrip = tripCount > 1;
  const sessionCount = Number(sessions) || 1;
  const multiSession = sessionCount > 1;
```

Find the `submitQuote` call inside `onSubmit`:

```ts
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
```

Replace with:

```ts
    const res = await submitQuote({
      token,
      amountMajor: parsed,
      note,
      includes,
      accommodationNights: includes.includes("ACCOMMODATION")
        ? Number(accommodationNights) || 1
        : null,
      tripsRequired: tripCount,
      daysPerTrip: Number(daysPerTrip) || 1,
      weeksBetweenTrips: multiTrip ? Number(weeksBetween) || null : null,
      sessionsRequired: sessionCount,
      weeksBetweenSessions: multiSession ? Number(weeksBetweenSessions) || null : null,
      warrantyYears: warrantyYears === "" ? null : Number(warrantyYears),
      warrantyNote,
    });
```

Find the includes fieldset's closing (the pills `<div>` then `</fieldset>`):

```tsx
      <fieldset>
        <legend className="text-foreground mb-2 text-sm font-semibold">{t.quoteForm.includedLegend}</legend>
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
                {translateInclusion(t.labels, key)}
              </button>
            );
          })}
        </div>
      </fieldset>
```

Replace with:

```tsx
      <fieldset>
        <legend className="text-foreground mb-2 text-sm font-semibold">{t.quoteForm.includedLegend}</legend>
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
                {translateInclusion(t.labels, key)}
              </button>
            );
          })}
        </div>
        {/* Only meaningful once accommodation itself is checked above. */}
        {includes.includes("ACCOMMODATION") && (
          <label className="mt-3 flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">{t.quoteForm.accommodationNights}</span>
            <input
              type="number"
              min={1}
              max={60}
              value={accommodationNights}
              onChange={(e) => setAccommodationNights(e.target.value)}
              className={fieldClass}
              placeholder={t.quoteForm.accommodationNightsPlaceholder}
            />
          </label>
        )}
      </fieldset>
```

Find the end of the trips `<fieldset>` (right before the warranty fieldset):

```tsx
        )}
      </fieldset>

      {/* Warranty — the dominant fear once the patient has flown home. */}
```

Replace with:

```tsx
        )}
      </fieldset>

      {/* Sessions — how many times the patient must physically return to the
          clinic. Independent of trips: a local patient has sessions with no
          travel at all. */}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-foreground mb-2 text-sm font-semibold">
          {t.quoteForm.sessionsLegend}
        </legend>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t.quoteForm.sessionsCount}</span>
          <input
            type="number"
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
```

- [ ] **Step 4: Wire the token page — `src/app/[locale]/quote/[token]/page.tsx`**

Find:

```ts
          includes: true,
          tripsRequired: true,
          daysPerTrip: true,
          weeksBetweenTrips: true,
          warrantyYears: true,
          warrantyNote: true,
          status: true,
```

Replace with:

```ts
          includes: true,
          accommodationNights: true,
          tripsRequired: true,
          daysPerTrip: true,
          weeksBetweenTrips: true,
          sessionsRequired: true,
          weeksBetweenSessions: true,
          warrantyYears: true,
          warrantyNote: true,
          status: true,
```

Find:

```ts
                includes: rd.quote?.includes ?? [],
                tripsRequired: rd.quote?.tripsRequired ?? 1,
                daysPerTrip: rd.quote?.daysPerTrip ?? 1,
                weeksBetweenTrips: rd.quote?.weeksBetweenTrips ?? null,
                warrantyYears: rd.quote?.warrantyYears ?? null,
                warrantyNote: rd.quote?.warrantyNote ?? null,
```

Replace with:

```ts
                includes: rd.quote?.includes ?? [],
                accommodationNights: rd.quote?.accommodationNights ?? null,
                tripsRequired: rd.quote?.tripsRequired ?? 1,
                daysPerTrip: rd.quote?.daysPerTrip ?? 1,
                weeksBetweenTrips: rd.quote?.weeksBetweenTrips ?? null,
                sessionsRequired: rd.quote?.sessionsRequired ?? 1,
                weeksBetweenSessions: rd.quote?.weeksBetweenSessions ?? null,
                warrantyYears: rd.quote?.warrantyYears ?? null,
                warrantyNote: rd.quote?.warrantyNote ?? null,
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (this is the first point every caller of `<QuoteForm>` has been updated).

- [ ] **Step 6: Commit**

```bash
git add src/components/quote/quote-form.tsx "src/app/[locale]/quote/[token]/page.tsx" src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "feat(quote): accommodation nights + session count fields in the clinic quote form"
```

---

### Task 5: Patient comparison table + its page

**Files:**
- Modify: `src/components/request/quote-comparison.tsx`
- Modify: `src/app/[locale]/request/[id]/page.tsx`
- Modify: `src/i18n/dictionaries/he.ts`
- Modify: `src/i18n/dictionaries/en.ts`

**Interfaces:**
- Consumes: `QuoteRow.accommodationNights`/`sessionsRequired`/`weeksBetweenSessions` (Task 3); `Quote.accommodationNights`/`sessionsRequired`/`weeksBetweenSessions` columns (Task 1).
- Produces: nothing further downstream — this is the last hop, what the patient sees.

- [ ] **Step 1: Add the dictionary keys — `src/i18n/dictionaries/he.ts`**

Find (in the `requestDetail` section):

```ts
    rowTrips: "נסיעות",
    rowWarranty: "אחריות",
```

Replace with:

```ts
    rowTrips: "נסיעות",
    rowSessions: "מפגשים",
    rowWarranty: "אחריות",
```

Find:

```ts
    weeksBetween: " · {weeks} שבועות ביניהן",
    warranty: "אחריות {years} שנים",
```

Replace with:

```ts
    weeksBetween: " · {weeks} שבועות ביניהן",
    accommodationNights: " · {nights} לילות",
    oneSession: "מפגש אחד",
    manySessions: "{sessions} מפגשים",
    weeksBetweenSessions: " · {weeks} שבועות ביניהם",
    warranty: "אחריות {years} שנים",
```

- [ ] **Step 2: Add the same dictionary keys — `src/i18n/dictionaries/en.ts`**

Find (in the `requestDetail` section):

```ts
    rowTrips: "Trips",
    rowWarranty: "Warranty",
```

Replace with:

```ts
    rowTrips: "Trips",
    rowSessions: "Sessions",
    rowWarranty: "Warranty",
```

Find:

```ts
    weeksBetween: " · {weeks} weeks apart",
    warranty: "{years}-year warranty",
```

Replace with:

```ts
    weeksBetween: " · {weeks} weeks apart",
    accommodationNights: " · {nights} nights",
    oneSession: "One session",
    manySessions: "{sessions} sessions",
    weeksBetweenSessions: " · {weeks} weeks apart",
    warranty: "{years}-year warranty",
```

- [ ] **Step 3: Edit `src/components/request/quote-comparison.tsx`**

Find the `tripsCell` function:

```ts
  const tripsCell = (q: QuoteRow) => {
    if (q.tripsRequired === null) return notStated;
    if (q.tripsRequired === 1) return format(d.oneTrip, { days: q.daysPerTrip ?? 1 });
    return (
      format(d.manyTrips, { trips: q.tripsRequired, days: q.daysPerTrip ?? 1 }) +
      (q.weeksBetweenTrips ? format(d.weeksBetween, { weeks: q.weeksBetweenTrips }) : "")
    );
  };
```

Add right after it (before `const priceCell`):

```ts
  const sessionsCell = (q: QuoteRow) => {
    if (q.sessionsRequired === null) return notStated;
    if (q.sessionsRequired === 1) return d.oneSession;
    return (
      format(d.manySessions, { sessions: q.sessionsRequired }) +
      (q.weeksBetweenSessions
        ? format(d.weeksBetweenSessions, { weeks: q.weeksBetweenSessions })
        : "")
    );
  };
```

Find the `rowIncludes` row definition:

```ts
    {
      label: d.rowIncludes,
      cell: (q) =>
        q.includes.length ? (
          <span className="flex flex-wrap gap-1.5">
            {q.includes.map((key) => (
              <span
                key={key}
                className="bg-teal-deep/10 text-teal-deep rounded-full px-2 py-0.5 text-xs"
              >
                {translateInclusion(t.labels, key)}
              </span>
            ))}
          </span>
        ) : (
          notStated
        ),
    },
    { label: d.rowTrips, cell: tripsCell },
```

Replace with:

```ts
    {
      label: d.rowIncludes,
      cell: (q) =>
        q.includes.length ? (
          <span className="flex flex-wrap gap-1.5">
            {q.includes.map((key) => (
              <span
                key={key}
                className="bg-teal-deep/10 text-teal-deep rounded-full px-2 py-0.5 text-xs"
              >
                {translateInclusion(t.labels, key)}
                {key === "ACCOMMODATION" && q.accommodationNights
                  ? format(d.accommodationNights, { nights: q.accommodationNights })
                  : ""}
              </span>
            ))}
          </span>
        ) : (
          notStated
        ),
    },
    { label: d.rowTrips, cell: tripsCell },
    { label: d.rowSessions, cell: sessionsCell },
```

- [ ] **Step 4: Wire the request detail page — `src/app/[locale]/request/[id]/page.tsx`**

Find:

```ts
              includes: true,
              tripsRequired: true,
              daysPerTrip: true,
              weeksBetweenTrips: true,
              warrantyYears: true,
              warrantyNote: true,
              status: true,
```

Replace with:

```ts
              includes: true,
              accommodationNights: true,
              tripsRequired: true,
              daysPerTrip: true,
              weeksBetweenTrips: true,
              sessionsRequired: true,
              weeksBetweenSessions: true,
              warrantyYears: true,
              warrantyNote: true,
              status: true,
```

Find:

```ts
    includes: rd.quote?.includes ?? [],
    tripsRequired: rd.quote?.tripsRequired ?? null,
    daysPerTrip: rd.quote?.daysPerTrip ?? null,
    weeksBetweenTrips: rd.quote?.weeksBetweenTrips ?? null,
    warrantyYears: rd.quote?.warrantyYears ?? null,
    warrantyNote: rd.quote?.warrantyNote ?? null,
    note: rd.quote?.note ?? null,
  }));
```

Replace with:

```ts
    includes: rd.quote?.includes ?? [],
    accommodationNights: rd.quote?.accommodationNights ?? null,
    tripsRequired: rd.quote?.tripsRequired ?? null,
    daysPerTrip: rd.quote?.daysPerTrip ?? null,
    weeksBetweenTrips: rd.quote?.weeksBetweenTrips ?? null,
    sessionsRequired: rd.quote?.sessionsRequired ?? null,
    weeksBetweenSessions: rd.quote?.weeksBetweenSessions ?? null,
    warrantyYears: rd.quote?.warrantyYears ?? null,
    warrantyNote: rd.quote?.warrantyNote ?? null,
    note: rd.quote?.note ?? null,
  }));
```

- [ ] **Step 5: Type-check and run the full non-DB test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: `tsc` clean; every test that doesn't need `DATABASE_URL` passes (including `src/lib/quotes.test.ts` from Task 3); DB-gated integration tests report skipped in this environment.

- [ ] **Step 6: Commit**

```bash
git add src/components/request/quote-comparison.tsx "src/app/[locale]/request/[id]/page.tsx" src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "feat(quote): show accommodation nights and session count in the patient comparison table"
```

---

### Task 6: Build check, `HANDOFF.md`, and manual-QA note

**Files:**
- Modify: `docs/HANDOFF.md`

**Interfaces:**
- Consumes: everything above — this task only verifies and documents.
- Produces: nothing consumed by later tasks (there are none).

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: succeeds. This exercises `prisma generate` + `next build`, catching anything `tsc --noEmit` alone would miss (e.g. a Server/Client component boundary issue). Note: `scripts/migrate-on-build.mjs` only runs `prisma migrate deploy` when `VERCEL_ENV=production`, so this local build does **not** need a live database.

- [ ] **Step 2: Add a HANDOFF.md entry**

Prepend a new dated section at the top of `docs/HANDOFF.md`, immediately after the header block (before the first `## מה נחת ב-...` section), following the exact structure every other entry in that file already uses: what shipped, what it builds on, what wasn't tested in a browser. Update the "עודכן לאחרונה" date in the header to today's date. Write the section in Hebrew, matching the file's existing language and voice. Cover: the two new `Quote` fields and what they're independent of each other for (accommodation nights vs. ACCOMMODATION checkbox; sessions vs. trips — usable for a local, non-traveling patient), the migration name, and that the full clinic→patient path (checking accommodation, entering nights, entering a multi-session gap, seeing both rendered in the comparison table) has not been walked in a browser — add it to the existing pending manual-QA list (section 1.4) rather than only the dated section.

- [ ] **Step 3: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs: HANDOFF entry for quote package fields (accommodation nights, sessions)"
```
