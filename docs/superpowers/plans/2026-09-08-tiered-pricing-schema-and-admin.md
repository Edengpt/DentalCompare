# Tiered Pricing — Schema & Admin Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `tier` dimension (FREE/BASIC/PRO/FEATURED) to `SubscriptionPricing`, add monthly-request-cap and outcome-based-trial-threshold fields, and let an admin edit all 8 (provider × tier) rows at `/admin/subscriptions` — with zero behavior change for any existing clinic or registration flow.

**Architecture:** Extends the existing editable-pricing infrastructure (`SubscriptionPricing`/`updatePricing`/`getSubscriptionPricing`, shipped 2026-09-03) rather than replacing it. `SubscriptionPricing`'s primary key grows from `provider` alone to `(provider, tier)`; every current call site is updated to pass `tier: "BASIC"` explicitly, so PAYPLUS/BASIC and STRIPE/BASIC keep exactly the values (and behavior) live today. `ClinicSubscription.trialDays`/`trialEndsAt` and the calendar-based renewal cron are **not touched** — this plan is data model + admin UI only. The new `trialRequestCap`/`monthlyRequestCap` fields are present, seeded, and editable, but read by nothing yet (wired up in the next plan in this series).

**Tech Stack:** Next.js (App Router, server actions), Prisma 7 + Postgres, Vitest, this repo's existing i18n dictionary system (`src/i18n/dictionaries/{he,en}.ts`).

**Spec:** `docs/superpowers/specs/2026-09-08-tiered-pricing-model-design.md` (sections 1.1, 1.4, 1.8, 1.9, 2, 8). This is plan 1 of 6 covering that spec — the other five (request-cap enforcement + floor rule, outcome-based trial conversion, response-rate SLA, Featured inventory, Founding 50) are separate plans, written after this one lands.

## Global Constraints

- No existing clinic, test fixture, or live registration path may change price, trial length, or provider the moment this ships — every current call site must explicitly request `tier: "BASIC"` (spec 2, 8).
- The FREE tier's price is locked to exactly 0 in both currencies, enforced server-side in `parsePricingInput`, not only hidden/disabled in the UI (spec 1.9 / section 8).
- `monthlyRequestCap` is nullable — `null` means unlimited (used by FEATURED). An empty admin-form field must parse to `null`, not `0` (spec 2).
- Follow the existing convention for hand-authored migrations in this repo: generate the skeleton with `prisma migrate dev --create-only`, then replace its SQL with a reviewed, comment-explained, non-destructive migration (see `prisma/migrations/20260903120000_clinic_subscription_trial_days/migration.sql` for the pattern this repo already uses).
- Local Postgres runs in Docker (`docker start dentalcompare-db`) — start it before any step that touches the database.

---

### Task 1: Schema — `SubscriptionTier`, composite-key `SubscriptionPricing`, `ClinicSubscription.tier`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_tiered_subscription_pricing/migration.sql`
- Modify: `prisma/seed.ts`
- Modify: `src/server/subscription-pricing-schema.integration.test.ts`

**Interfaces:**
- Produces: `SubscriptionTier` enum (`FREE`/`BASIC`/`PRO`/`FEATURED`), exported from `@/generated/prisma/enums` after `prisma generate`. `SubscriptionPricing` now keyed by `(provider, tier)` — Prisma's generated compound-unique-input field is `provider_tier: { provider, tier }`. `SubscriptionPricing` gains `monthlyRequestCap: number | null` and `trialRequestCap: number`; keeps `trialDays: number` (untouched, still the live calendar-trial source). `ClinicSubscription` gains `tier: SubscriptionTier` (`@default(BASIC)`, mirroring `provider @default(PAYPLUS)` on the same model).

- [ ] **Step 1: Edit the Prisma schema**

In `prisma/schema.prisma`, add the new enum near `SubscriptionProvider`:

```prisma
enum SubscriptionTier {
  FREE
  BASIC
  PRO
  FEATURED
}
```

Change the `SubscriptionPricing` model from:

```prisma
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

to:

```prisma
model SubscriptionPricing {
  provider          SubscriptionProvider
  // The tier this row prices. FREE is locked to 0/0 by parsePricingInput
  // (Task 2), not just convention. trialDays stays the live calendar-trial
  // source for every tier until the outcome-based-trial plan replaces it;
  // trialRequestCap is present and editable now but unread until then.
  tier              SubscriptionTier
  currency          String
  monthlyPriceMinor Int
  yearlyPriceMinor  Int
  // null = unlimited (FEATURED). Unread by any query until the request-cap
  // enforcement plan.
  monthlyRequestCap Int?
  trialDays         Int
  trialRequestCap   Int
  updatedAt         DateTime             @updatedAt
  updatedBy         String?

  @@id([provider, tier])
}
```

Add `tier` to `ClinicSubscription` (find the existing `provider SubscriptionProvider @default(PAYPLUS)` field and add this immediately after it):

```prisma
  // Which pricing tier this clinic is on. Defaulted to BASIC, not FREE, for
  // the exact reason `provider` above defaults to PAYPLUS: every row created
  // before this field existed — and every write path this plan doesn't touch
  // yet — genuinely IS the one paid plan that existed before tiers did.
  tier                    SubscriptionTier     @default(BASIC)
```

- [ ] **Step 2: Generate the migration skeleton**

Run: `docker start dentalcompare-db` (ignore "already running" errors), then:
`npx prisma migrate dev --name tiered_subscription_pricing --create-only`

This creates `prisma/migrations/<timestamp>_tiered_subscription_pricing/migration.sql` with Prisma's auto-diffed (and likely destructive/prompting) SQL. Do not apply it yet — the next step replaces its contents entirely.

- [ ] **Step 3: Replace the generated SQL with a non-destructive, backfilling migration**

Overwrite the generated `migration.sql` with:

```sql
-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'BASIC', 'PRO', 'FEATURED');

-- The two rows that exist today become BASIC — the one paid plan that
-- existed before tiers did (same reasoning as `provider DEFAULT 'PAYPLUS'`
-- already on this table). Values are backfilled in place, not reset to the
-- original seed, so any price an admin already edited via
-- /admin/subscriptions survives this migration untouched.
ALTER TABLE "SubscriptionPricing" ADD COLUMN "tier" "SubscriptionTier" NOT NULL DEFAULT 'BASIC';
ALTER TABLE "SubscriptionPricing" ADD COLUMN "monthlyRequestCap" INTEGER;
ALTER TABLE "SubscriptionPricing" ADD COLUMN "trialRequestCap" INTEGER NOT NULL DEFAULT 5;
-- BASIC's real monthly request cap, per the design spec's tier table.
UPDATE "SubscriptionPricing" SET "monthlyRequestCap" = 10;
ALTER TABLE "SubscriptionPricing" ALTER COLUMN "tier" DROP DEFAULT;
ALTER TABLE "SubscriptionPricing" ALTER COLUMN "trialRequestCap" DROP DEFAULT;

-- Rebuild the primary key around (provider, tier) now that a provider can
-- have more than one row. The original constraint name comes from Prisma's
-- own naming convention for a single-column @id.
ALTER TABLE "SubscriptionPricing" DROP CONSTRAINT "SubscriptionPricing_pkey";
ALTER TABLE "SubscriptionPricing" ADD CONSTRAINT "SubscriptionPricing_pkey" PRIMARY KEY ("provider", "tier");

-- Seed the six new tier rows per provider, copying each provider's real
-- currency and trialDays off its own BASIC row rather than hardcoding them —
-- so a price an admin already changed on BASIC is reflected in nothing here
-- (FREE/PRO/FEATURED are new rows with their own placeholder prices; only
-- currency/trialDays are inherited). FREE is priced 0/0 in both currencies —
-- locked there going forward by parsePricingInput (Task 2). PRO/FEATURED,
-- and every STRIPE row (STRIPE is still "ready but unused" per the
-- 2026-09-03 migration), are placeholder starting points — editable at
-- /admin/subscriptions like every other row.
INSERT INTO "SubscriptionPricing"
  ("provider", "tier", "currency", "monthlyPriceMinor", "yearlyPriceMinor", "monthlyRequestCap", "trialDays", "trialRequestCap", "updatedAt")
SELECT new_rows.provider, new_rows.tier, basic."currency", new_rows."monthlyPriceMinor", new_rows."yearlyPriceMinor", new_rows."monthlyRequestCap", basic."trialDays", 5, now()
FROM (
  SELECT 'PAYPLUS'::"SubscriptionProvider" AS provider, 'FREE'::"SubscriptionTier" AS tier, 0 AS "monthlyPriceMinor", 0 AS "yearlyPriceMinor", 3 AS "monthlyRequestCap"
  UNION ALL SELECT 'PAYPLUS', 'PRO', 44900, 449000, 30
  UNION ALL SELECT 'PAYPLUS', 'FEATURED', 89900, 899000, NULL
  UNION ALL SELECT 'STRIPE', 'FREE', 0, 0, 3
  UNION ALL SELECT 'STRIPE', 'PRO', 17900, 149000, 30
  UNION ALL SELECT 'STRIPE', 'FEATURED', 35900, 299000, NULL
) new_rows
JOIN "SubscriptionPricing" basic ON basic."provider" = new_rows.provider AND basic."tier" = 'BASIC';

-- ClinicSubscription gains a tier column, defaulted to BASIC for the same
-- reason as SubscriptionPricing above. Unlike `tier` on SubscriptionPricing,
-- this default is NOT dropped: not every write path is updated to set it
-- explicitly by this plan (only the two Task 3 touches), matching how
-- `provider DEFAULT 'PAYPLUS'` was deliberately left permanent on this same
-- model for the identical reason.
ALTER TABLE "ClinicSubscription" ADD COLUMN "tier" "SubscriptionTier" NOT NULL DEFAULT 'BASIC';
```

- [ ] **Step 4: Apply the migration and regenerate the client**

Run: `npx prisma migrate dev`
Expected: applies the migration created in Step 3 (Prisma detects it as already-created via `--create-only` and applies it; it does not re-diff), then runs `prisma generate` automatically. If it does not auto-generate, run `npx prisma generate` explicitly.

- [ ] **Step 5: Update the seed script**

In `prisma/seed.ts`, replace the two `db.subscriptionPricing.upsert(...)` blocks (`PAYPLUS` then `STRIPE`) with eight upserts — one per `(provider, tier)` pair, using `provider_tier` as the `where`. Use the exact same values as the migration's `INSERT` in Step 3:

```ts
  const PRICING_SEED = [
    { provider: "PAYPLUS", tier: "FREE", currency: "ILS", monthlyPriceMinor: 0, yearlyPriceMinor: 0, monthlyRequestCap: 3, trialDays: 60, trialRequestCap: 5 },
    { provider: "PAYPLUS", tier: "BASIC", currency: "ILS", monthlyPriceMinor: 29900, yearlyPriceMinor: 199000, monthlyRequestCap: 10, trialDays: 60, trialRequestCap: 5 },
    { provider: "PAYPLUS", tier: "PRO", currency: "ILS", monthlyPriceMinor: 44900, yearlyPriceMinor: 449000, monthlyRequestCap: 30, trialDays: 60, trialRequestCap: 5 },
    { provider: "PAYPLUS", tier: "FEATURED", currency: "ILS", monthlyPriceMinor: 89900, yearlyPriceMinor: 899000, monthlyRequestCap: null, trialDays: 60, trialRequestCap: 5 },
    { provider: "STRIPE", tier: "FREE", currency: "USD", monthlyPriceMinor: 0, yearlyPriceMinor: 0, monthlyRequestCap: 3, trialDays: 60, trialRequestCap: 5 },
    { provider: "STRIPE", tier: "BASIC", currency: "USD", monthlyPriceMinor: 7900, yearlyPriceMinor: 53000, monthlyRequestCap: 10, trialDays: 60, trialRequestCap: 5 },
    { provider: "STRIPE", tier: "PRO", currency: "USD", monthlyPriceMinor: 17900, yearlyPriceMinor: 149000, monthlyRequestCap: 30, trialDays: 60, trialRequestCap: 5 },
    { provider: "STRIPE", tier: "FEATURED", currency: "USD", monthlyPriceMinor: 35900, yearlyPriceMinor: 299000, monthlyRequestCap: null, trialDays: 60, trialRequestCap: 5 },
  ] as const;

  for (const row of PRICING_SEED) {
    await db.subscriptionPricing.upsert({
      where: { provider_tier: { provider: row.provider, tier: row.tier } },
      update: {},
      create: row,
    });
    console.log(`✅ Seeded subscription pricing: ${row.provider}/${row.tier}`);
  }
```

Remove the two old single-provider upsert blocks and their `console.log` lines entirely — this loop replaces both.

- [ ] **Step 6: Update the schema integration test**

Replace the full contents of `src/server/subscription-pricing-schema.integration.test.ts` with:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;

describe.skipIf(!hasDb)("SubscriptionPricing seed rows", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, 60_000);

  it("seeds PAYPLUS/BASIC with today's live values, unchanged", async () => {
    const row = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
    });
    expect(row.currency).toBe("ILS");
    expect(row.monthlyPriceMinor).toBe(29900);
    expect(row.yearlyPriceMinor).toBe(199000);
    expect(row.trialDays).toBe(60);
    expect(row.monthlyRequestCap).toBe(10);
  });

  it("seeds STRIPE/BASIC with the agreed default, ready but unused", async () => {
    const row = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "STRIPE", tier: "BASIC" } },
    });
    expect(row.currency).toBe("USD");
    expect(row.monthlyPriceMinor).toBe(7900);
    expect(row.yearlyPriceMinor).toBe(53000);
    expect(row.trialDays).toBe(60);
  });

  it("locks every FREE row's price to 0 in both currencies", async () => {
    const rows = await db.subscriptionPricing.findMany({ where: { tier: "FREE" } });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.monthlyPriceMinor).toBe(0);
      expect(row.yearlyPriceMinor).toBe(0);
    }
  });

  it("seeds all eight (provider, tier) combinations", async () => {
    const rows = await db.subscriptionPricing.findMany();
    expect(rows).toHaveLength(8);
    const pairs = new Set(rows.map((r) => `${r.provider}:${r.tier}`));
    expect(pairs.size).toBe(8);
  });

  it("leaves FEATURED with no monthly request cap (unlimited)", async () => {
    const rows = await db.subscriptionPricing.findMany({ where: { tier: "FEATURED" } });
    for (const row of rows) {
      expect(row.monthlyRequestCap).toBeNull();
    }
  });
});
```

- [ ] **Step 7: Run the schema test against the real database**

Run: `npx vitest run src/server/subscription-pricing-schema.integration.test.ts`
Expected: PASS, 5 tests. (If it fails because a leftover local database was created before this migration ran under a different flow — e.g. `db push` — run `npx prisma migrate reset` first, which reapplies every migration including seed.)

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts src/server/subscription-pricing-schema.integration.test.ts
git commit -m "feat: add tier dimension to SubscriptionPricing schema"
```

---

### Task 2: `parsePricingInput` — tier-aware validation

**Files:**
- Modify: `src/lib/subscription-pricing.ts`
- Modify: `src/lib/subscription-pricing.test.ts`

**Interfaces:**
- Consumes: `SubscriptionTier` from `@/generated/prisma/enums` (Task 1).
- Produces: `parsePricingInput(raw: RawPricingInput, currency: string, tier: SubscriptionTier): ParseResult`, where `RawPricingInput` now has `monthlyPriceMajor`, `yearlyPriceMajor`, `trialDays`, `monthlyRequestCap` (empty string = unlimited), `trialRequestCap`; `ParsedPricing` has `monthlyPriceMinor`, `yearlyPriceMinor`, `trialDays`, `monthlyRequestCap: number | null`, `trialRequestCap`. `PricingField` is the widened key union — Task 4 depends on this exact type name. Also produces the updated `getSubscriptionPricing(provider: SubscriptionProvider, tier: SubscriptionTier)` signature (same file) — Task 3 depends on this exact signature.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/lib/subscription-pricing.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { parsePricingInput } from "./subscription-pricing";

const BASIC = {
  monthlyPriceMajor: "299",
  yearlyPriceMajor: "1990",
  trialDays: "60",
  monthlyRequestCap: "10",
  trialRequestCap: "5",
};

describe("parsePricingInput", () => {
  it("accepts valid BASIC input and converts major units to minor", () => {
    const result = parsePricingInput(BASIC, "ILS", "BASIC");
    expect(result).toEqual({
      ok: true,
      value: {
        monthlyPriceMinor: 29900,
        yearlyPriceMinor: 199000,
        trialDays: 60,
        monthlyRequestCap: 10,
        trialRequestCap: 5,
      },
    });
  });

  it("rejects a non-positive monthly price on a paid tier", () => {
    const result = parsePricingInput({ ...BASIC, monthlyPriceMajor: "0" }, "ILS", "BASIC");
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("rejects a non-positive yearly price on a paid tier", () => {
    const result = parsePricingInput({ ...BASIC, yearlyPriceMajor: "-5" }, "ILS", "PRO");
    expect(result).toEqual({ ok: false, field: "yearlyPriceMajor" });
  });

  it("rejects a monthly price above the 100,000-major-unit ceiling", () => {
    const result = parsePricingInput({ ...BASIC, monthlyPriceMajor: "999999" }, "ILS", "BASIC");
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("rejects trial days outside 1-365", () => {
    expect(parsePricingInput({ ...BASIC, trialDays: "0" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "trialDays",
    });
    expect(parsePricingInput({ ...BASIC, trialDays: "400" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "trialDays",
    });
  });

  it("rejects non-numeric input", () => {
    const result = parsePricingInput({ ...BASIC, monthlyPriceMajor: "abc" }, "ILS", "BASIC");
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("floors a fractional trial-days input", () => {
    const result = parsePricingInput({ ...BASIC, trialDays: "60.7" }, "ILS", "BASIC");
    expect(result.ok && result.value.trialDays).toBe(60);
  });

  it("FREE tier: accepts exactly 0/0 and locks the price there", () => {
    const result = parsePricingInput(
      { ...BASIC, monthlyPriceMajor: "0", yearlyPriceMajor: "0" },
      "ILS",
      "FREE",
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.monthlyPriceMinor).toBe(0);
    expect(result.ok && result.value.yearlyPriceMinor).toBe(0);
  });

  it("FREE tier: rejects any non-zero monthly price, even a valid-looking one", () => {
    const result = parsePricingInput({ ...BASIC, monthlyPriceMajor: "1" }, "ILS", "FREE");
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("FREE tier: rejects any non-zero yearly price", () => {
    const result = parsePricingInput(
      { ...BASIC, monthlyPriceMajor: "0", yearlyPriceMajor: "1" },
      "ILS",
      "FREE",
    );
    expect(result).toEqual({ ok: false, field: "yearlyPriceMajor" });
  });

  it("parses an empty monthlyRequestCap as unlimited (null)", () => {
    const result = parsePricingInput({ ...BASIC, monthlyRequestCap: "" }, "ILS", "FEATURED");
    expect(result.ok && result.value.monthlyRequestCap).toBeNull();
  });

  it("rejects a monthlyRequestCap of 0 or negative", () => {
    expect(parsePricingInput({ ...BASIC, monthlyRequestCap: "0" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "monthlyRequestCap",
    });
    expect(parsePricingInput({ ...BASIC, monthlyRequestCap: "-1" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "monthlyRequestCap",
    });
  });

  it("floors a fractional monthlyRequestCap", () => {
    const result = parsePricingInput({ ...BASIC, monthlyRequestCap: "10.9" }, "ILS", "BASIC");
    expect(result.ok && result.value.monthlyRequestCap).toBe(10);
  });

  it("rejects trialRequestCap outside 1-1000", () => {
    expect(parsePricingInput({ ...BASIC, trialRequestCap: "0" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "trialRequestCap",
    });
    expect(parsePricingInput({ ...BASIC, trialRequestCap: "1001" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "trialRequestCap",
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/subscription-pricing.test.ts`
Expected: FAIL — `parsePricingInput` still takes two arguments and knows nothing about `tier`, `monthlyRequestCap`, or `trialRequestCap`.

- [ ] **Step 3: Rewrite `parsePricingInput`**

In `src/lib/subscription-pricing.ts`, replace the type definitions and `parsePricingInput` function with:

```ts
import "server-only";
import { db } from "@/lib/db";
import { toMinor } from "@/lib/money";
import type { SubscriptionProvider, SubscriptionTier } from "@/generated/prisma/enums";

/**
 * Reads one (provider, tier) row's current price/cap/trial settings. Throws if
 * the row is missing — every provider×tier pair has a seeded row (Task 1's
 * migration), so a miss here means the seed never ran, which is a deploy
 * defect worth a loud crash rather than a silently-free subscription.
 */
export async function getSubscriptionPricing(provider: SubscriptionProvider, tier: SubscriptionTier) {
  return db.subscriptionPricing.findUniqueOrThrow({ where: { provider_tier: { provider, tier } } });
}

export type RawPricingInput = {
  monthlyPriceMajor: string;
  yearlyPriceMajor: string;
  trialDays: string;
  /** Empty string parses to unlimited (null). */
  monthlyRequestCap: string;
  trialRequestCap: string;
};

export type PricingField = keyof RawPricingInput;

export type ParsedPricing = {
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  trialDays: number;
  monthlyRequestCap: number | null;
  trialRequestCap: number;
};

export type ParseResult = { ok: true; value: ParsedPricing } | { ok: false; field: PricingField };

/**
 * Validation for admin-entered pricing. Free of database and server-only
 * imports (aside from the currency-aware `toMinor` conversion), mirroring
 * `src/lib/country-input.ts` so it can be unit-tested without a database.
 */
// A generous ceiling that would never reject a real price, but catches a
// fat-fingered extra zero (e.g. "2990" instead of "299") before it gets
// audited and charged to every clinic that registers after it.
const MAX_PRICE_MAJOR = 100_000;
// Same fat-finger guard for request caps and the trial threshold — generous
// enough that no real value would ever hit it.
const MAX_REQUEST_CAP = 10_000;
const MAX_TRIAL_REQUEST_CAP = 1_000;

export function parsePricingInput(
  raw: RawPricingInput,
  currency: string,
  tier: SubscriptionTier,
): ParseResult {
  const monthlyMajor = Number(raw.monthlyPriceMajor);
  const yearlyMajor = Number(raw.yearlyPriceMajor);

  if (tier === "FREE") {
    // Locked to 0 server-side, not just hidden/readonly in the UI — a client
    // that bypasses the form (or a future caller) cannot price FREE above 0.
    if (!Number.isFinite(monthlyMajor) || monthlyMajor !== 0) {
      return { ok: false, field: "monthlyPriceMajor" };
    }
    if (!Number.isFinite(yearlyMajor) || yearlyMajor !== 0) {
      return { ok: false, field: "yearlyPriceMajor" };
    }
  } else {
    if (!Number.isFinite(monthlyMajor) || monthlyMajor <= 0 || monthlyMajor > MAX_PRICE_MAJOR) {
      return { ok: false, field: "monthlyPriceMajor" };
    }
    if (!Number.isFinite(yearlyMajor) || yearlyMajor <= 0 || yearlyMajor > MAX_PRICE_MAJOR) {
      return { ok: false, field: "yearlyPriceMajor" };
    }
  }

  const trialDays = Math.floor(Number(raw.trialDays));
  if (!Number.isFinite(trialDays) || trialDays < 1 || trialDays > 365) {
    return { ok: false, field: "trialDays" };
  }

  let monthlyRequestCap: number | null = null;
  const capRaw = raw.monthlyRequestCap.trim();
  if (capRaw !== "") {
    const cap = Math.floor(Number(capRaw));
    if (!Number.isFinite(cap) || cap < 1 || cap > MAX_REQUEST_CAP) {
      return { ok: false, field: "monthlyRequestCap" };
    }
    monthlyRequestCap = cap;
  }

  const trialRequestCap = Math.floor(Number(raw.trialRequestCap));
  if (!Number.isFinite(trialRequestCap) || trialRequestCap < 1 || trialRequestCap > MAX_TRIAL_REQUEST_CAP) {
    return { ok: false, field: "trialRequestCap" };
  }

  return {
    ok: true,
    value: {
      monthlyPriceMinor: toMinor(monthlyMajor, currency),
      yearlyPriceMinor: toMinor(yearlyMajor, currency),
      trialDays,
      monthlyRequestCap,
      trialRequestCap,
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/subscription-pricing.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscription-pricing.ts src/lib/subscription-pricing.test.ts
git commit -m "feat: make parsePricingInput and getSubscriptionPricing tier-aware"
```

---

### Task 3: Fix every call site — production code and tests

**Files:**
- Modify: `src/server/clinic-registration.ts:150-165` (approximate — the `getSubscriptionPricing` call and the `createPendingSubscription` call)
- Modify: `src/server/subscriptions.ts` (`createPendingSubscription`)
- Modify: `src/server/admin-actions.ts:293` and the `tx.clinicSubscription.create` a few lines below it
- Modify: `src/server/clinic-registration.integration.test.ts:100-102,134-135`
- Modify: `src/server/admin-actions.integration.test.ts:134-138,151-153`
- Modify: `src/app/[locale]/clinics/join/page.tsx:29`
- Modify: `src/app/[locale]/refunds/content.en.tsx:9`
- Modify: `src/app/[locale]/refunds/content.he.tsx:9`
- Modify: `src/app/[locale]/terms/content.en.tsx:9`
- Modify: `src/app/[locale]/terms/content.he.tsx:9`
- Modify: `src/server/subscriptions.integration.test.ts:46,76` (two `createPendingSubscription` calls)

**Interfaces:**
- Consumes: `getSubscriptionPricing(provider, tier)` (Task 2).
- Produces: every `ClinicSubscription` row this codebase creates now carries an explicit `tier: "BASIC"` — the honest value for the one paid plan that existed before tiers did.

- [ ] **Step 1: Update `createPendingSubscription`'s signature**

In `src/server/subscriptions.ts`, add `tier: SubscriptionTier` to the `args` type and pass it through to `create`:

```ts
import type { SubscriptionProvider, SubscriptionTier } from "@/generated/prisma/enums";
```

```ts
export async function createPendingSubscription(
  args: {
    dentistId: string;
    plan: SubscriptionPlanType;
    setupToken: string;
    priceMinor: number;
    currency: string;
    trialDays: number;
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
      setupToken: args.setupToken,
      status: "PENDING",
      provider: args.provider,
      tier: args.tier,
    },
  });
}
```

- [ ] **Step 2: Update `clinic-registration.ts`**

Find `const pricing = await getSubscriptionPricing(provider);` and change it to:

```ts
  const pricing = await getSubscriptionPricing(provider, "BASIC");
```

Find the `createPendingSubscription` call a few lines below (inside the `db.$transaction`) and add `tier: "BASIC"` to its argument object:

```ts
    await createPendingSubscription(
      {
        dentistId: dentist.id,
        plan,
        setupToken,
        priceMinor,
        currency: pricing.currency,
        trialDays: pricing.trialDays,
        provider,
        tier: "BASIC",
      },
      tx,
    );
```

- [ ] **Step 3: Update `admin-actions.ts`**

Find `const pricing = await getSubscriptionPricing("PAYPLUS");` and change it to:

```ts
  const pricing = await getSubscriptionPricing("PAYPLUS", "BASIC");
```

Find the `tx.clinicSubscription.create` a few lines below it (the "Complimentary subscription" block) and add `tier: "BASIC"`:

```ts
    await tx.clinicSubscription.create({
      data: {
        dentistId: dentist.id,
        plan: "MONTHLY",
        priceMinor: pricing.monthlyPriceMinor,
        currency: pricing.currency,
        trialDays: pricing.trialDays,
        tier: "BASIC",
        setupToken: randomUUID(),
        status: "ACTIVE",
        currentPeriodEnd: null,
        recurringToken: null,
      },
    });
```

- [ ] **Step 4: Fix the two broken lookups in `clinic-registration.integration.test.ts`**

Replace:

```ts
      const pricing = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider: "STRIPE" },
      });
```

with:

```ts
      const pricing = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider: "STRIPE", tier: "BASIC" } },
      });
```

And replace:

```ts
      const stripePricing = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "STRIPE" } });
      const payplusPricing = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "PAYPLUS" } });
```

with:

```ts
      const stripePricing = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider: "STRIPE", tier: "BASIC" } },
      });
      const payplusPricing = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
      });
```

- [ ] **Step 5: Fix the three broken lookups/updates in `admin-actions.integration.test.ts`**

Replace:

```ts
      const original = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider: "PAYPLUS" },
      });
      await db.subscriptionPricing.update({
        where: { provider: "PAYPLUS" },
        data: { trialDays: 30 },
      });
```

with:

```ts
      const original = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
      });
      await db.subscriptionPricing.update({
        where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
        data: { trialDays: 30 },
      });
```

And replace:

```ts
        await db.subscriptionPricing.update({
          where: { provider: "PAYPLUS" },
          data: { trialDays: original.trialDays },
        });
```

with:

```ts
        await db.subscriptionPricing.update({
          where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
          data: { trialDays: original.trialDays },
        });
```

- [ ] **Step 5b: Fix the five read-only pricing-display pages and `subscriptions.integration.test.ts`**

Five server components call `getSubscriptionPricing("PAYPLUS")` to display the current price/trial length (join form, refunds policy, terms of service, in both languages). Each needs the same one-argument addition. In each of these five files, change:

```ts
  const pricing = await getSubscriptionPricing("PAYPLUS");
```

(in `src/app/[locale]/clinics/join/page.tsx` the variable is named `pricingRow`, not `pricing` — change that call by name, same fix) to:

```ts
  const pricing = await getSubscriptionPricing("PAYPLUS", "BASIC");
```

Apply this to: `src/app/[locale]/clinics/join/page.tsx` (`pricingRow`), `src/app/[locale]/refunds/content.en.tsx`, `src/app/[locale]/refunds/content.he.tsx`, `src/app/[locale]/terms/content.en.tsx`, `src/app/[locale]/terms/content.he.tsx`.

Separately, `src/server/subscriptions.integration.test.ts` has two `createPendingSubscription({...})` calls (Task 3's Step 1 added a required `tier` field to that function). In both call objects, add `tier: "BASIC",` immediately after the existing `provider: "PAYPLUS",` line:

```ts
    await createPendingSubscription({
      dentistId: dentist.id,
      plan: "MONTHLY",
      setupToken: randomUUID(),
      priceMinor: 12345,
      currency: "USD",
      trialDays: 45,
      provider: "PAYPLUS",
      tier: "BASIC",
    });
```

(second occurrence has `priceMinor: 29900, currency: "ILS"` instead — same one-line addition, nothing else changes.)

- [ ] **Step 6: Type-check and run the full integration suite**

Run: `npx tsc --noEmit`
Expected: errors **only** in `src/server/pricing-actions.ts` and/or `src/server/pricing-actions.integration.test.ts` — both are deliberately untouched until Task 4 fully rewrites them. Every error you see should trace back to one of those two files (calls into the old 2-argument `parsePricingInput`, or the old single-provider `SubscriptionPricing` shape). If you see an error in ANY other file, that is a real regression this task introduced — fix it before proceeding. (This double-checks that this task's edits caught every other stale call site: `getSubscriptionPricing`, `createPendingSubscription`, and every `provider:`-keyed `SubscriptionPricing` query now require the extra argument/composite key, so a stale call site fails to compile rather than fails at runtime.)

Run: `npx vitest run src/server/clinic-registration.integration.test.ts src/server/admin-actions.integration.test.ts src/server/subscriptions.integration.test.ts`
Expected: PASS (requires the local DB running — `docker start dentalcompare-db`).

- [ ] **Step 7: Commit**

```bash
git add src/server/subscriptions.ts src/server/clinic-registration.ts src/server/admin-actions.ts src/server/clinic-registration.integration.test.ts src/server/admin-actions.integration.test.ts src/server/subscriptions.integration.test.ts "src/app/[locale]/clinics/join/page.tsx" "src/app/[locale]/refunds/content.en.tsx" "src/app/[locale]/refunds/content.he.tsx" "src/app/[locale]/terms/content.en.tsx" "src/app/[locale]/terms/content.he.tsx"
git commit -m "fix: stamp tier on every ClinicSubscription write path"
```

---

### Task 4: `updatePricing` — tier-aware server action

**Files:**
- Modify: `src/server/pricing-actions.ts`
- Modify: `src/server/pricing-actions.integration.test.ts`
- Modify: `src/i18n/dictionaries/he.ts` (two keys only — see Step 1's note)
- Modify: `src/i18n/dictionaries/en.ts` (two keys only — see Step 1's note)

**Interfaces:**
- Consumes: `parsePricingInput(raw, currency, tier)` (Task 2), `PricingField` type (Task 2).
- Produces: `updatePricing(formData: FormData): Promise<ActionResult>` now reads a `tier` field from the form in addition to `provider`; `ActionResult` type is unchanged (`{ ok: true } | { ok: false; error: string }`) — Task 5's form component relies on this exact shape. Also produces the `t.admin.fieldMonthlyRequestCap`/`t.admin.fieldTrialRequestCap` dictionary keys (both languages) — Task 5 consumes the dictionary type these keys become part of, but does not redeclare them.

- [ ] **Step 1: Rewrite `pricing-actions.ts`**

Replace the full contents of `src/server/pricing-actions.ts` with:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { audit } from "@/lib/audit";
import { parsePricingInput, type PricingField } from "@/lib/subscription-pricing";
import type { SubscriptionProvider, SubscriptionTier } from "@/generated/prisma/enums";

/**
 * Admin management of the SubscriptionPricing table.
 *
 * Task 1 (2026-09-03) seeded one row per payment provider so pricing is data
 * rather than a constant baked into the checkout code. The tiered-pricing plan
 * (2026-09-08) widened that to one row per (provider, tier) pair — this is
 * still the write side of the same promise: validate, write, audit-log.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const TIERS = ["FREE", "BASIC", "PRO", "FEATURED"] as const;

// NOTE for the implementer: this file references t.admin.fieldMonthlyRequestCap
// and t.admin.fieldTrialRequestCap below. Add those two keys to BOTH
// src/i18n/dictionaries/he.ts and src/i18n/dictionaries/en.ts as part of THIS
// task (immediately after the existing fieldTrialDays key in each file's
// admin section) — do not wait for Task 5, or `tsc --noEmit` fails between
// this task and the next:
//
// he.ts:   fieldMonthlyRequestCap: "תקרת בקשות חודשית",
//          fieldTrialRequestCap: "סף בקשות לטריאל",
// en.ts:   fieldMonthlyRequestCap: "Monthly request cap",
//          fieldTrialRequestCap: "Trial request threshold",
//
// Task 5 adds the remaining UI-only dictionary keys (tier labels, the
// "unlimited" placeholder, the FREE-tier lock hint) — it does not repeat
// these two.

function fieldLabel(t: Dictionary, field: PricingField): string {
  const labels: Record<PricingField, string> = {
    monthlyPriceMajor: t.admin.fieldMonthlyPrice,
    yearlyPriceMajor: t.admin.fieldYearlyPrice,
    trialDays: t.admin.fieldTrialDays,
    monthlyRequestCap: t.admin.fieldMonthlyRequestCap,
    trialRequestCap: t.admin.fieldTrialRequestCap,
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

  const tierRaw = String(formData.get("tier") ?? "");
  if (!(TIERS as readonly string[]).includes(tierRaw)) {
    return { ok: false, error: t.errors.pricingNotFound };
  }
  const tier = tierRaw as SubscriptionTier;

  // The currency is immutable and never taken from the form — it is read from
  // the existing row so validation always converts major-to-minor units in the
  // currency this provider is actually priced in.
  const existing = await db.subscriptionPricing.findUnique({
    where: { provider_tier: { provider, tier } },
  });
  if (!existing) return { ok: false, error: t.errors.pricingNotFound };

  const parsed = parsePricingInput(
    {
      monthlyPriceMajor: String(formData.get("monthlyPriceMajor") ?? ""),
      yearlyPriceMajor: String(formData.get("yearlyPriceMajor") ?? ""),
      trialDays: String(formData.get("trialDays") ?? ""),
      monthlyRequestCap: String(formData.get("monthlyRequestCap") ?? ""),
      trialRequestCap: String(formData.get("trialRequestCap") ?? ""),
    },
    existing.currency,
    tier,
  );
  if (!parsed.ok) {
    return {
      ok: false,
      error: format(t.errors.pricingInvalidField, { field: fieldLabel(t, parsed.field) }),
    };
  }

  await db.subscriptionPricing.update({
    where: { provider_tier: { provider, tier } },
    data: { ...parsed.value, updatedBy: admin.email },
  });

  await audit({
    actor: admin.email,
    action: "pricing.update",
    entity: "SubscriptionPricing",
    entityId: `${provider}:${tier}`,
    metadata: {
      old: {
        monthlyPriceMinor: existing.monthlyPriceMinor,
        yearlyPriceMinor: existing.yearlyPriceMinor,
        trialDays: existing.trialDays,
        monthlyRequestCap: existing.monthlyRequestCap,
        trialRequestCap: existing.trialRequestCap,
      },
      new: parsed.value,
    },
  });

  revalidatePath("/admin/subscriptions");
  return { ok: true };
}
```

- [ ] **Step 2: Replace the integration test file**

Replace the full contents of `src/server/pricing-actions.integration.test.ts` with:

```ts
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

const BASIC_FIELDS = {
  provider: "PAYPLUS",
  tier: "BASIC",
  monthlyPriceMajor: "350",
  yearlyPriceMajor: "2200",
  trialDays: "45",
  monthlyRequestCap: "12",
  trialRequestCap: "6",
};

describe.skipIf(!hasDb)("updatePricing", () => {
  const DB_TIMEOUT = 60_000;
  let originalPayplusBasicRow: {
    monthlyPriceMinor: number;
    yearlyPriceMinor: number;
    trialDays: number;
    monthlyRequestCap: number | null;
    trialRequestCap: number;
  };

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
    originalPayplusBasicRow = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
    });
  }, DB_TIMEOUT);

  afterEach(async () => {
    // Restore PAYPLUS/BASIC to its seeded values so other suites (and this
    // file's own next test) are never left reading a mutated row.
    await db.subscriptionPricing.update({
      where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
      data: originalPayplusBasicRow,
    });
  }, DB_TIMEOUT);

  it("updates a tier's price, trial days, and request caps, converting major to minor", async () => {
    const result = await updatePricing(formData(BASIC_FIELDS));

    expect(result.ok).toBe(true);
    const row = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
    });
    expect(row.monthlyPriceMinor).toBe(35000);
    expect(row.yearlyPriceMinor).toBe(220000);
    expect(row.trialDays).toBe(45);
    expect(row.monthlyRequestCap).toBe(12);
    expect(row.trialRequestCap).toBe(6);
  });

  it("leaves currency untouched — it is never taken from the form", async () => {
    // Submit a currency different from the row's real one (ILS): if
    // updatePricing ever started reading `currency` from the form, this
    // would flip the row to USD and the assertion below would catch it.
    await updatePricing(formData({ ...BASIC_FIELDS, currency: "USD" }));
    const row = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
    });
    expect(row.currency).toBe("ILS");
  });

  it("refuses invalid input and leaves the row unchanged", async () => {
    const result = await updatePricing(formData({ ...BASIC_FIELDS, monthlyPriceMajor: "-1" }));

    expect(result.ok).toBe(false);
    const row = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
    });
    expect(row.monthlyPriceMinor).toBe(originalPayplusBasicRow.monthlyPriceMinor);
  });

  it("refuses an unknown provider", async () => {
    const result = await updatePricing(formData({ ...BASIC_FIELDS, provider: "NOT_A_PROVIDER" }));
    expect(result.ok).toBe(false);
  });

  it("refuses an unknown tier", async () => {
    const result = await updatePricing(formData({ ...BASIC_FIELDS, tier: "NOT_A_TIER" }));
    expect(result.ok).toBe(false);
  });

  it("refuses a non-zero price on the FREE tier and leaves it at 0", async () => {
    const result = await updatePricing(
      formData({
        provider: "PAYPLUS",
        tier: "FREE",
        monthlyPriceMajor: "1",
        yearlyPriceMajor: "0",
        trialDays: "45",
        monthlyRequestCap: "3",
        trialRequestCap: "5",
      }),
    );
    expect(result.ok).toBe(false);
    const row = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "PAYPLUS", tier: "FREE" } },
    });
    expect(row.monthlyPriceMinor).toBe(0);
  });
});
```

- [ ] **Step 3: Run the integration test**

Run: `npx vitest run src/server/pricing-actions.integration.test.ts`
Expected: PASS, 6 tests (requires the local DB running).

- [ ] **Step 3b: Full type-check — this is the first clean-compile checkpoint since Task 2**

Task 2 changed `parsePricingInput`'s and `getSubscriptionPricing`'s signatures; Task 3 fixed every consumer except this file. This step's file is that last consumer, so this is the point where the whole repository should compile clean again.

Run: `npx tsc --noEmit`
Expected: no errors, anywhere in the repository.

- [ ] **Step 4: Commit**

```bash
git add src/server/pricing-actions.ts src/server/pricing-actions.integration.test.ts src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "feat: make updatePricing tier-aware"
```

---

### Task 5: Admin UI — 8-row grid grouped by provider

**Files:**
- Modify: `src/i18n/dictionaries/he.ts`
- Modify: `src/i18n/dictionaries/en.ts`
- Modify: `src/components/admin/pricing-settings-form.tsx`
- Modify: `src/app/[locale]/admin/subscriptions/page.tsx`

**Interfaces:**
- Consumes: `updatePricing(formData)` (Task 4), `ActionResult` type (Task 4).
- Produces: `PricingSettingsForm({ rows: PricingRow[] })` where `PricingRow` now includes `tier`, `monthlyRequestCap`, `trialRequestCap` alongside the existing fields.

- [ ] **Step 1: Add the remaining dictionary keys**

Task 4 already added `fieldMonthlyRequestCap` and `fieldTrialRequestCap` to both dictionaries (they were needed to compile that task's `pricing-actions.ts`). This step adds the rest — the UI-only keys this task's form component needs.

In `src/i18n/dictionaries/he.ts`, inside the `admin` section, immediately after the `fieldTrialRequestCap: "סף בקשות לטריאל",` line Task 4 added, add:

```ts
    requestCapUnlimited: "ללא הגבלה",
    tierFree: "רשומה (חינם)",
    tierBasic: "Basic",
    tierPro: "Pro",
    tierFeatured: "Featured",
    pricingFreeLocked: "מדרגת הרשומה נעולה למחיר 0",
```

In `src/i18n/dictionaries/en.ts`, inside the `admin` section, immediately after the `fieldTrialRequestCap: "Trial request threshold",` line Task 4 added, add:

```ts
    requestCapUnlimited: "Unlimited",
    tierFree: "Free listing",
    tierBasic: "Basic",
    tierPro: "Pro",
    tierFeatured: "Featured",
    pricingFreeLocked: "The free tier is locked to a price of 0",
```

- [ ] **Step 2: Type-check the dictionaries**

Run: `npx tsc --noEmit`
Expected: no errors (the two dictionaries share a type derived from `he.ts`; a key present in one but missing from the other fails here).

- [ ] **Step 3: Rewrite `pricing-settings-form.tsx`**

Replace the full contents of `src/components/admin/pricing-settings-form.tsx` with:

```tsx
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
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-24 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 read-only:opacity-50";

type SubscriptionTier = "FREE" | "BASIC" | "PRO" | "FEATURED";

type PricingRow = {
  provider: "PAYPLUS" | "STRIPE";
  tier: SubscriptionTier;
  currency: string;
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  monthlyRequestCap: number | null;
  trialDays: number;
  trialRequestCap: number;
  updatedAt: Date;
  updatedBy: string | null;
};

const TIER_ORDER: SubscriptionTier[] = ["FREE", "BASIC", "PRO", "FEATURED"];
const PROVIDER_ORDER: Array<"PAYPLUS" | "STRIPE"> = ["PAYPLUS", "STRIPE"];

export function PricingSettingsForm({ rows }: { rows: PricingRow[] }) {
  const t = useT();

  return (
    <section className="border-border/60 bg-card rounded-2xl border p-5">
      <h2 className="text-foreground font-semibold">{t.admin.pricingHeading}</h2>
      <div className="mt-4 space-y-8">
        {PROVIDER_ORDER.map((provider) => {
          const providerRows = TIER_ORDER.map((tier) =>
            rows.find((r) => r.provider === provider && r.tier === tier),
          ).filter((r): r is PricingRow => r !== undefined);
          if (providerRows.length === 0) return null;

          const providerLabel =
            provider === "PAYPLUS" ? t.admin.pricingProviderPayPlus : t.admin.pricingProviderStripe;

          return (
            <div key={provider}>
              <h3 className="text-foreground text-sm font-semibold">{providerLabel}</h3>
              <div className="mt-3 space-y-4">
                {providerRows.map((row) => (
                  <PricingRowForm key={`${row.provider}:${row.tier}`} row={row} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function tierLabel(t: ReturnType<typeof useT>, tier: SubscriptionTier): string {
  switch (tier) {
    case "FREE":
      return t.admin.tierFree;
    case "BASIC":
      return t.admin.tierBasic;
    case "PRO":
      return t.admin.tierPro;
    case "FEATURED":
      return t.admin.tierFeatured;
  }
}

function PricingRowForm({ row }: { row: PricingRow }) {
  const t = useT();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const isFree = row.tier === "FREE";

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
      <input type="hidden" name="tier" value={row.tier} />
      <div className="min-w-[6rem]">
        <p className="text-foreground text-sm font-semibold">{tierLabel(t, row.tier)}</p>
        <p className="text-muted-foreground text-xs">{row.currency}</p>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t.admin.fieldMonthlyPrice}</span>
        <input
          name="monthlyPriceMajor"
          type="number"
          step="0.01"
          min="0"
          required
          readOnly={isFree}
          defaultValue={isFree ? 0 : toMajor(row.monthlyPriceMinor, row.currency)}
          title={isFree ? t.admin.pricingFreeLocked : undefined}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t.admin.fieldYearlyPrice}</span>
        <input
          name="yearlyPriceMajor"
          type="number"
          step="0.01"
          min="0"
          required
          readOnly={isFree}
          defaultValue={isFree ? 0 : toMajor(row.yearlyPriceMinor, row.currency)}
          title={isFree ? t.admin.pricingFreeLocked : undefined}
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

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t.admin.fieldMonthlyRequestCap}</span>
        <input
          name="monthlyRequestCap"
          type="number"
          step="1"
          min="1"
          placeholder={t.admin.requestCapUnlimited}
          defaultValue={row.monthlyRequestCap ?? ""}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t.admin.fieldTrialRequestCap}</span>
        <input
          name="trialRequestCap"
          type="number"
          step="1"
          min="1"
          max="1000"
          required
          defaultValue={row.trialRequestCap}
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
```

Note the `min="0"` (not `min="0.01"`) on the two price inputs — the original component required a strictly-positive minimum, which would block the FREE row's `0` value even as `readOnly`. Server-side validation (Task 2) still enforces the real per-tier rule; this is a display-layer relaxation only.

- [ ] **Step 4: Update the admin page's query**

In `src/app/[locale]/admin/subscriptions/page.tsx`, change:

```ts
  const pricingRows = await db.subscriptionPricing.findMany({ orderBy: { provider: "asc" } });
```

to:

```ts
  const pricingRows = await db.subscriptionPricing.findMany({ orderBy: [{ provider: "asc" }, { tier: "asc" }] });
```

(`PricingSettingsForm` re-sorts into `TIER_ORDER` internally, so the exact order returned here doesn't matter — this just keeps the query's own ordering sensible for anyone reading it directly.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, every existing test plus this plan's additions (requires the local DB running).

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, sign in as an admin (per `ADMIN_EMAILS`), open `/he/admin/subscriptions`. Confirm:
- Two provider groups (PayPlus, Stripe), each with 4 rows in the order Free → Basic → Pro → Featured.
- The Free row's monthly/yearly price fields show `0` and cannot be typed into.
- Saving a change to Basic's monthly price still works exactly as before this plan (this is the regression check — Basic is the tier every live clinic is actually on).
- Saving Pro or Featured's request cap to blank, then reloading the page, shows the field blank again (confirms `null` round-trips as "unlimited", not `0`).

- [ ] **Step 8: Commit**

```bash
git add src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts src/components/admin/pricing-settings-form.tsx "src/app/[locale]/admin/subscriptions/page.tsx"
git commit -m "feat: 8-row tier×provider pricing grid in admin"
```

---

## After this plan

This plan intentionally leaves `tier` on `ClinicSubscription` unread by any query, `monthlyRequestCap`/`trialRequestCap` unread by any query, and the calendar trial (`trialDays`/`trialEndsAt`) completely unchanged. The next plan in this series (request-cap enforcement + the 5-clinic city floor, per spec section 3) is the first one that changes what a patient actually sees.
