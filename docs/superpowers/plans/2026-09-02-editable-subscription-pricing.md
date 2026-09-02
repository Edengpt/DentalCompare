# Editable Subscription Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move clinic subscription price and free-trial length off hardcoded constants (`SUBSCRIPTION_PLANS`, `TRIAL_DAYS`) onto a small admin-editable table, one row per payment provider (`PAYPLUS`, `STRIPE`), so Eden can change them from the admin panel without a deploy — for both the live Israeli/PayPlus track and the not-yet-built international/Stripe track.

**Architecture:** One new model, `SubscriptionPricing`, keyed by a `SubscriptionProvider` enum (`PAYPLUS | STRIPE`). Every place that currently reads the hardcoded constants switches to reading this table instead — a plain `db.subscriptionPricing.findUnique({ where: { provider } })`, no caching layer, since this is read rarely (registration, approval, a handful of page renders) and changes even more rarely. `intervalMonths` (how long a month/year plan period is) stays a small structural constant — it is not a price and Eden never asked to edit it. Sequenced so every task leaves the app compiling and the full suite green: the old constants stay alive until every consumer has migrated, and are deleted only in the final task.

**Tech Stack:** Next.js 16.2.11, React 19.2, Prisma 7.8 + Postgres, vitest (node).

**Spec:** `docs/superpowers/specs/2026-09-02-editable-subscription-pricing-design.md` — read it first. This plan implements it task by task.

## Global Constraints

- **Currency is stored per provider but never editable through the admin UI.** `PAYPLUS` is always `ILS`, `STRIPE` is always `USD`. The admin form only ever submits `monthlyPriceMajor`, `yearlyPriceMajor`, `trialDays`.
- **A price change affects new registrations only.** `ClinicSubscription.priceMinor`/`currency` are snapshotted onto the row at creation time, exactly as today — never recomputed later.
- **Seed values for `PAYPLUS` must exactly match today's live constants** (29900/199000/60, `ILS`) — nothing changes for an existing or new Israeli clinic the moment this ships. `STRIPE` seeds with 7900/53000/60, `USD` — unused until the Stripe integration (a separate, later plan) exists.
- **`he.ts` is the dictionary source of truth; `en.ts` must receive every new key in the same commit.** `he.ts` is not `as const`.
- **Every server action returns `{ ok: true } | { ok: false; error: string }`**, matching `src/server/country-actions.ts`'s `ActionResult` pattern — follow that file's shape closely (it's this plan's closest sibling: an admin-editable table with a create/update action and a matching client form).
- **Test file naming:** `*.integration.test.ts` for anything touching the real Postgres database (`describe.skipIf(!hasDb)`). Local DB: `docker start dentalcompare-db` before running `npm test`.

---

### Task 1: Schema — `SubscriptionPricing` and its seed rows

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_subscription_pricing/migration.sql`
- Test: `src/server/subscription-pricing-schema.integration.test.ts`

**Interfaces:**
- Produces: `SubscriptionProvider` enum (`PAYPLUS | STRIPE`), importable as `import type { SubscriptionProvider } from "@/generated/prisma/enums"`.
- Produces: `SubscriptionPricing` model — `provider` (PK), `currency`, `monthlyPriceMinor`, `yearlyPriceMinor`, `trialDays`, `updatedAt`, `updatedBy`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/subscription-pricing-schema.integration.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;

describe.skipIf(!hasDb)("SubscriptionPricing seed rows", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, 60_000);

  it("seeds PAYPLUS with today's live values, unchanged", async () => {
    const row = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "PAYPLUS" } });
    expect(row.currency).toBe("ILS");
    expect(row.monthlyPriceMinor).toBe(29900);
    expect(row.yearlyPriceMinor).toBe(199000);
    expect(row.trialDays).toBe(60);
  });

  it("seeds STRIPE with the agreed default, ready but unused", async () => {
    const row = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "STRIPE" } });
    expect(row.currency).toBe("USD");
    expect(row.monthlyPriceMinor).toBe(7900);
    expect(row.yearlyPriceMinor).toBe(53000);
    expect(row.trialDays).toBe(60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- subscription-pricing-schema` (needs `docker start dentalcompare-db` first)
Expected: FAIL — `db.subscriptionPricing` does not exist.

- [ ] **Step 3: Add the enum and model to the schema**

In `prisma/schema.prisma`, add near the other enums:

```prisma
enum SubscriptionProvider {
  PAYPLUS
  STRIPE
}
```

Add the model near `ClinicSubscription`:

```prisma
/// One row per payment provider. Eden edits monthlyPriceMinor, yearlyPriceMinor
/// and trialDays from the admin panel — currency is fixed per provider and never
/// exposed for editing. A price change here affects only a subscription created
/// AFTER the change; ClinicSubscription snapshots its own price at creation.
model SubscriptionPricing {
  provider          SubscriptionProvider @id
  currency          String
  monthlyPriceMinor Int
  yearlyPriceMinor  Int
  trialDays         Int
  updatedAt         DateTime             @updatedAt
  updatedBy         String?
}
```

- [ ] **Step 4: Write the migration**

Pick a timestamp later than the most recent existing migration folder (check `prisma/migrations/` and use the next minute). Example using `20260903090000`:

```sql
-- prisma/migrations/20260903090000_subscription_pricing/migration.sql
CREATE TYPE "SubscriptionProvider" AS ENUM ('PAYPLUS', 'STRIPE');

CREATE TABLE "SubscriptionPricing" (
  "provider"          "SubscriptionProvider" NOT NULL,
  "currency"          TEXT NOT NULL,
  "monthlyPriceMinor" INTEGER NOT NULL,
  "yearlyPriceMinor"  INTEGER NOT NULL,
  "trialDays"         INTEGER NOT NULL,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  "updatedBy"         TEXT,

  CONSTRAINT "SubscriptionPricing_pkey" PRIMARY KEY ("provider")
);

-- Seed values. PAYPLUS matches today's live SUBSCRIPTION_PLANS/TRIAL_DAYS
-- exactly — nothing changes for an existing or new Israeli clinic the moment
-- this migration runs. STRIPE is a placeholder default, unused until the
-- Stripe integration exists.
INSERT INTO "SubscriptionPricing" ("provider", "currency", "monthlyPriceMinor", "yearlyPriceMinor", "trialDays", "updatedAt")
VALUES
  ('PAYPLUS', 'ILS', 29900, 199000, 60, now()),
  ('STRIPE', 'USD', 7900, 53000, 60, now());
```

- [ ] **Step 5: Apply the migration and regenerate the client**

Run: `docker start dentalcompare-db && npx prisma migrate dev` (confirm the generated migration name matches the folder above), then `npx prisma generate`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- subscription-pricing-schema`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/server/subscription-pricing-schema.integration.test.ts
git commit -m "feat(billing): add SubscriptionPricing, seeded to match today's live PayPlus values exactly"
```

---

### Task 2: Read helper, validation, and the `updatePricing` action

**Files:**
- Create: `src/lib/subscription-pricing.ts`
- Create: `src/lib/subscription-pricing.test.ts`
- Create: `src/server/pricing-actions.ts`
- Create: `src/server/pricing-actions.integration.test.ts`
- Modify: `src/i18n/dictionaries/he.ts`, `src/i18n/dictionaries/en.ts`

**Interfaces:**
- Consumes: `toMinor`/`toMajor` from `@/lib/money`, `requireAdmin` from `@/server/admin`, `audit` from `@/lib/audit`, the `ActionResult` pattern from `src/server/country-actions.ts`.
- Produces: `export async function getSubscriptionPricing(provider: SubscriptionProvider)` returning the row (throws if missing — missing means the seed didn't run, which is a deploy defect, not a normal runtime case). `export type RawPricingInput = { monthlyPriceMajor: string; yearlyPriceMajor: string; trialDays: string }`. `export type PricingField = keyof RawPricingInput`. `export type ParsedPricing = { monthlyPriceMinor: number; yearlyPriceMinor: number; trialDays: number }`. `export function parsePricingInput(raw: RawPricingInput, currency: string): { ok: true; value: ParsedPricing } | { ok: false; field: PricingField }`. `export type ActionResult = { ok: true } | { ok: false; error: string }`. `export async function updatePricing(formData: FormData): Promise<ActionResult>`.

- [ ] **Step 1: Write the failing tests for the pure validator**

```ts
// src/lib/subscription-pricing.test.ts
import { describe, it, expect } from "vitest";
import { parsePricingInput } from "./subscription-pricing";

describe("parsePricingInput", () => {
  it("accepts valid input and converts major units to minor", () => {
    const result = parsePricingInput(
      { monthlyPriceMajor: "299", yearlyPriceMajor: "1990", trialDays: "60" },
      "ILS",
    );
    expect(result).toEqual({
      ok: true,
      value: { monthlyPriceMinor: 29900, yearlyPriceMinor: 199000, trialDays: 60 },
    });
  });

  it("rejects a non-positive monthly price", () => {
    const result = parsePricingInput(
      { monthlyPriceMajor: "0", yearlyPriceMajor: "1990", trialDays: "60" },
      "ILS",
    );
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("rejects a non-positive yearly price", () => {
    const result = parsePricingInput(
      { monthlyPriceMajor: "299", yearlyPriceMajor: "-5", trialDays: "60" },
      "ILS",
    );
    expect(result).toEqual({ ok: false, field: "yearlyPriceMajor" });
  });

  it("rejects trial days outside 1-365", () => {
    expect(
      parsePricingInput({ monthlyPriceMajor: "299", yearlyPriceMajor: "1990", trialDays: "0" }, "ILS"),
    ).toEqual({ ok: false, field: "trialDays" });
    expect(
      parsePricingInput(
        { monthlyPriceMajor: "299", yearlyPriceMajor: "1990", trialDays: "400" },
        "ILS",
      ),
    ).toEqual({ ok: false, field: "trialDays" });
  });

  it("rejects non-numeric input", () => {
    const result = parsePricingInput(
      { monthlyPriceMajor: "abc", yearlyPriceMajor: "1990", trialDays: "60" },
      "ILS",
    );
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("floors a fractional trial-days input", () => {
    const result = parsePricingInput(
      { monthlyPriceMajor: "299", yearlyPriceMajor: "1990", trialDays: "60.7" },
      "ILS",
    );
    expect(result).toEqual({
      ok: true,
      value: { monthlyPriceMinor: 29900, yearlyPriceMinor: 199000, trialDays: 60 },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- subscription-pricing.test`
Expected: FAIL — `./subscription-pricing` does not exist.

- [ ] **Step 3: Implement the pure validator and the read helper**

```ts
// src/lib/subscription-pricing.ts
import "server-only";
import { db } from "@/lib/db";
import { toMinor } from "@/lib/money";
import type { SubscriptionProvider } from "@/generated/prisma/enums";

/**
 * Reads one provider's current price/trial settings. Throws if the row is
 * missing — every provider has a seeded row (Task 1's migration), so a miss
 * here means the seed never ran, which is a deploy defect worth a loud crash
 * rather than a silently-free subscription.
 */
export async function getSubscriptionPricing(provider: SubscriptionProvider) {
  return db.subscriptionPricing.findUniqueOrThrow({ where: { provider } });
}

export type RawPricingInput = {
  monthlyPriceMajor: string;
  yearlyPriceMajor: string;
  trialDays: string;
};

export type PricingField = keyof RawPricingInput;

export type ParsedPricing = {
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  trialDays: number;
};

export type ParseResult = { ok: true; value: ParsedPricing } | { ok: false; field: PricingField };

/**
 * Validation for admin-entered pricing. Free of database and server-only
 * imports (aside from the currency-aware `toMinor` conversion), mirroring
 * `src/lib/country-input.ts` so it can be unit-tested without a database.
 */
export function parsePricingInput(raw: RawPricingInput, currency: string): ParseResult {
  const monthlyMajor = Number(raw.monthlyPriceMajor);
  if (!Number.isFinite(monthlyMajor) || monthlyMajor <= 0) {
    return { ok: false, field: "monthlyPriceMajor" };
  }

  const yearlyMajor = Number(raw.yearlyPriceMajor);
  if (!Number.isFinite(yearlyMajor) || yearlyMajor <= 0) {
    return { ok: false, field: "yearlyPriceMajor" };
  }

  const trialDays = Math.floor(Number(raw.trialDays));
  if (!Number.isFinite(trialDays) || trialDays < 1 || trialDays > 365) {
    return { ok: false, field: "trialDays" };
  }

  return {
    ok: true,
    value: {
      monthlyPriceMinor: toMinor(monthlyMajor, currency),
      yearlyPriceMinor: toMinor(yearlyMajor, currency),
      trialDays,
    },
  };
}
```

Note: `getSubscriptionPricing` is `server-only`, so it cannot live in the same import chain as a plain unit test importing `parsePricingInput` if that test also transitively imports `db`. Keep both exports in this one file (matching the brief) — vitest's node environment can import `server-only` without executing browser-only checks, and the existing codebase already mixes `server-only` re-exports with tested pure functions this way (see `src/lib/clinic-documents.ts`). If the test run fails specifically on the `server-only` import, move `parsePricingInput` to its own file (`src/lib/pricing-input.ts`, no `server-only`) and re-export it from `subscription-pricing.ts` — check this only if Step 4 below actually fails on that import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- subscription-pricing.test`
Expected: PASS (6 tests)

- [ ] **Step 5: Write the failing tests for `updatePricing`**

```ts
// src/server/pricing-actions.integration.test.ts
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import type { db as Db } from "@/lib/db";
import type { updatePricing as UpdatePricingFn } from "@/server/pricing-actions";

const authState = { clerkUserId: "" };
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: authState.clerkUserId }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let updatePricing: typeof UpdatePricingFn;

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe.skipIf(!hasDb)("updatePricing", () => {
  const DB_TIMEOUT = 60_000;
  let originalPayplusRow: { monthlyPriceMinor: number; yearlyPriceMinor: number; trialDays: number };

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ updatePricing } = await import("@/server/pricing-actions"));
    // ADMIN_EMAILS must include this address locally for requireAdmin to pass —
    // reuse whatever the existing admin-actions integration tests rely on by
    // reading it the same way; if none is configured, check
    // src/server/admin-actions.integration.test.ts for the convention this repo
    // already uses to authenticate as an admin in a test.
    const admin = await db.user.upsert({
      where: { clerkUserId: "pricing_admin_test" },
      create: {
        clerkUserId: "pricing_admin_test",
        fullName: "Admin",
        email: process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ?? "admin@example.com",
      },
      update: {},
    });
    authState.clerkUserId = admin.clerkUserId;
    originalPayplusRow = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "PAYPLUS" } });
  }, DB_TIMEOUT);

  afterEach(async () => {
    // Restore PAYPLUS to its seeded values so other suites (and this file's
    // schema test) are never left reading a mutated row.
    await db.subscriptionPricing.update({
      where: { provider: "PAYPLUS" },
      data: originalPayplusRow,
    });
  }, DB_TIMEOUT);

  it("updates a provider's price and trial days, converting major to minor", async () => {
    const result = await updatePricing(
      formData({ provider: "PAYPLUS", monthlyPriceMajor: "350", yearlyPriceMajor: "2200", trialDays: "45" }),
    );

    expect(result.ok).toBe(true);
    const row = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "PAYPLUS" } });
    expect(row.monthlyPriceMinor).toBe(35000);
    expect(row.yearlyPriceMinor).toBe(220000);
    expect(row.trialDays).toBe(45);
  });

  it("leaves currency untouched — it is never taken from the form", async () => {
    await updatePricing(
      formData({ provider: "PAYPLUS", monthlyPriceMajor: "350", yearlyPriceMajor: "2200", trialDays: "45" }),
    );
    const row = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "PAYPLUS" } });
    expect(row.currency).toBe("ILS");
  });

  it("refuses invalid input and leaves the row unchanged", async () => {
    const result = await updatePricing(
      formData({ provider: "PAYPLUS", monthlyPriceMajor: "-1", yearlyPriceMajor: "2200", trialDays: "45" }),
    );

    expect(result.ok).toBe(false);
    const row = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "PAYPLUS" } });
    expect(row.monthlyPriceMinor).toBe(originalPayplusRow.monthlyPriceMinor);
  });

  it("refuses an unknown provider", async () => {
    const result = await updatePricing(
      formData({ provider: "NOT_A_PROVIDER", monthlyPriceMajor: "350", yearlyPriceMajor: "2200", trialDays: "45" }),
    );
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm test -- src/server/pricing-actions.integration.test.ts`
Expected: FAIL — `@/server/pricing-actions` does not exist.

- [ ] **Step 7: Implement `updatePricing`**

```ts
// src/server/pricing-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { audit } from "@/lib/audit";
import { parsePricingInput, type PricingField } from "@/lib/subscription-pricing";
import type { SubscriptionProvider } from "@/generated/prisma/enums";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fieldLabel(t: Dictionary, field: PricingField): string {
  const labels: Record<PricingField, string> = {
    monthlyPriceMajor: t.admin.fieldMonthlyPrice,
    yearlyPriceMajor: t.admin.fieldYearlyPrice,
    trialDays: t.admin.fieldTrialDays,
  };
  return labels[field];
}

export async function updatePricing(formData: FormData): Promise<ActionResult> {
  const t = await getDictionary(await getRequestLocale());
  const admin = await requireAdmin();

  const providerRaw = String(formData.get("provider") ?? "");
  if (providerRaw !== "PAYPLUS" && providerRaw !== "STRIPE") {
    return { ok: false, error: t.errors.pricingNotFound };
  }
  const provider = providerRaw as SubscriptionProvider;

  const existing = await db.subscriptionPricing.findUnique({ where: { provider } });
  if (!existing) return { ok: false, error: t.errors.pricingNotFound };

  const parsed = parsePricingInput(
    {
      monthlyPriceMajor: String(formData.get("monthlyPriceMajor") ?? ""),
      yearlyPriceMajor: String(formData.get("yearlyPriceMajor") ?? ""),
      trialDays: String(formData.get("trialDays") ?? ""),
    },
    existing.currency,
  );
  if (!parsed.ok) {
    return {
      ok: false,
      error: format(t.errors.pricingInvalidField, { field: fieldLabel(t, parsed.field) }),
    };
  }

  await db.subscriptionPricing.update({
    where: { provider },
    data: { ...parsed.value, updatedBy: admin.email },
  });

  await audit({
    actor: admin.email,
    action: "pricing.update",
    entity: "SubscriptionPricing",
    entityId: provider,
    metadata: {
      old: {
        monthlyPriceMinor: existing.monthlyPriceMinor,
        yearlyPriceMinor: existing.yearlyPriceMinor,
        trialDays: existing.trialDays,
      },
      new: parsed.value,
    },
  });

  revalidatePath("/admin/subscriptions");
  return { ok: true };
}
```

- [ ] **Step 8: Add the dictionary keys**

In `src/i18n/dictionaries/he.ts`, inside `errors`, near `countryInvalidField`/`countryCodeTaken`:

```ts
    pricingInvalidField: "ערך לא תקין בשדה: {field}",
    pricingNotFound: "ספק תשלומים לא נמצא",
```

In `src/i18n/dictionaries/en.ts`, matching position in `errors`:

```ts
    pricingInvalidField: "Invalid value in field: {field}",
    pricingNotFound: "Payment provider not found",
```

In `he.ts`, inside `admin`, add (exact insertion point and neighboring keys chosen in Task 3, since that's where the rest of the pricing-panel labels are added — for this task, only these three field labels are strictly required by `fieldLabel` above):

```ts
    fieldMonthlyPrice: "מחיר חודשי",
    fieldYearlyPrice: "מחיר שנתי",
    fieldTrialDays: "ימי ניסיון",
```

Matching English in `en.ts`:

```ts
    fieldMonthlyPrice: "Monthly price",
    fieldYearlyPrice: "Yearly price",
    fieldTrialDays: "Trial days",
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm test -- src/server/pricing-actions.integration.test.ts`
Expected: PASS (4 tests). If `requireAdmin()` redirects instead of returning the admin user in your local environment, check `ADMIN_EMAILS` is set in `.env.local` and includes the test's admin address — see how `src/server/admin-actions.integration.test.ts` authenticates as an admin and match its exact setup.

- [ ] **Step 10: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/subscription-pricing.ts src/lib/subscription-pricing.test.ts src/server/pricing-actions.ts src/server/pricing-actions.integration.test.ts src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "feat(billing): validated, audited updatePricing action for the admin panel"
```

---

### Task 3: Admin edit panel

**Files:**
- Create: `src/components/admin/pricing-settings-form.tsx`
- Modify: `src/app/[locale]/admin/subscriptions/page.tsx`
- Modify: `src/i18n/dictionaries/he.ts`, `src/i18n/dictionaries/en.ts`

**Interfaces:**
- Consumes: `updatePricing` from `@/server/pricing-actions` (Task 2).
- Produces: `PricingSettingsForm({ rows }: { rows: Array<{ provider: "PAYPLUS" | "STRIPE"; currency: string; monthlyPriceMinor: number; yearlyPriceMinor: number; trialDays: number; updatedAt: Date; updatedBy: string | null }> })` — client component, one editable row per provider.

- [ ] **Step 1: Write the component**

```tsx
// src/components/admin/pricing-settings-form.tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useT, useLocale } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { toMajor } from "@/lib/money";
import { updatePricing } from "@/server/pricing-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const inputClass =
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-24 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";

type PricingRow = {
  provider: "PAYPLUS" | "STRIPE";
  currency: string;
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  trialDays: number;
  updatedAt: Date;
  updatedBy: string | null;
};

export function PricingSettingsForm({ rows }: { rows: PricingRow[] }) {
  const t = useT();
  const locale = useLocale();

  return (
    <section className="border-border/60 bg-card rounded-2xl border p-5">
      <h2 className="text-foreground font-semibold">{t.admin.pricingHeading}</h2>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <PricingRowForm key={row.provider} row={row} />
        ))}
      </div>
    </section>
  );

  function PricingRowForm({ row }: { row: PricingRow }) {
    const [isPending, startTransition] = useTransition();
    const providerLabel =
      row.provider === "PAYPLUS" ? t.admin.pricingProviderPayPlus : t.admin.pricingProviderStripe;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      startTransition(async () => {
        const result = await updatePricing(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(t.admin.pricingUpdated);
      });
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="border-border/60 flex flex-wrap items-end gap-4 border-t pt-4 first:border-t-0 first:pt-0"
      >
        <input type="hidden" name="provider" value={row.provider} />
        <div className="min-w-[7rem]">
          <p className="text-foreground text-sm font-semibold">{providerLabel}</p>
          <p className="text-muted-foreground text-xs">{row.currency}</p>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t.admin.fieldMonthlyPrice}</span>
          <input
            name="monthlyPriceMajor"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={toMajor(row.monthlyPriceMinor, row.currency)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t.admin.fieldYearlyPrice}</span>
          <input
            name="yearlyPriceMajor"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={toMajor(row.yearlyPriceMinor, row.currency)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t.admin.fieldTrialDays}</span>
          <input
            name="trialDays"
            type="number"
            step="1"
            min="1"
            max="365"
            required
            defaultValue={row.trialDays}
            className={inputClass}
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className={cn(
            buttonVariants(),
            "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold disabled:opacity-60",
          )}
        >
          {isPending ? t.selection.saving : t.admin.pricingSave}
        </button>

        {row.updatedBy && (
          <p className="text-muted-foreground w-full text-xs">
            {format(t.admin.pricingLastUpdated, {
              email: row.updatedBy,
              date: new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
                row.updatedAt,
              ),
            })}
          </p>
        )}
      </form>
    );
  }
}
```

- [ ] **Step 2: Add the dictionary keys**

In `he.ts`, inside `admin`, near the three field keys added in Task 2:

```ts
    pricingHeading: "מחיר וניסיון חינם",
    pricingProviderPayPlus: "PayPlus (ישראל)",
    pricingProviderStripe: "Stripe (בינלאומי)",
    pricingSave: "שמירה",
    pricingUpdated: "העדכון נשמר",
    pricingLastUpdated: "עודכן לאחרונה על ידי {email} · {date}",
```

Matching English in `en.ts`:

```ts
    pricingHeading: "Price & free trial",
    pricingProviderPayPlus: "PayPlus (Israel)",
    pricingProviderStripe: "Stripe (international)",
    pricingSave: "Save",
    pricingUpdated: "Update saved",
    pricingLastUpdated: "Last updated by {email} · {date}",
```

- [ ] **Step 3: Wire it into the admin subscriptions page**

In `src/app/[locale]/admin/subscriptions/page.tsx`:

1. Import: `import { PricingSettingsForm } from "@/components/admin/pricing-settings-form";`
2. After `await requireAdmin();`, fetch both rows:
   ```ts
   const pricingRows = await db.subscriptionPricing.findMany({ orderBy: { provider: "asc" } });
   ```
3. Render `<PricingSettingsForm rows={pricingRows} />` right after the `<header>` block, before the existing subscriptions table:
   ```tsx
   <header>
     ...
   </header>

   <PricingSettingsForm rows={pricingRows} />

   <div className="border-border/60 bg-card overflow-hidden rounded-2xl border">
     ...existing table...
   ```

- [ ] **Step 4: Manual check and typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors. (No new automated test for this task — it's UI wiring over an already-tested action; manual verification happens in the final task's browser pass.)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/pricing-settings-form.tsx "src/app/[locale]/admin/subscriptions/page.tsx" src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "feat(admin): price and trial length are editable from the subscriptions screen"
```

---

### Task 4: `constants.ts` interval split, `subscription.ts`, and `admin-actions.ts`

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/subscription.ts`
- Modify: `src/lib/subscription.test.ts` (extend if it exists — check first with `find src/lib -iname "subscription.test.ts"`; create if absent)
- Modify: `src/server/admin-actions.ts`
- Modify: `src/server/admin-actions.integration.test.ts` (extend existing tests only if they assert exact price/trial values that this task changes the source of — read the file first to check)

**Interfaces:**
- Consumes: `getSubscriptionPricing` from `@/lib/subscription-pricing` (Task 2).
- Produces: `PLAN_INTERVAL_MONTHS` (replaces `SUBSCRIPTION_PLANS` as the source of `intervalMonths`; `SUBSCRIPTION_PLANS` and `TRIAL_DAYS` themselves are NOT deleted yet — Task 8 deletes them once every consumer has migrated). `trialEndFrom(approvedAt: Date, trialDays: number): Date` (signature change: `trialDays` is now a parameter, not read from a constant).

- [ ] **Step 1: Add `PLAN_INTERVAL_MONTHS` to constants.ts, alongside the still-live `SUBSCRIPTION_PLANS`**

In `src/lib/constants.ts`, right before the `SUBSCRIPTION_PLANS` block, add:

```ts
// How many months one billing period is. Structural, not a price — Eden has
// never asked to edit what "monthly" or "yearly" means, only what they cost.
export const PLAN_INTERVAL_MONTHS = { MONTHLY: 1, YEARLY: 12 } as const;
export type SubscriptionPlanType = keyof typeof PLAN_INTERVAL_MONTHS;
```

`SubscriptionPlanType` is currently exported from the `SUBSCRIPTION_PLANS` block below — remove the old `export type SubscriptionPlanType = keyof typeof SUBSCRIPTION_PLANS;` line so the type has exactly one definition (the new one above). Leave `SUBSCRIPTION_PLANS` and `TRIAL_DAYS` themselves untouched for now — every other file in this task still imports them; only this one duplicate type export is removed.

- [ ] **Step 2: Check for an existing pure-function test file for `subscription.ts`**

Run: `find src/lib -iname "subscription.test.ts"`. If it exists, read it in full — you'll extend it in Step 3. If not, you're creating it fresh.

- [ ] **Step 3: Write the failing test for `trialEndFrom`'s new signature and `nextPeriodEnd`'s unchanged behavior**

Add to (or create) `src/lib/subscription.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { trialEndFrom, nextPeriodEnd } from "./subscription";

describe("trialEndFrom", () => {
  it("adds the given number of trial days, not a hardcoded 60", () => {
    const approvedAt = new Date("2026-01-01T00:00:00.000Z");
    const result = trialEndFrom(approvedAt, 45);
    expect(result.toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });
});

describe("nextPeriodEnd", () => {
  it("still adds 1 month for MONTHLY and 12 for YEARLY, from PLAN_INTERVAL_MONTHS", () => {
    const from = new Date("2026-01-15T00:00:00.000Z");
    expect(nextPeriodEnd(from, "MONTHLY").toISOString()).toBe("2026-02-15T00:00:00.000Z");
    expect(nextPeriodEnd(from, "YEARLY").toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });
});
```

If `subscription.test.ts` already existed with other tests (e.g. for `isDueForRenewal`, `isWithinGrace`, `dueTrialWarning`), leave those untouched — only add the two blocks above, or update an existing `trialEndFrom` test if one already asserts the OLD single-argument signature (search for `trialEndFrom(` in the existing file before adding a duplicate describe block).

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- src/lib/subscription.test.ts`
Expected: FAIL — `trialEndFrom` still takes one argument, so `trialEndFrom(approvedAt, 45)` either errors under `tsc` or silently ignores the second argument today (it currently reads the module-level `TRIAL_DAYS` constant regardless of what's passed) — confirm the failure is the wrong result (60 days added, not 45), not a compile error, before moving on.

- [ ] **Step 5: Update `subscription.ts`**

In `src/lib/subscription.ts`:

1. Change the import line from:
   ```ts
   import {
     SUBSCRIPTION_PLANS,
     RENEWAL_LEAD_DAYS,
     PAST_DUE_GRACE_DAYS,
     TRIAL_DAYS,
     TRIAL_WARNING_DAYS_BEFORE,
     type SubscriptionPlanType,
   } from "./constants";
   ```
   to:
   ```ts
   import {
     PLAN_INTERVAL_MONTHS,
     RENEWAL_LEAD_DAYS,
     PAST_DUE_GRACE_DAYS,
     TRIAL_WARNING_DAYS_BEFORE,
     type SubscriptionPlanType,
   } from "./constants";
   ```
2. Change `trialEndFrom`:
   ```ts
   /** End of the free trial, counted from admin approval (PRD 4.4). */
   export function trialEndFrom(approvedAt: Date, trialDays: number): Date {
     return new Date(approvedAt.getTime() + trialDays * DAY_MS);
   }
   ```
3. Delete the `planPrice` function entirely (lines 52-56 in the current file) — it has no callers anywhere in the codebase (verify with `grep -rn "planPrice" src --include=*.ts --include=*.tsx` before deleting; if you find a caller the plan missed, stop and report it instead of deleting).
4. Change `nextPeriodEnd`:
   ```ts
   export function nextPeriodEnd(from: Date, plan: SubscriptionPlanType): Date {
     return addMonths(from, PLAN_INTERVAL_MONTHS[plan]);
   }
   ```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/lib/subscription.test.ts`
Expected: PASS

- [ ] **Step 7: Update `admin-actions.ts`'s two call sites**

Read `src/server/admin-actions.ts` in full around both usages before editing (the exact surrounding code may have shifted slightly from what this plan saw).

At the `approveClinic` call site (both `trialEndFrom(approvedAt)` occurrences — one in the `db.dentist.update`/`clinicSubscription.update` data, one building the response object), and at the `createDentist` call site (`SUBSCRIPTION_PLANS.MONTHLY.priceMinor`/`.currency`):

1. Add the import: `import { getSubscriptionPricing } from "@/lib/subscription-pricing";`
2. At the top of `approveClinic` (before it computes `trialEndsAt`), fetch pricing once:
   ```ts
   const pricing = await getSubscriptionPricing("PAYPLUS");
   ```
   Replace both `trialEndFrom(approvedAt)` calls with `trialEndFrom(approvedAt, pricing.trialDays)`.
3. At the top of `createDentist` (before the `db.$transaction` call that creates the dentist + subscription), fetch pricing once the same way:
   ```ts
   const pricing = await getSubscriptionPricing("PAYPLUS");
   ```
   Replace:
   ```ts
   priceMinor: SUBSCRIPTION_PLANS.MONTHLY.priceMinor,
   currency: SUBSCRIPTION_PLANS.MONTHLY.currency,
   ```
   with:
   ```ts
   priceMinor: pricing.monthlyPriceMinor,
   currency: pricing.currency,
   ```
4. Remove the now-unused `import { SUBSCRIPTION_PLANS } from "@/lib/constants";` line from this file ONLY if nothing else in the file still references `SUBSCRIPTION_PLANS` — grep the file first (`grep -n "SUBSCRIPTION_PLANS" src/server/admin-actions.ts`) to confirm both occurrences were the two just replaced.

- [ ] **Step 8: Check the existing admin-actions integration test for hardcoded expectations**

Run: `grep -n "trialEndFrom\|SUBSCRIPTION_PLANS\|29900\|199000\|priceMinor" src/server/admin-actions.integration.test.ts`. If any test asserts a specific `trialEndsAt` computed from the old 60-day constant, or a specific `priceMinor`/`currency` value, it should still pass unchanged (Task 1's seed values match the old constants exactly) — but confirm by running the suite, and only edit the test file if a genuine mismatch appears (e.g. a test that mocked `getSubscriptionPricing` and needs a real DB row instead — this suite likely already runs against a real database like its siblings, so no new mock should be needed).

- [ ] **Step 9: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/constants.ts src/lib/subscription.ts src/lib/subscription.test.ts src/server/admin-actions.ts
git commit -m "refactor(billing): approveClinic and createDentist read price/trial from SubscriptionPricing"
```

---

### Task 5: Paid registration flow — `clinic-registration.ts` and `subscriptions.ts`

**Files:**
- Modify: `src/server/subscriptions.ts`
- Modify: `src/server/clinic-registration.ts`
- Test: check for `src/server/subscriptions.test.ts` or `.integration.test.ts` first (`find src/server -iname "subscriptions.*test.ts"`); extend if found, else add a focused test to `src/server/clinic-registration.integration.test.ts` if that exists, else create `src/server/subscriptions.integration.test.ts`.

**Interfaces:**
- Consumes: `getSubscriptionPricing` from `@/lib/subscription-pricing` (Task 2).
- Produces: `createPendingSubscription` signature change — `priceMinor`/`currency` become required arguments instead of being derived internally from `SUBSCRIPTION_PLANS[args.plan]`.

- [ ] **Step 1: Check for existing tests covering `createPendingSubscription` or clinic registration's subscription row**

Run: `find src/server -iname "subscriptions*test*" -o -iname "clinic-registration*test*"`. Read whatever exists in full before writing new tests — extend rather than duplicate coverage.

- [ ] **Step 2: Write the failing test**

If `src/server/subscriptions.integration.test.ts` (or an equivalent) doesn't already cover this, add:

```ts
// (new file if none exists) src/server/subscriptions.integration.test.ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { createPendingSubscription as CreatePendingFn } from "@/server/subscriptions";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let createPendingSubscription: typeof CreatePendingFn;
const created = { dentistIds: [] as string[] };

describe.skipIf(!hasDb)("createPendingSubscription", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ createPendingSubscription } = await import("@/server/subscriptions"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
  }, DB_TIMEOUT);

  it("stores the exact priceMinor/currency it was given, not a hardcoded value", async () => {
    const sfx = randomUUID().slice(0, 8);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `pend_${sfx}@example.com`,
        phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
        city: "Tel Aviv",
        address: "1 Main St",
        experienceYears: 5,
      },
    });
    created.dentistIds.push(dentist.id);

    await createPendingSubscription({
      dentistId: dentist.id,
      plan: "MONTHLY",
      setupToken: randomUUID(),
      priceMinor: 12345,
      currency: "USD",
    });

    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId: dentist.id } });
    expect(sub.priceMinor).toBe(12345);
    expect(sub.currency).toBe("USD");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/server/subscriptions.integration.test.ts`
Expected: FAIL — `createPendingSubscription` doesn't accept `priceMinor`/`currency` yet, so `tsc` rejects the call (or, if run without a type check, the row ends up with whatever `SUBSCRIPTION_PLANS.MONTHLY` currently resolves to instead of `12345`/`USD`).

- [ ] **Step 4: Update `createPendingSubscription`**

In `src/server/subscriptions.ts`, remove the `SUBSCRIPTION_PLANS` import (this file's only use of it) and change the function:

```ts
export async function createPendingSubscription(
  args: {
    dentistId: string;
    plan: SubscriptionPlanType;
    setupToken: string;
    priceMinor: number;
    currency: string;
  },
  client: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  await client.clinicSubscription.create({
    data: {
      dentistId: args.dentistId,
      plan: args.plan,
      priceMinor: args.priceMinor,
      currency: args.currency,
      setupToken: args.setupToken,
      status: "PENDING",
    },
  });
}
```

- [ ] **Step 5: Update the one caller, `clinic-registration.ts`**

Read the file in full first. Add the import: `import { getSubscriptionPricing } from "@/lib/subscription-pricing";`

Before the `db.$transaction` block that creates the dentist and calls `createPendingSubscription` (find where `plan` and `setupToken` are already available — likely right before the transaction opens), fetch pricing:

```ts
const pricing = await getSubscriptionPricing("PAYPLUS");
```

Change the call site from:

```ts
await createPendingSubscription({ dentistId: dentist.id, plan, setupToken }, tx);
```

to:

```ts
const priceMinor = plan === "MONTHLY" ? pricing.monthlyPriceMinor : pricing.yearlyPriceMinor;
await createPendingSubscription(
  { dentistId: dentist.id, plan, setupToken, priceMinor, currency: pricing.currency },
  tx,
);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- src/server/subscriptions.integration.test.ts` and the existing `clinic-registration` test suite (`find src/server -iname "clinic-registration*test*"` to name it exactly).
Expected: PASS.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/server/subscriptions.ts src/server/clinic-registration.ts src/server/subscriptions.integration.test.ts
git commit -m "refactor(billing): a new registration reads its price from SubscriptionPricing, not a hardcoded plan"
```

---

### Task 6: Client-facing display — plan picker, registration form, join page, billing page

**Files:**
- Modify: `src/components/clinics/plan-picker.tsx`
- Modify: `src/components/clinics/registration-form.tsx`
- Modify: `src/app/[locale]/clinics/join/page.tsx`
- Modify: `src/app/[locale]/clinics/billing/[token]/page.tsx`
- Modify: `src/app/api/cron/renew-subscriptions/route.ts` (dead-import cleanup only, no behavior change)

**Interfaces:**
- Consumes: `getSubscriptionPricing` from `@/lib/subscription-pricing` (Task 2).
- Produces: `PlanPicker({ defaultValue, monthly, yearly }: { defaultValue?; monthly: { priceMinor: number; currency: string }; yearly: { priceMinor: number; currency: string } })`. `RegistrationForm` gains `pricing: { monthly: {...}; yearly: {...}; trialDays: number }` in its existing props object (alongside the current `countries` prop).

- [ ] **Step 1: Update `PlanPicker`**

In `src/components/clinics/plan-picker.tsx`, remove `import { SUBSCRIPTION_PLANS } from "@/lib/constants";` and change the signature:

```tsx
export function PlanPicker({
  defaultValue = "MONTHLY",
  monthly,
  yearly,
}: {
  defaultValue?: "MONTHLY" | "YEARLY";
  monthly: { priceMinor: number; currency: string };
  yearly: { priceMinor: number; currency: string };
}) {
```

Replace the two `formatMoney(SUBSCRIPTION_PLANS.MONTHLY.priceMinor, SUBSCRIPTION_PLANS.MONTHLY.currency, locale)` / `.YEARLY.` calls with `formatMoney(monthly.priceMinor, monthly.currency, locale)` and `formatMoney(yearly.priceMinor, yearly.currency, locale)` respectively.

- [ ] **Step 2: Update `RegistrationForm`**

Read the file in full first (it's large — over 500 lines). Remove `SUBSCRIPTION_PLANS, TRIAL_DAYS` from the `@/lib/constants` import (keep `SPECIALTIES, SPOKEN_LANGUAGES, TREATMENTS` if still used — check before removing the whole import line).

Add a new prop to the component's props type (find the existing props destructuring near the top, alongside `countries`):

```ts
pricing: {
  monthly: { priceMinor: number; currency: string };
  yearly: { priceMinor: number; currency: string };
  trialDays: number;
};
```

Destructure `pricing` alongside `countries` wherever the component's function signature does so.

Replace the `<PlanPicker />` call:

```tsx
<PlanPicker monthly={pricing.monthly} yearly={pricing.yearly} />
```

Replace the `format(clause, { monthly: ..., yearly: ..., trialDays: TRIAL_DAYS })` block:

```tsx
{format(clause, {
  monthly: formatMoney(pricing.monthly.priceMinor, pricing.monthly.currency, locale),
  yearly: formatMoney(pricing.yearly.priceMinor, pricing.yearly.currency, locale),
  trialDays: pricing.trialDays,
})}
```

- [ ] **Step 3: Update `clinics/join/page.tsx`**

Add the imports:

```ts
import { getSubscriptionPricing } from "@/lib/subscription-pricing";
```

After `const countries = await getActiveCountries();`, add:

```ts
const pricingRow = await getSubscriptionPricing("PAYPLUS");
const pricing = {
  monthly: { priceMinor: pricingRow.monthlyPriceMinor, currency: pricingRow.currency },
  yearly: { priceMinor: pricingRow.yearlyPriceMinor, currency: pricingRow.currency },
  trialDays: pricingRow.trialDays,
};
```

Change `<RegistrationForm countries={countries} />` to `<RegistrationForm countries={countries} pricing={pricing} />`.

- [ ] **Step 4: Remove two dead imports**

Two files import `SUBSCRIPTION_PLANS` but never actually use it in the body (confirmed by reading both in full during planning) — both are leftover imports, not real consumers:

1. `src/app/[locale]/clinics/billing/[token]/page.tsx` — remove `import { SUBSCRIPTION_PLANS } from "@/lib/constants";`. It reads `sub.priceMinor`/`sub.currency` straight off the `ClinicSubscription` row, never the constant.
2. `src/app/api/cron/renew-subscriptions/route.ts` — its import line is `import { SUBSCRIPTION_PLANS, type SubscriptionPlanType } from "@/lib/constants";`. Change it to `import type { SubscriptionPlanType } from "@/lib/constants";` — keep the type import (used throughout the file as `sub.plan as SubscriptionPlanType`), drop only `SUBSCRIPTION_PLANS`.

For both files, confirm before editing with `grep -n "SUBSCRIPTION_PLANS" <file>` — it should show only the import line, nothing else, or stop and report if you find a real usage this plan missed.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors — this catches any missed prop-threading site immediately, since `PlanPicker`'s and `RegistrationForm`'s new required props make any un-updated call site a compile error.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS. (No new automated tests in this task — it's prop-threading over an already-tested read helper and already-tested registration flow; the join page and billing page are exercised by the manual walkthrough in the final task.)

- [ ] **Step 7: Commit**

```bash
git add src/components/clinics/plan-picker.tsx src/components/clinics/registration-form.tsx "src/app/[locale]/clinics/join/page.tsx" "src/app/[locale]/clinics/billing/[token]/page.tsx" "src/app/api/cron/renew-subscriptions/route.ts"
git commit -m "feat(clinics): registration and plan picker show the live, admin-set price"
```

---

### Task 7: Legal pages — refunds and terms, he/en

**Files:**
- Modify: `src/app/[locale]/refunds/content.he.tsx`
- Modify: `src/app/[locale]/refunds/content.en.tsx`
- Modify: `src/app/[locale]/terms/content.he.tsx`
- Modify: `src/app/[locale]/terms/content.en.tsx`

**Interfaces:**
- Consumes: `getSubscriptionPricing` from `@/lib/subscription-pricing` (Task 2).
- Produces: `RefundsContentHe`, `RefundsContentEn`, `TermsContentHe`, `TermsContentEn` become `async function` default exports (from synchronous today) — Next.js Server Components render an async function component transparently, no change needed at their call sites in `refunds/page.tsx`/`terms/page.tsx`.

- [ ] **Step 1: Update `refunds/content.he.tsx`**

Change the import from `import { SITE_CONFIG, SUBSCRIPTION_PLANS, TRIAL_DAYS } from "@/lib/constants";` to:

```ts
import { SITE_CONFIG } from "@/lib/constants";
import { getSubscriptionPricing } from "@/lib/subscription-pricing";
```

Change `export default function RefundsContentHe() {` to `export default async function RefundsContentHe() {`, and add right after the opening brace:

```ts
const pricing = await getSubscriptionPricing("PAYPLUS");
```

Replace the two interpolated lines:

```tsx
`כל מרפאה חדשה מקבלת תקופת התנסות חינם של ${pricing.trialDays} יום. ביטול במהלך תקופה זו אינו כרוך בחיוב כלשהו.`,
`בתום תקופת ההתנסות מתחיל החיוב: מסלול חודשי (${formatMoney(pricing.monthlyPriceMinor, pricing.currency, "he")}) או שנתי (${formatMoney(pricing.yearlyPriceMinor, pricing.currency, "he")}), המתחדש אוטומטית בתום כל תקופה.`,
```

- [ ] **Step 2: Update `refunds/content.en.tsx`, `terms/content.he.tsx`, `terms/content.en.tsx`**

Read each file first to find its exact current interpolation (the Hebrew terms page additionally imports `REQUEST_LIMITS`, which is unrelated and must stay). Apply the same three changes to each: swap the constants import for `getSubscriptionPricing`, make the default-exported function `async`, call `const pricing = await getSubscriptionPricing("PAYPLUS");` at the top, and replace `SUBSCRIPTION_PLANS.MONTHLY.priceMinor`/`.currency`, `SUBSCRIPTION_PLANS.YEARLY.priceMinor`/`.currency`, and `TRIAL_DAYS` with `pricing.monthlyPriceMinor`/`pricing.currency`, `pricing.yearlyPriceMinor`/`pricing.currency`, and `pricing.trialDays` respectively.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, visit `/he/refunds`, `/en/refunds`, `/he/terms`, `/en/terms` locally (needs `docker start dentalcompare-db` since these now read the database) and confirm each page renders with "299"/"1,990"/"60" (or their formatted equivalents) exactly as before — no visible change, only the value's source moved. This is a lightweight visual check, not a full automated test; note it as done in your report.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/refunds/content.he.tsx" "src/app/[locale]/refunds/content.en.tsx" "src/app/[locale]/terms/content.he.tsx" "src/app/[locale]/terms/content.en.tsx"
git commit -m "feat(legal): refunds and terms pages quote the live, admin-set price and trial length"
```

---

### Task 8: Delete the old constants, final verification

**Files:**
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SUBSCRIPTION_PLANS` and `TRIAL_DAYS` no longer exist.

- [ ] **Step 1: Confirm nothing still references the old constants**

Run: `grep -rln "SUBSCRIPTION_PLANS\|TRIAL_DAYS" src --include=*.ts --include=*.tsx | grep -v "src/lib/constants.ts"`. Expected: no output. If anything appears, stop — a consumer was missed in Tasks 4-7 and must be migrated before this task proceeds (do not delete the constants out from under a live import).

- [ ] **Step 2: Delete the constants**

In `src/lib/constants.ts`, remove the `SUBSCRIPTION_PLANS` block and its comment, and the `TRIAL_DAYS` line and its comment. Leave `PLAN_INTERVAL_MONTHS`, `RENEWAL_LEAD_DAYS`, `PAST_DUE_GRACE_DAYS`, `TRIAL_WARNING_DAYS_BEFORE`, and `SUBSCRIPTION_CONTRACT_VERSION` untouched.

- [ ] **Step 3: Full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors. A leftover reference anywhere would now be a compile error, not just a grep hit — this is the real proof the migration is complete.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts
git commit -m "refactor(billing): remove SUBSCRIPTION_PLANS and TRIAL_DAYS — SubscriptionPricing is the only source now"
```

---

## After Task 8

Update `docs/HANDOFF.md`: this sub-project (A of P3) is done, and the manual browser pass should confirm (a) the admin panel actually changes what a NEW registration shows and what it charges, (b) an EXISTING PENDING/TRIALING subscription's price is untouched by an admin edit made after it was created, and (c) the refunds/terms pages render correctly in both languages. Note that sub-project B (the Stripe integration itself) is unblocked and can now be spec'd — it consumes the `STRIPE` row this plan seeded but never used.
