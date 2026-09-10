# Request Cap Enforcement & Floor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide a clinic from the patient's clinic-selection screen once it hits its monthly request cap — unless doing so would drop the visible count below 5, in which case backfill from the capped-out clinics until the floor is met.

**Architecture:** The design in `docs/superpowers/specs/2026-09-08-tiered-pricing-model-design.md` section 3 assumed the server filters by city/specialty per query. That assumption is wrong for the real patient journey: `src/app/[locale]/request/[id]/dentists/page.tsx` fetches every clinic for the relevant countries **once**, and `DentistDirectory` (`src/components/dentists/dentist-directory.tsx`) filters by city, specialty, language, insurer, and experience **client-side**, with no server round-trip per filter change. `/api/dentists/route.ts` (which the spec's server-side design would have used) is dead code — nothing calls it. So this plan does the opposite of what the spec sketched: the server computes and attaches a per-clinic `isAtCap: boolean` (reading `ClinicSubscription.monthlyRequestCap`, a new frozen-at-registration snapshot field, against `MonthlyRequestUsage` for the current month — both already exist from the previous two plans, the former needs one new column), and a new client-side step folds cap-plus-floor into the filtering `DentistDirectory` already does, immediately after its existing filter step. The floor is redefined slightly from the spec's literal city×specialty framing to something that survives contact with the real multi-axis filter UI: cap enforcement alone must never be the reason a patient sees fewer than 5 clinics, for whatever combination of filters they chose — it does not manufacture results a patient's own narrow filtering wouldn't have produced anyway.

**Tech Stack:** Next.js (App Router, server components, client components), Prisma 7 + Postgres, Vitest, React (no DOM/component-testing framework exists in this repo — the new client-side logic is written as a plain, unit-testable function specifically so it doesn't need one).

**Spec:** `docs/superpowers/specs/2026-09-08-tiered-pricing-model-design.md` section 3 (superseded in its query-shape details by this plan's discovery above — the *intent*, "hide at cap unless it breaks the floor," is unchanged). This is plan 3 of 6. Plans 1 (schema/admin) and 2 (request counters/trial conversion) are merged. Plans 4-6 (response-rate SLA, Featured inventory, Founding 50) remain future plans.

## Global Constraints

- `ClinicSubscription.monthlyRequestCap` is a **frozen snapshot**, read at cap-check time from the clinic's own row — never re-derived from the live `SubscriptionPricing` table. This is the same reasoning already applied to `priceMinor`, `currency`, `trialDays`, and `trialRequestCap` on this model: an admin editing a tier's cap today must not retroactively change what an existing clinic already agreed to. (This closes one of the two structural gaps the final review of plan 1 flagged and asked to be carried forward as an explicit constraint here — see `docs/superpowers/specs/2026-09-08-tiered-pricing-model-design.md`'s "הוספות מהסקירה הסופית" section.)
- `null` means unlimited (the FEATURED tier) — a clinic with `monthlyRequestCap: null` is never `isAtCap`, regardless of usage.
- The floor is 5, computed on whatever set `DentistDirectory`'s existing filters already produced — not on a city×specialty pairing computed separately. An already-selected clinic is never retroactively un-selectable by hitting its cap mid-session — `saveRequestDentists`/`src/server/requests.ts`'s submission-time check is unaffected by this plan; a capped clinic drops from *discovery*, never from a request already in flight (spec section 3's own reasoning: blocking an already-marked selection "destroys a whole request the patient thought they had").
- No new client-side testing framework (React Testing Library, jsdom, etc.) is introduced — this repo's Vitest config runs `environment: "node"` and has no component-test precedent. The new cap-plus-floor logic is written as a plain function operating on plain data specifically so it can be unit-tested without one.
- Local Postgres runs in Docker (`docker start dentalcompare-db`) — start it before any step that touches the database.

---

### Task 1: Schema — `ClinicSubscription.monthlyRequestCap`, frozen at every write path

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_clinic_subscription_monthly_cap/migration.sql`
- Modify: `src/server/subscriptions.ts` (`createPendingSubscription`)
- Modify: `src/server/clinic-registration.ts`
- Modify: `src/server/admin-actions.ts`

**Interfaces:**
- Produces: `ClinicSubscription.monthlyRequestCap: number | null` — nullable, no default needed (Prisma allows omitting a nullable column entirely on insert; unlike `trialRequestCap` in the previous plan, this field needs no `@default` to avoid touching the ~7 unrelated test fixtures that construct `ClinicSubscription` directly — they simply get `null`, which is a safe, inert value: "no known cap" reads identically to "unlimited" in every check this plan adds). `createPendingSubscription(args)` gains a required `monthlyRequestCap: number | null` field.

- [ ] **Step 1: Edit the Prisma schema**

In `prisma/schema.prisma`, find `ClinicSubscription`'s `trialRequestCap` field (added by the previous plan) and add this immediately after it:

```prisma
  // Frozen at registration from SubscriptionPricing.monthlyRequestCap for the
  // clinic's (provider, tier) — never re-read live. null = unlimited
  // (FEATURED). Unlike trialRequestCap this needs no @default: it's
  // genuinely, correctly nullable (not a "fail loud if missing" field), so
  // the unrelated test fixtures across the repo that construct
  // ClinicSubscription directly simply get null, which every check this
  // plan adds already treats as "never at cap" — the same safe value
  // FEATURED clinics get on purpose.
  monthlyRequestCap       Int?
```

- [ ] **Step 2: Generate the migration skeleton, or hand-author it if that fails**

Run: `docker start dentalcompare-db` (ignore "already running" errors), then:
`npx prisma migrate dev --name clinic_subscription_monthly_cap --create-only`

If this fails non-interactively, don't retry it: hand-author the migration folder and file directly instead, using a timestamp later than the last existing migration folder, and go straight to Step 4.

- [ ] **Step 3: Write the migration SQL**

```sql
-- Purely additive, nullable, no default, no backfill needed — every existing
-- row (real or test-fixture) simply reads null, meaning "no known cap",
-- which every check this plan adds already treats identically to
-- "unlimited". See the schema comment for why this field needs no @default,
-- unlike trialRequestCap in the previous migration.
ALTER TABLE "ClinicSubscription" ADD COLUMN "monthlyRequestCap" INTEGER;
```

- [ ] **Step 4: Apply the migration and regenerate the client**

Run: `npx prisma migrate dev` (applies the migration from Step 3; auto-runs `prisma generate`). If it does not auto-generate, run `npx prisma generate` explicitly.

- [ ] **Step 5: Update `createPendingSubscription`**

In `src/server/subscriptions.ts`, add `monthlyRequestCap: number | null;` to the `args` type of `createPendingSubscription` (immediately after the existing `trialRequestCap: number;` field) and pass it through to `create`:

```ts
export async function createPendingSubscription(
  args: {
    dentistId: string;
    plan: SubscriptionPlanType;
    setupToken: string;
    priceMinor: number;
    currency: string;
    trialDays: number;
    trialRequestCap: number;
    monthlyRequestCap: number | null;
    provider: SubscriptionProvider;
    tier: SubscriptionTier;
  },
  client: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  await client.clinicSubscription.create({
    data: {
      dentistId: args.dentistId,
      plan: args.plan,
      priceMinor: args.priceMinor,
      currency: args.currency,
      trialDays: args.trialDays,
      trialRequestCap: args.trialRequestCap,
      monthlyRequestCap: args.monthlyRequestCap,
      setupToken: args.setupToken,
      status: "PENDING",
      provider: args.provider,
      tier: args.tier,
    },
  });
}
```

- [ ] **Step 6: Update `clinic-registration.ts`**

Find the `createPendingSubscription` call (inside the `db.$transaction` block) and add `monthlyRequestCap: pricing.monthlyRequestCap,` immediately after the existing `trialRequestCap: pricing.trialRequestCap,` line:

```ts
    await createPendingSubscription(
      {
        dentistId: dentist.id,
        plan,
        setupToken,
        priceMinor,
        currency: pricing.currency,
        trialDays: pricing.trialDays,
        trialRequestCap: pricing.trialRequestCap,
        monthlyRequestCap: pricing.monthlyRequestCap,
        provider,
        tier: "BASIC",
      },
      tx,
    );
```

- [ ] **Step 7: Update `admin-actions.ts`**

Find the "Complimentary subscription" `tx.clinicSubscription.create` block and add `monthlyRequestCap: pricing.monthlyRequestCap,` immediately after the existing `trialRequestCap: pricing.trialRequestCap,` line:

```ts
    await tx.clinicSubscription.create({
      data: {
        dentistId: dentist.id,
        plan: "MONTHLY",
        priceMinor: pricing.monthlyPriceMinor,
        currency: pricing.currency,
        trialDays: pricing.trialDays,
        trialRequestCap: pricing.trialRequestCap,
        monthlyRequestCap: pricing.monthlyRequestCap,
        tier: "BASIC",
        setupToken: randomUUID(),
        status: "ACTIVE",
        currentPeriodEnd: null,
        recurringToken: null,
      },
    });
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit` — expect clean, repo-wide (both call sites and the function signature change together in this task, so there should be no dangling error).
Run: `npm test` — expect the full suite green, same count as before this task (this field is nullable and optional to every existing test fixture, so nothing else should need to change).

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/server/subscriptions.ts src/server/clinic-registration.ts src/server/admin-actions.ts
git commit -m "feat: add frozen monthlyRequestCap to ClinicSubscription"
```

---

### Task 2: Cap status — `attachCapStatus` + the floor-backfill function

**Files:**
- Create: `src/lib/date.ts`
- Modify: `src/server/request-usage.ts`
- Modify: `src/lib/dentist-public.ts`
- Modify: `src/lib/dentist-public.integration.test.ts`
- Create: `src/components/dentists/request-cap-filter.ts`
- Create: `src/components/dentists/request-cap-filter.test.ts`

**Interfaces:**
- Produces: `currentYearMonth(now?: Date): string`, exported from `src/lib/date.ts`. `attachCapStatus(dentists: PublicDentist[]): Promise<PublicDentistWithCapStatus[]>` and the type `PublicDentistWithCapStatus = PublicDentist & { isAtCap: boolean }`, both exported from `src/lib/dentist-public.ts`. `applyRequestCapFloor(dentists: PublicDentistWithCapStatus[]): PublicDentistWithCapStatus[]`, exported from `src/components/dentists/request-cap-filter.ts` — Task 3 wires both of these into the real page and component.

- [ ] **Step 1: Move `currentYearMonth` to a shared location**

Create `src/lib/date.ts`:

```ts
/**
 * "2026-09" — the natural key MonthlyRequestUsage resets on every calendar
 * month, with no separate cron needed to zero it out.
 *
 * Deliberately UTC, not clinic-local or patient-local time: DentalCompare is
 * now a cross-border marketplace (see the dental-tourism pivot), so there is
 * no single "local" timezone to anchor this on, and per-clinic-timezone
 * correctness would be real complexity for a boundary that, worst case,
 * shifts a request's month bucket by at most a few hours around midnight on
 * the 1st. If this ever needs to be exact for a specific market, that's a
 * deliberate follow-up, not an oversight — this comment is that pin.
 */
export function currentYearMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}
```

In `src/server/request-usage.ts`, delete the local `function currentYearMonth(...)` definition and add an import instead:

```ts
import { currentYearMonth } from "@/lib/date";
```

(Place it alongside the file's other `@/lib/*` imports.)

- [ ] **Step 2: Run the existing request-usage tests to confirm the move didn't change behavior**

Run: `npx vitest run src/server/request-usage.integration.test.ts`
Expected: PASS, same 9 tests as before this task (this is a pure relocation, not a behavior change).

- [ ] **Step 3: Write the failing tests for `attachCapStatus`**

Read `src/lib/dentist-public.integration.test.ts` first — it already has a `seedClinicIn(countryCode, opts)` helper and a `TEST_COUNTRY = "QW"` constant that every test in this file reuses. Extend `seedClinicIn`'s `opts` type and its `clinicSubscription.create` call to accept an optional cap override — change:

```ts
async function seedClinicIn(countryCode: string, opts: { verified?: boolean } = {}) {
```

to:

```ts
async function seedClinicIn(
  countryCode: string,
  opts: { verified?: boolean; monthlyRequestCap?: number | null } = {},
) {
```

and inside the `db.clinicSubscription.create({ data: { ... } })` call, add `monthlyRequestCap: opts.monthlyRequestCap,` right after the existing `trialDays: 60,` line (Prisma treats an `undefined` value the same as omitting the key, so calls that don't pass `monthlyRequestCap` keep getting `null` exactly as they do today).

Find the file's existing import `import { PUBLIC_DENTIST_SELECT, publicDentistWhere } from "./dentist-public";` and add `attachCapStatus` to it:

```ts
import { PUBLIC_DENTIST_SELECT, publicDentistWhere, attachCapStatus } from "./dentist-public";
```

Add a new `describe` block, after the existing `describe.skipIf(!hasDb)("the directory query", ...)` block:

```ts
describe.skipIf(!hasDb)("attachCapStatus", () => {
  it("a clinic with no cap (null) is never at cap, regardless of usage", async () => {
    const clinic = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: null });
    const yearMonth = new Date().toISOString().slice(0, 7);
    await db.monthlyRequestUsage.create({ data: { dentistId: clinic.id, yearMonth, count: 999 } });

    const [dentist] = await db.dentist.findMany({
      where: { id: clinic.id },
      select: PUBLIC_DENTIST_SELECT,
    });
    const [withStatus] = await attachCapStatus([dentist]);
    expect(withStatus.isAtCap).toBe(false);

    await db.dentist.delete({ where: { id: clinic.id } });
  });

  it("a clinic under its cap is not at cap", async () => {
    const clinic = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: 10 });
    const yearMonth = new Date().toISOString().slice(0, 7);
    await db.monthlyRequestUsage.create({ data: { dentistId: clinic.id, yearMonth, count: 3 } });

    const [dentist] = await db.dentist.findMany({
      where: { id: clinic.id },
      select: PUBLIC_DENTIST_SELECT,
    });
    const [withStatus] = await attachCapStatus([dentist]);
    expect(withStatus.isAtCap).toBe(false);

    await db.dentist.delete({ where: { id: clinic.id } });
  });

  it("a clinic at or over its cap is at cap", async () => {
    const clinic = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: 10 });
    const yearMonth = new Date().toISOString().slice(0, 7);
    await db.monthlyRequestUsage.create({ data: { dentistId: clinic.id, yearMonth, count: 10 } });

    const [dentist] = await db.dentist.findMany({
      where: { id: clinic.id },
      select: PUBLIC_DENTIST_SELECT,
    });
    const [withStatus] = await attachCapStatus([dentist]);
    expect(withStatus.isAtCap).toBe(true);

    await db.dentist.delete({ where: { id: clinic.id } });
  });

  it("a clinic with a cap but no MonthlyRequestUsage row yet is not at cap (treated as 0 used)", async () => {
    const clinic = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: 3 });

    const [dentist] = await db.dentist.findMany({
      where: { id: clinic.id },
      select: PUBLIC_DENTIST_SELECT,
    });
    const [withStatus] = await attachCapStatus([dentist]);
    expect(withStatus.isAtCap).toBe(false);

    await db.dentist.delete({ where: { id: clinic.id } });
  });

  it("computes each clinic's status independently — no cross-contamination", async () => {
    const under = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: 10 });
    const over = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: 2 });
    const yearMonth = new Date().toISOString().slice(0, 7);
    await db.monthlyRequestUsage.create({ data: { dentistId: under.id, yearMonth, count: 1 } });
    await db.monthlyRequestUsage.create({ data: { dentistId: over.id, yearMonth, count: 2 } });

    const dentists = await db.dentist.findMany({
      where: { id: { in: [under.id, over.id] } },
      select: PUBLIC_DENTIST_SELECT,
    });
    const withStatus = await attachCapStatus(dentists);
    expect(withStatus.find((d) => d.id === under.id)!.isAtCap).toBe(false);
    expect(withStatus.find((d) => d.id === over.id)!.isAtCap).toBe(true);

    await db.dentist.delete({ where: { id: under.id } });
    await db.dentist.delete({ where: { id: over.id } });
  });

  it("returns an empty array for an empty input without querying", async () => {
    const result = await attachCapStatus([]);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/lib/dentist-public.integration.test.ts`
Expected: FAIL — `attachCapStatus` doesn't exist yet.

- [ ] **Step 5: Write `attachCapStatus` in `src/lib/dentist-public.ts`**

Add `import "server-only";` at the very top of the file if it isn't already there (check first — this file does real DB queries now, unlike its existing pure where/select builders). Add these imports alongside the existing ones:

```ts
import { db } from "@/lib/db";
import { currentYearMonth } from "@/lib/date";
```

Add this type and function, after the existing `PublicDentist` type:

```ts
export type PublicDentistWithCapStatus = PublicDentist & { isAtCap: boolean };

/**
 * Attaches whether each clinic has hit its monthly request cap this calendar
 * month — the signal the client-side directory filter needs to drop capped
 * clinics from view (src/components/dentists/request-cap-filter.ts handles
 * the drop-and-backfill logic itself; this function only computes the flag).
 *
 * Reads ClinicSubscription.monthlyRequestCap (frozen at registration, null
 * means unlimited) and MonthlyRequestUsage for the current month — never the
 * live SubscriptionPricing row, so an admin editing a tier's cap today never
 * retroactively changes what an existing clinic already agreed to.
 */
export async function attachCapStatus(
  dentists: PublicDentist[],
): Promise<PublicDentistWithCapStatus[]> {
  if (dentists.length === 0) return [];
  const ids = dentists.map((d) => d.id);
  const yearMonth = currentYearMonth();

  const [subs, usage] = await Promise.all([
    db.clinicSubscription.findMany({
      where: { dentistId: { in: ids } },
      select: { dentistId: true, monthlyRequestCap: true },
    }),
    db.monthlyRequestUsage.findMany({
      where: { dentistId: { in: ids }, yearMonth },
      select: { dentistId: true, count: true },
    }),
  ]);

  const capByDentist = new Map(subs.map((s) => [s.dentistId, s.monthlyRequestCap]));
  const usageByDentist = new Map(usage.map((u) => [u.dentistId, u.count]));

  return dentists.map((d) => {
    const cap = capByDentist.get(d.id) ?? null;
    const used = usageByDentist.get(d.id) ?? 0;
    return { ...d, isAtCap: cap !== null && used >= cap };
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/dentist-public.integration.test.ts`
Expected: PASS, all tests in the file including the 6 new ones (requires the local DB running).

- [ ] **Step 7: Write the floor-backfill function and its tests (TDD — tests first)**

Create `src/components/dentists/request-cap-filter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyRequestCapFloor } from "./request-cap-filter";
import type { PublicDentistWithCapStatus } from "@/lib/dentist-public";

// Minimal fixture — only `id` and `isAtCap` matter to this function; the rest
// of PublicDentistWithCapStatus's fields are irrelevant to its logic, so a
// cast keeps these fixtures readable instead of filling in every field.
function d(id: string, isAtCap: boolean): PublicDentistWithCapStatus {
  return { id, isAtCap } as PublicDentistWithCapStatus;
}

describe("applyRequestCapFloor", () => {
  it("returns an empty array unchanged", () => {
    expect(applyRequestCapFloor([])).toEqual([]);
  });

  it("drops capped clinics when 5+ non-capped ones remain", () => {
    const input = [d("a", false), d("b", false), d("c", false), d("d", false), d("e", false), d("f", true)];
    const result = applyRequestCapFloor(input);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("backfills from capped clinics, in order, to reach the floor of 5", () => {
    const input = [d("a", false), d("b", false), d("c", true), d("d", true), d("e", true), d("f", true)];
    const result = applyRequestCapFloor(input);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("when fewer than 5 clinics exist in total, returns all of them (floor never exceeds the set size)", () => {
    const input = [d("a", false), d("b", true), d("c", true)];
    const result = applyRequestCapFloor(input);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("when already at exactly the floor with no capped clinics, returns them unchanged", () => {
    const input = [d("a", false), d("b", false), d("c", false), d("d", false), d("e", false)];
    const result = applyRequestCapFloor(input);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("all clinics capped, fewer than 5 total: returns all of them anyway (floor is not a promise of non-capped results)", () => {
    const input = [d("a", true), d("b", true)];
    const result = applyRequestCapFloor(input);
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 8: Run the tests to verify they fail**

Run: `npx vitest run src/components/dentists/request-cap-filter.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 9: Write `src/components/dentists/request-cap-filter.ts`**

```ts
import type { PublicDentistWithCapStatus } from "@/lib/dentist-public";

const REQUEST_CAP_FLOOR = 5;

/**
 * Removes clinics that hit their monthly request cap — unless doing so would
 * drop the visible count below the floor, in which case it backfills from
 * the capped-out clinics (in their existing order) until the floor is met or
 * the input is exhausted.
 *
 * The floor's job is narrow: cap enforcement alone must never be the reason
 * a patient sees fewer than 5 clinics, when 5 or more genuinely exist for
 * whatever filters they chose (city, specialty, language, insurer,
 * experience — any combination, computed upstream by the caller). It does
 * not manufacture results a patient's own narrow filtering wouldn't have
 * produced anyway — a set with 2 clinics total stays a set of 2.
 */
export function applyRequestCapFloor(
  dentists: PublicDentistWithCapStatus[],
): PublicDentistWithCapStatus[] {
  const floor = Math.min(REQUEST_CAP_FLOOR, dentists.length);
  const notAtCap = dentists.filter((d) => !d.isAtCap);
  if (notAtCap.length >= floor) return notAtCap;

  const atCap = dentists.filter((d) => d.isAtCap);
  const needed = floor - notAtCap.length;
  return [...notAtCap, ...atCap.slice(0, needed)];
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/components/dentists/request-cap-filter.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 11: Full verification**

Run: `npx tsc --noEmit` — expect clean, repo-wide.
Run: `npm test` — expect the full suite green.

- [ ] **Step 12: Commit**

```bash
git add src/lib/date.ts src/server/request-usage.ts src/lib/dentist-public.ts src/lib/dentist-public.integration.test.ts src/components/dentists/request-cap-filter.ts src/components/dentists/request-cap-filter.test.ts
git commit -m "feat: compute per-clinic request-cap status and the floor-backfill filter"
```

---

### Task 3: Wire cap status into the clinic-selection page and directory

**Files:**
- Modify: `src/app/[locale]/request/[id]/dentists/page.tsx`
- Modify: `src/components/dentists/dentist-directory.tsx`

**Interfaces:**
- Consumes: `attachCapStatus` (Task 2), `applyRequestCapFloor` (Task 2), `PublicDentistWithCapStatus` (Task 2).
- Produces: no new exports — this task only connects already-tested pieces into the live page and component.

- [ ] **Step 1: Update `request/[id]/dentists/page.tsx`**

Add to the existing `@/lib/dentist-public` import:

```ts
import { PUBLIC_DENTIST_SELECT, publicDentistWhere, attachCapStatus } from "@/lib/dentist-public";
```

Find:

```ts
  const dentists = await db.dentist.findMany({
    where: {
      ...publicDentistWhere(),
      ...(codes ? { countryCode: { in: codes } } : {}),
    },
    select: PUBLIC_DENTIST_SELECT,
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
  });
```

and change it to:

```ts
  const dentistsWithoutCapStatus = await db.dentist.findMany({
    where: {
      ...publicDentistWhere(),
      ...(codes ? { countryCode: { in: codes } } : {}),
    },
    select: PUBLIC_DENTIST_SELECT,
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
  });
  const dentists = await attachCapStatus(dentistsWithoutCapStatus);
```

(This file's only other use of `dentists` is passing it straight to `<DentistDirectory dentists={dentists} .../>` — that keeps working unchanged, since `PublicDentistWithCapStatus` is `PublicDentist & { isAtCap: boolean }`, a strict superset. The `cities`/`insurers`/`countries`/`languages` filter-option lists are computed inside `DentistDirectory` itself, not this page — Task 3 Step 2 covers that file.)

- [ ] **Step 2: Update `dentist-directory.tsx`**

Change the import:

```ts
import type { PublicDentist } from "@/lib/dentist-public";
```

to:

```ts
import type { PublicDentistWithCapStatus } from "@/lib/dentist-public";
import { applyRequestCapFloor } from "./request-cap-filter";
```

Update the props type — change:

```ts
type DentistDirectoryProps = {
  dentists: PublicDentist[];
```

to:

```ts
type DentistDirectoryProps = {
  dentists: PublicDentistWithCapStatus[];
```

(and the `dentists` parameter's inferred type in the function signature updates automatically along with it — no further change needed there).

Find the existing `filtered` memo:

```ts
  const filtered = useMemo(() => {
    return dentists.filter((d) => {
      if (filters.city && d.city !== filters.city) return false;
      if (filters.countries.length && !filters.countries.includes(d.countryCode)) return false;
      if (filters.languages.length && !filters.languages.some((l) => d.spokenLanguages.includes(l)))
        return false;
      if (filters.specialties.length && !filters.specialties.some((s) => d.specialties.includes(s)))
        return false;
      if (
        filters.insurers.length &&
        !filters.insurers.some((i) => d.insurerAffiliations.includes(i))
      )
        return false;
      if (filters.minExperience && d.experienceYears < filters.minExperience) return false;
      return true;
    });
  }, [dentists, filters]);
```

Add a new memo immediately after it:

```ts
  // Cap-plus-floor runs after the patient's own filters, not instead of them
  // — it only ever removes or restores clinics within whatever set filters
  // already produced. See request-cap-filter.ts for why the floor is
  // computed this way rather than per city×specialty.
  const visible = useMemo(() => applyRequestCapFloor(filtered), [filtered]);
```

Find every use of `filtered` **below** this point in the file (rendering — NOT the `filtered` memo's own definition, and not the `cities`/`insurers`/`countries`/`languages` memos above it, which deliberately still derive their filter-option lists from the full `dentists` array, unaffected by cap status) and replace it with `visible`. Based on the file's current structure this means the JSX return block's `filteredCount={filtered.length}` becomes `filteredCount={visible.length}`, `{filtered.length === 0 ? (` becomes `{visible.length === 0 ? (`, and `{filtered.map((d) => (` becomes `{visible.map((d) => (`. Read the file's actual current JSX to confirm you've caught every one — grep the file for `filtered` after your edit and confirm the only remaining occurrence is the `filtered` memo's own declaration and the `visible` memo's dependency array.

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit` — expect clean, repo-wide.
Run: `npm test` — expect the full suite green (this task adds no new automated tests of its own — Task 2 already covers both `attachCapStatus` and `applyRequestCapFloor` in isolation; this task is pure wiring between two already-tested pieces and a page/component this repo has no way to test directly).

- [ ] **Step 4: Manual verification (deferred if no browser is available)**

If you have browser tooling available: sign in as a patient, reach `/request/<id>/dentists` for a request with an uploaded treatment plan and x-ray, and confirm the page renders without error and the clinic count/list looks sane. Actually exercising the cap-and-floor behavior end-to-end requires a clinic whose `MonthlyRequestUsage` for the current month is manually pushed to its cap first (e.g. via a direct DB write) — describe the exact check in your report for whoever does this next if you can't do it yourself, rather than skipping the description too.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/request/[id]/dentists/page.tsx" src/components/dentists/dentist-directory.tsx
git commit -m "feat: hide capped clinics from the directory, with a 5-clinic floor"
```

---

### Task 4: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full type-check and full suite**

Run: `npx tsc --noEmit` — expect clean, repo-wide.
Run: `npm test` — expect every test passing, output pristine.

- [ ] **Step 2: Note what this plan does NOT do**

This plan does not touch the response-rate SLA, Featured inventory, or Founding 50 — those are separate future plans. It also does not fix `ClinicSubscription.tier`'s permanent `@default(BASIC)` (flagged by plan 1's final review as failing open toward a paid tier) — that fix belongs to whichever plan introduces real FREE-tier registration, not this one, since nothing in this plan creates a FREE subscription. It does not add a warning to a clinic approaching its cap (e.g. "9 of 10 requests used this month") — only the binary at-cap/not-at-cap signal this plan needs.

---

## After this plan

A capped clinic disappears from a patient's clinic-selection screen the moment it crosses its monthly limit, and reappears at the start of the next calendar month (`MonthlyRequestUsage`'s natural per-month key does this with no cron needed) — unless removing it would drop a city/specialty/language/insurer/experience combination below 5 visible clinics, in which case it stays visible until the set is naturally deep enough again. The next plan in this series (response-rate SLA: 48 hours, 2 consecutive non-responses drops a clinic from the same directory) reuses this exact pattern — a boolean computed server-side, folded into `DentistDirectory`'s existing client-side filter step, most likely composed with `applyRequestCapFloor` rather than duplicating it.
