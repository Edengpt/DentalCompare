# Request Counter & Outcome-Based Trial Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count every request actually delivered to a clinic (both a lifetime counter for trial conversion and a monthly counter for the future request-cap plan), and convert a TRIALING clinic to paid the moment its lifetime count crosses its frozen threshold — instead of waiting for a calendar date. Works for both payment providers.

**Architecture:** A single hook, `recordVerifiedRequest(dentistId)`, called right after `fulfillment.ts` confirms an email actually reached a clinic. It atomically bumps two counters — `ClinicSubscription.verifiedRequestCount` (lifetime, drives trial conversion) and `MonthlyRequestUsage` (resets every calendar month, unread by anything until the request-cap-enforcement plan) — then, if the clinic is still TRIALING and just crossed its threshold, triggers an immediate conversion attempt. PayPlus's conversion logic is extracted from the existing daily cron into a shared function so the cron and this immediate trigger can never diverge; Stripe's is a new, much smaller call that ends its own trial early and lets the existing webhook handler take it from there. The calendar-based mechanisms (`trialEndsAt` for PayPlus, `trial_period_days` for Stripe) are deliberately left in place as the safety net for a clinic that never crosses the threshold — this plan does not touch either.

**Tech Stack:** Next.js (App Router, server actions, cron route), Prisma 7 + Postgres, Vitest, PayPlus REST API, Stripe SDK.

**Spec:** `docs/superpowers/specs/2026-09-08-tiered-pricing-model-design.md` (sections 1.1, 1.2, 1.3, 7). This is plan 2 of 6 covering that spec — plan 1 (schema + admin pricing screen) is merged. Plans 3-6 (request-cap enforcement + city floor, response-rate SLA, Featured inventory, Founding 50) come after this one.

## Global Constraints

- A "verified request" is counted at the moment `RequestDentist.sentAt` is durably set — i.e. the email genuinely reached the clinic, not the optimistic claim that can still roll back on send failure (spec 1.2).
- Decrementing on a disputed/invalid-lead report is **explicitly out of scope for this plan** — no code path in this repository ever sets `RequestDentist.disputedAt` today (PRD 4.5's "report an invalid lead" feature was never built), so there is nothing to wire a decrement to yet. The counter only ever increments in this plan. Whichever future plan builds that report feature must add the decrement call then.
- PayPlus and Stripe both get an immediate conversion trigger when the threshold is crossed — not just PayPlus. PayPlus reuses the exact billing logic the daily cron already has (extracted, not duplicated); Stripe calls `subscriptions.update(id, { trial_end: "now" })` and lets the already-built webhook handler (`customer.subscription.updated`, `invoice.paid`) do the rest.
- `ClinicSubscription.trialRequestCap` gets a permanent default (`@default(5)`), the same reasoning already applied to this table's `provider`/`tier` columns: at least 7 existing test files construct `ClinicSubscription` rows directly via `db.clinicSubscription.create(...)` for features unrelated to pricing, and forcing all of them to learn about trial thresholds would be pure blast-radius with no safety benefit — no real clinic exists yet, so there is nothing a wrong default could silently misprice. The two real write paths (`clinic-registration.ts`, `admin-actions.ts`) and the `createPendingSubscription` helper still require it explicitly in their TypeScript signatures, matching how `tier` was already handled in the previous plan — only the raw-Prisma test fixtures lean on the database default.
- Local Postgres runs in Docker (`docker start dentalcompare-db`) — start it before any step that touches the database.

---

### Task 1: Schema — counters + `MonthlyRequestUsage`, frozen at every write path

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_request_counters/migration.sql`
- Modify: `src/server/subscriptions.ts` (`createPendingSubscription`)
- Modify: `src/server/clinic-registration.ts`
- Modify: `src/server/admin-actions.ts`
- Modify: `src/server/subscriptions.integration.test.ts`
- Create: `src/server/request-counters-schema.integration.test.ts`

**Interfaces:**
- Produces: `ClinicSubscription.trialRequestCap: number` (`@default(5)`, but every real write path passes it explicitly from `SubscriptionPricing.trialRequestCap`), `ClinicSubscription.verifiedRequestCount: number` (`@default(0)`, never passed explicitly — every write path starts a subscription at 0). `MonthlyRequestUsage` model with composite key `dentistId_yearMonth`. `createPendingSubscription(args)` gains a required `trialRequestCap: number` field — Task 3 does not touch this function, but relies on the column existing and being populated correctly by real registrations.

- [ ] **Step 1: Edit the Prisma schema**

In `prisma/schema.prisma`, find the `ClinicSubscription` model's `tier` field (added by the previous plan) and add these two fields immediately after it:

```prisma
  // The lifetime request threshold that converts this trial to a paid
  // subscription, frozen at registration from SubscriptionPricing.trialRequestCap
  // the same way priceMinor/currency/trialDays already are. Defaulted to 5 (not
  // dropped) because unrelated test fixtures across the repo construct
  // ClinicSubscription rows directly and have no reason to know about this —
  // the two real write paths (clinic-registration.ts, admin-actions.ts) pass it
  // explicitly regardless, so production code never leans on the default.
  trialRequestCap        Int                  @default(5)
  // Lifetime count of requests actually delivered to this clinic — the trigger
  // for the outcome-based trial. Distinct from MonthlyRequestUsage below, which
  // resets every calendar month and exists for the request-cap plan, not this
  // one; both counters grow on the same event (see request-usage.ts, Task 3).
  verifiedRequestCount    Int                  @default(0)
```

Add a new model, anywhere after `ClinicSubscription`:

```prisma
/// How many requests a clinic has actually received in one calendar month.
/// Unread by any query until the request-cap-enforcement plan — this table
/// exists now only so the counter isn't lost between when it starts being
/// collected (this plan) and when it starts being enforced (a later one).
model MonthlyRequestUsage {
  dentistId String
  dentist   Dentist  @relation(fields: [dentistId], references: [id], onDelete: Cascade)
  // "2026-09" — a natural key that resets the count every month without a
  // separate cron job to zero it out.
  yearMonth String
  count     Int      @default(0)

  @@id([dentistId, yearMonth])
}
```

Find `model Dentist { ... requestDentists RequestDentist[] ... subscription ClinicSubscription? ... documents ClinicDocument[]` and add the back-relation immediately after `documents`:

```prisma
  monthlyRequestUsage MonthlyRequestUsage[]
```

- [ ] **Step 2: Generate the migration skeleton, or hand-author it if that fails**

Run: `docker start dentalcompare-db` (ignore "already running" errors), then:
`npx prisma migrate dev --name request_counters --create-only`

If this fails non-interactively (the previous plan's Task 1 hit exactly this — Prisma demanding a confirmation prompt this shell can't answer), don't retry it: hand-author the migration folder and file directly instead, using a timestamp later than the last existing migration folder, and go straight to Step 4.

- [ ] **Step 3: Write the migration SQL**

The generated (or hand-authored) `migration.sql` should read:

```sql
-- Both columns are purely additive with permanent defaults — no existing row
-- needs a value it doesn't already have, and no default is ever dropped (see
-- the schema comment: unrelated test fixtures across the repo create
-- ClinicSubscription rows directly and have no reason to know about either
-- column).
ALTER TABLE "ClinicSubscription" ADD COLUMN "trialRequestCap" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "ClinicSubscription" ADD COLUMN "verifiedRequestCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MonthlyRequestUsage" (
    "dentistId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MonthlyRequestUsage_pkey" PRIMARY KEY ("dentistId", "yearMonth")
);

ALTER TABLE "MonthlyRequestUsage" ADD CONSTRAINT "MonthlyRequestUsage_dentistId_fkey"
  FOREIGN KEY ("dentistId") REFERENCES "Dentist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Apply the migration and regenerate the client**

Run: `npx prisma migrate dev` (applies the migration from Step 3; auto-runs `prisma generate`). If it does not auto-generate, run `npx prisma generate` explicitly.

- [ ] **Step 5: Update `createPendingSubscription`**

In `src/server/subscriptions.ts`, add `trialRequestCap: number` to the `args` type of `createPendingSubscription` (immediately after the existing `trialDays: number` field) and pass it through to `create`:

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
      setupToken: args.setupToken,
      status: "PENDING",
      provider: args.provider,
      tier: args.tier,
    },
  });
}
```

- [ ] **Step 6: Update `clinic-registration.ts`**

Find the `createPendingSubscription` call (inside the `db.$transaction` block) and add `trialRequestCap: pricing.trialRequestCap,` immediately after the existing `trialDays: pricing.trialDays,` line:

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
        provider,
        tier: "BASIC",
      },
      tx,
    );
```

- [ ] **Step 7: Update `admin-actions.ts`**

Find the "Complimentary subscription" `tx.clinicSubscription.create` block and add `trialRequestCap: pricing.trialRequestCap,` immediately after the existing `trialDays: pricing.trialDays,` line:

```ts
    await tx.clinicSubscription.create({
      data: {
        dentistId: dentist.id,
        plan: "MONTHLY",
        priceMinor: pricing.monthlyPriceMinor,
        currency: pricing.currency,
        trialDays: pricing.trialDays,
        trialRequestCap: pricing.trialRequestCap,
        tier: "BASIC",
        setupToken: randomUUID(),
        status: "ACTIVE",
        currentPeriodEnd: null,
        recurringToken: null,
      },
    });
```

(This path creates the subscription already `ACTIVE`, never `TRIALING`, so `trialRequestCap` is inert here — passed only for consistency, since the column is required by `createPendingSubscription`'s sibling call and by the DB's own honesty about what every row actually agreed to.)

- [ ] **Step 8: Fix `subscriptions.integration.test.ts`'s two direct calls**

This file calls `createPendingSubscription` directly (not through the registration flow), so its TypeScript call sites need the new required field too. Find both `createPendingSubscription({...})` calls and add `trialRequestCap: 5,` immediately after each one's `trialDays: 45,` line:

```ts
    await createPendingSubscription({
      dentistId: dentist.id,
      plan: "MONTHLY",
      setupToken: randomUUID(),
      priceMinor: 12345,
      currency: "USD",
      trialDays: 45,
      trialRequestCap: 5,
      provider: "PAYPLUS",
      tier: "BASIC",
    });
```

(second occurrence has `priceMinor: 29900, currency: "ILS"` instead — same one-line addition, nothing else changes.)

- [ ] **Step 9: Write the schema test**

Create `src/server/request-counters-schema.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
const created = { dentistIds: [] as string[] };

describe.skipIf(!hasDb)("ClinicSubscription counters and MonthlyRequestUsage", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
  }, DB_TIMEOUT);

  async function seedDentist(): Promise<string> {
    const sfx = randomUUID().slice(0, 8);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `counters_${sfx}@example.com`,
        phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
        city: "Tel Aviv",
        address: "1 Main St",
        experienceYears: 5,
      },
    });
    created.dentistIds.push(dentist.id);
    return dentist.id;
  }

  it("a raw ClinicSubscription insert defaults trialRequestCap to 5 and verifiedRequestCount to 0", async () => {
    const dentistId = await seedDentist();
    const sub = await db.clinicSubscription.create({
      data: {
        dentistId,
        plan: "MONTHLY",
        priceMinor: 29900,
        currency: "ILS",
        trialDays: 60,
        setupToken: randomUUID(),
      },
    });
    expect(sub.trialRequestCap).toBe(5);
    expect(sub.verifiedRequestCount).toBe(0);
  });

  it("MonthlyRequestUsage upserts by (dentistId, yearMonth)", async () => {
    const dentistId = await seedDentist();
    await db.monthlyRequestUsage.create({ data: { dentistId, yearMonth: "2026-09", count: 1 } });
    const updated = await db.monthlyRequestUsage.update({
      where: { dentistId_yearMonth: { dentistId, yearMonth: "2026-09" } },
      data: { count: { increment: 1 } },
    });
    expect(updated.count).toBe(2);

    const other = await db.monthlyRequestUsage.create({
      data: { dentistId, yearMonth: "2026-10", count: 1 },
    });
    expect(other.count).toBe(1);
  });

  it("deleting the dentist cascades to its MonthlyRequestUsage rows", async () => {
    const dentistId = await seedDentist();
    await db.monthlyRequestUsage.create({ data: { dentistId, yearMonth: "2026-09", count: 3 } });
    await db.dentist.delete({ where: { id: dentistId } });
    created.dentistIds = created.dentistIds.filter((id) => id !== dentistId);
    const rows = await db.monthlyRequestUsage.findMany({ where: { dentistId } });
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 10: Run the tests**

Run: `npx vitest run src/server/request-counters-schema.integration.test.ts src/server/subscriptions.integration.test.ts`
Expected: PASS (requires the local DB running).

Run: `npx tsc --noEmit`
Expected: errors only in files this task deliberately doesn't touch yet — there should be none, since this task's `createPendingSubscription` signature change has exactly the 3 call sites this task fixes (`clinic-registration.ts`, `admin-actions.ts`, `subscriptions.integration.test.ts`) and no others (unlike the previous plan's `getSubscriptionPricing`/`parsePricingInput` changes, nothing outside this task calls `createPendingSubscription`). If you see any error, it's a missed call site — find and fix it.

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/server/subscriptions.ts src/server/clinic-registration.ts src/server/admin-actions.ts src/server/subscriptions.integration.test.ts src/server/request-counters-schema.integration.test.ts
git commit -m "feat: add request counters and MonthlyRequestUsage to schema"
```

---

### Task 2: Extract `convertPayPlusTrialToPaid` from the daily cron

**Files:**
- Modify: `src/server/subscriptions.ts`
- Modify: `src/app/api/cron/renew-subscriptions/route.ts`

**Interfaces:**
- Produces: `convertPayPlusTrialToPaid(args): Promise<"converted" | "unbilled" | "failed">`, exported from `src/server/subscriptions.ts`. Task 3 depends on this exact function name, argument shape, and return type.
- This task changes **no external behavior** — it is a pure extraction. The existing cron integration test (`route.integration.test.ts`) is the regression gate and is not modified.

- [ ] **Step 1: Add the new imports `subscriptions.ts` needs**

At the top of `src/server/subscriptions.ts`, add these imports (the file already imports `getDictionary`, `getRequestLocale`, `db`, `Prisma`, `SubscriptionProvider`/`SubscriptionTier`, `SubscriptionPlanType`, `nextPeriodEnd`, `mapStripeSubscriptionStatus`, `Stripe` — do not duplicate any of those):

```ts
import { billingBlocker } from "@/lib/subscription";
import { chargeByToken } from "@/lib/payplus";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { asLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { sendPaymentFailedEmail, sendTrialUnbilledAdminEmail } from "@/server/subscription-notifications";
```

- [ ] **Step 2: Add `convertPayPlusTrialToPaid`**

Add this function to `src/server/subscriptions.ts`, anywhere after `markTrialEndedUnbilled` (which it calls) and after `recordRenewalCharge`/`markPastDue` (which it also calls) — all three already exist earlier in this same file:

```ts
export type PayPlusTrialConversionOutcome = "converted" | "unbilled" | "failed";

/**
 * Attempts the first real charge for a PayPlus clinic whose trial is over —
 * whether "over" means the calendar date passed (the daily cron's own check,
 * kept exactly as it was) or the clinic just crossed its outcome-based
 * request threshold (an immediate call from request-usage.ts, no calendar
 * check at all). Both callers share this one body so the two triggers can
 * never drift into different billing behavior.
 *
 * periodStart is the caller's decision, not derived here: the cron passes
 * the trial's calendar end (so a clinic never pays for days it already had
 * free), while an immediate conversion passes "now" — an outcome-based trial
 * has no scheduled end to anchor to; this moment IS when it ended.
 */
export async function convertPayPlusTrialToPaid(args: {
  subscriptionId: string;
  plan: SubscriptionPlanType;
  priceMinor: number | null;
  currency: string | null;
  recurringToken: string | null;
  payplusCustomerUid: string | null;
  periodStart: Date;
  dentistEmail: string;
  dentistLocale: string;
  clinicName: string;
  payplusConfigured: boolean;
}): Promise<PayPlusTrialConversionOutcome> {
  if (args.priceMinor === null || args.currency === null) {
    logEvent("error", "subscription.missing_price", {
      subscriptionId: args.subscriptionId,
      priceMinor: args.priceMinor,
      currency: args.currency,
    });
    return "failed";
  }
  const price = { minor: args.priceMinor, currency: args.currency };

  const blocker = billingBlocker({
    payplusConfigured: args.payplusConfigured,
    recurringToken: args.recurringToken,
  });
  if (blocker) {
    const firstTime = await markTrialEndedUnbilled(args.subscriptionId);
    if (firstTime) {
      logEvent("error", "subscription.trial_ended_unbilled", {
        subscriptionId: args.subscriptionId,
        reason: blocker,
      });
      await audit({
        actor: "system",
        action: "subscription.trial_ended_unbilled",
        entity: "ClinicSubscription",
        entityId: args.subscriptionId,
        metadata: { reason: blocker },
      });
      await sendTrialUnbilledAdminEmail({
        clinicName: args.clinicName,
        clinicEmail: args.dentistEmail,
        reason: blocker,
      });
    }
    return "unbilled";
  }

  const clinicT = await getDictionary(asLocale(args.dentistLocale));

  try {
    const result = await chargeByToken({
      // Non-null past the blocker check above; billingBlocker returns
      // "no_card" for exactly this case.
      recurringToken: args.recurringToken!,
      payplusCustomerUid: args.payplusCustomerUid,
      amountMinor: price.minor,
      currency: price.currency,
      description: format(clinicT.clinics.chargeDescription, { clinic: args.clinicName }),
    });

    if (result.ok) {
      await recordRenewalCharge({
        subscriptionId: args.subscriptionId,
        transactionUid: result.transactionUid,
        amountMinor: price.minor,
        currency: price.currency,
        periodStart: args.periodStart,
        periodEnd: nextPeriodEnd(args.periodStart, args.plan),
      });
      await audit({
        actor: "system",
        action: "subscription.trial_converted",
        entity: "ClinicSubscription",
        entityId: args.subscriptionId,
        metadata: {
          transactionUid: result.transactionUid,
          amountMinor: price.minor,
          currency: price.currency,
        },
      });
      return "converted";
    }

    logEvent("error", "subscription.trial_charge_failed", {
      subscriptionId: args.subscriptionId,
      error: result.error,
    });
    const firstFailure = await markPastDue(args.subscriptionId);
    if (firstFailure) {
      await sendPaymentFailedEmail({
        email: args.dentistEmail,
        clinicName: args.clinicName,
        locale: asLocale(args.dentistLocale),
      });
    }
    return "failed";
  } catch (err) {
    logEvent("error", "subscription.trial_convert_error", {
      subscriptionId: args.subscriptionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return "failed";
  }
}
```

- [ ] **Step 3: Replace the cron's inline conversion block with a call to the extracted function**

In `src/app/api/cron/renew-subscriptions/route.ts`, find the `for (const sub of trials)` loop. It currently reads (abbreviated — the full text is in the file):

```ts
    // Trial is over. Before charging, ask whether charging is even possible —
    // and if it is not, say so once rather than retry into silence every day.
    const blocker = billingBlocker({ payplusConfigured, recurringToken: sub.recurringToken });
    if (blocker) {
      // ...markTrialEndedUnbilled + audit + sendTrialUnbilledAdminEmail...
      trialsUnbilled += 1;
      continue;
    }

    try {
      const result = await chargeByToken({ /* ... */ });
      if (result.ok) {
        // ...recordRenewalCharge + audit...
        trialsConverted += 1;
      } else {
        // ...logEvent + markPastDue + sendPaymentFailedEmail...
        trialsFailed += 1;
      }
    } catch (err) {
      // ...logEvent...
      trialsFailed += 1;
    }
  }
```

Replace that **entire block** (everything from the `const blocker = billingBlocker(...)` line down through the closing `}` of the `catch` block, i.e. everything after the `if (!isTrialOver(...))` branch's `continue` and before the loop's closing `}`) with:

```ts
    // Trial is over. Delegate to the shared conversion path so the cron and
    // the immediate outcome-based trigger (src/server/request-usage.ts) can
    // never diverge in billing behavior.
    const outcome = await convertPayPlusTrialToPaid({
      subscriptionId: sub.id,
      plan: sub.plan as SubscriptionPlanType,
      priceMinor: sub.priceMinor,
      currency: sub.currency,
      recurringToken: sub.recurringToken,
      payplusCustomerUid: sub.payplusCustomerUid,
      periodStart: sub.trialEndsAt,
      dentistEmail: sub.dentist.email,
      dentistLocale: sub.dentist.locale,
      clinicName: sub.dentist.clinicName,
      payplusConfigured,
    });
    if (outcome === "converted") trialsConverted += 1;
    else if (outcome === "unbilled") trialsUnbilled += 1;
    else trialsFailed += 1;
  }
```

Update the imports at the top of the file. `chargeByToken` is used a SECOND time in this file, inside the renewals pass below the trials pass (`for (const sub of candidates)`) — it must stay. `nextPeriodEnd`, `sendPaymentFailedEmail`, `audit`, `markPastDue`, `cancelSubscription` are also all still used by the renewals pass — none of them move. Only the trials-pass-only imports go. Replace the two import blocks:

```ts
import {
  isDueForRenewal,
  isWithinGrace,
  nextPeriodEnd,
  isTrialOver,
  dueTrialWarning,
  trialDaysRemaining,
  billingBlocker,
} from "@/lib/subscription";
```
```ts
import {
  recordRenewalCharge,
  markPastDue,
  cancelSubscription,
  markTrialEndedUnbilled,
} from "@/server/subscriptions";
```
```ts
import {
  sendPaymentFailedEmail,
  sendTrialEndingEmail,
  sendTrialUnbilledAdminEmail,
} from "@/server/subscription-notifications";
```

with:

```ts
import {
  isDueForRenewal,
  isWithinGrace,
  nextPeriodEnd,
  isTrialOver,
  dueTrialWarning,
  trialDaysRemaining,
} from "@/lib/subscription";
```
```ts
import {
  recordRenewalCharge,
  markPastDue,
  cancelSubscription,
  convertPayPlusTrialToPaid,
} from "@/server/subscriptions";
```
```ts
import {
  sendPaymentFailedEmail,
  sendTrialEndingEmail,
} from "@/server/subscription-notifications";
```

(`billingBlocker` and `markTrialEndedUnbilled` are gone entirely from this file — both moved into `convertPayPlusTrialToPaid`. `sendTrialUnbilledAdminEmail` is gone the same way. `chargeByToken`'s own import line, from `@/lib/payplus`, is untouched — leave `import { chargeByToken, isPayPlusConfigured } from "@/lib/payplus";` exactly as it is.)

Run `npx tsc --noEmit` after this step — it will report an unused-import error for anything still listed here that turns out not to be needed, or a missing-name error for anything removed that was still called. Either way, trust the compiler over this list if they disagree, and note the discrepancy in your report.

- [ ] **Step 4: Run the existing cron test suite unchanged**

Run: `npx vitest run src/app/api/cron/renew-subscriptions/route.integration.test.ts`
Expected: PASS, with the exact same test count and assertions as before this task — this is a pure refactor, so every existing test (trial conversion success, decline, unconfigured PayPlus, missing card, renewals, cancellation) must still pass without modification. If any test fails, the extraction changed behavior somewhere — do not "fix" the test, find and fix the behavioral drift in the extracted function or its call site.

- [ ] **Step 5: Full verification**

Run: `npx tsc --noEmit` — expect clean, repo-wide.
Run: `npm test` — expect the full suite green (this task didn't touch anything else, so the count should match Task 1's ending count exactly).

- [ ] **Step 6: Commit**

```bash
git add src/server/subscriptions.ts "src/app/api/cron/renew-subscriptions/route.ts"
git commit -m "refactor: extract convertPayPlusTrialToPaid from the renewal cron"
```

---

### Task 3: `recordVerifiedRequest` — counter bookkeeping + immediate conversion dispatch

**Files:**
- Create: `src/lib/stripe.ts` — add `endStripeTrialNow` (modify, not create — the file already exists)
- Create: `src/server/request-usage.ts`
- Create: `src/server/request-usage.integration.test.ts`
- Modify: `src/server/fulfillment.ts`
- Modify: `src/server/fulfillment.integration.test.ts`

**Interfaces:**
- Consumes: `convertPayPlusTrialToPaid` (Task 2), `isPayPlusConfigured` from `@/lib/payplus` (existing).
- Produces: `recordVerifiedRequest(dentistId: string): Promise<void>`, exported from `src/server/request-usage.ts` — called by `fulfillment.ts` once per successfully-delivered request. `endStripeTrialNow(stripeSubscriptionId: string): Promise<void>`, exported from `src/lib/stripe.ts`.

- [ ] **Step 1: Add `endStripeTrialNow` to `src/lib/stripe.ts`**

Add this function anywhere after `createSubscriptionCheckoutSession` (it uses the same private `getStripeClient()` helper already in this file):

```ts
/**
 * Ends a Stripe subscription's trial immediately instead of waiting for its
 * scheduled trial_period_days to elapse. Stripe then invoices right away —
 * the existing webhook handler (customer.subscription.updated, invoice.paid)
 * picks up the resulting state change exactly as it would for a trial that
 * ran its full calendar length, so nothing else needs to change to make this
 * work.
 */
export async function endStripeTrialNow(stripeSubscriptionId: string): Promise<void> {
  await getStripeClient().subscriptions.update(stripeSubscriptionId, {
    trial_end: "now",
    proration_behavior: "none",
  });
}
```

- [ ] **Step 2: Write the failing tests for `recordVerifiedRequest`**

Create `src/server/request-usage.integration.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { recordVerifiedRequest as RecordFn } from "@/server/request-usage";

const chargeByToken = vi.fn();
const isPayPlusConfigured = vi.fn(() => true);
vi.mock("@/lib/payplus", async (orig) => {
  const actual = (await orig()) as object;
  return { ...actual, chargeByToken, isPayPlusConfigured };
});

const endStripeTrialNow = vi.fn(async () => {});
vi.mock("@/lib/stripe", async (orig) => {
  const actual = (await orig()) as object;
  return { ...actual, endStripeTrialNow };
});

vi.mock("@/server/subscription-notifications", () => ({
  sendPaymentFailedEmail: vi.fn(async () => true),
  sendTrialUnbilledAdminEmail: vi.fn(async () => true),
}));

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let recordVerifiedRequest: typeof RecordFn;
const created = { dentistIds: [] as string[] };

describe.skipIf(!hasDb)("recordVerifiedRequest", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ recordVerifiedRequest } = await import("@/server/request-usage"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
    chargeByToken.mockReset();
    isPayPlusConfigured.mockReset().mockReturnValue(true);
    endStripeTrialNow.mockClear();
  }, DB_TIMEOUT);

  async function seedTrialing(args: {
    provider: "PAYPLUS" | "STRIPE";
    trialRequestCap: number;
    stripeSubscriptionId?: string;
    recurringToken?: string;
  }): Promise<string> {
    const sfx = randomUUID().slice(0, 8);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `usage_${sfx}@example.com`,
        phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
        city: "Tel Aviv",
        address: "1 Main St",
        experienceYears: 5,
      },
    });
    created.dentistIds.push(dentist.id);
    await db.clinicSubscription.create({
      data: {
        dentistId: dentist.id,
        plan: "MONTHLY",
        priceMinor: 29900,
        currency: "ILS",
        trialDays: 60,
        trialRequestCap: args.trialRequestCap,
        setupToken: randomUUID(),
        status: "TRIALING",
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        provider: args.provider,
        stripeSubscriptionId: args.stripeSubscriptionId,
        recurringToken: args.recurringToken,
      },
    });
    return dentist.id;
  }

  it("increments verifiedRequestCount by 1 per call", async () => {
    const dentistId = await seedTrialing({ provider: "PAYPLUS", trialRequestCap: 5 });
    await recordVerifiedRequest(dentistId);
    await recordVerifiedRequest(dentistId);
    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
    expect(sub.verifiedRequestCount).toBe(2);
  });

  it("creates a MonthlyRequestUsage row on first call, increments on later calls", async () => {
    const dentistId = await seedTrialing({ provider: "PAYPLUS", trialRequestCap: 5 });
    const yearMonth = new Date().toISOString().slice(0, 7);
    await recordVerifiedRequest(dentistId);
    let usage = await db.monthlyRequestUsage.findUniqueOrThrow({
      where: { dentistId_yearMonth: { dentistId, yearMonth } },
    });
    expect(usage.count).toBe(1);
    await recordVerifiedRequest(dentistId);
    usage = await db.monthlyRequestUsage.findUniqueOrThrow({
      where: { dentistId_yearMonth: { dentistId, yearMonth } },
    });
    expect(usage.count).toBe(2);
  });

  it("does not attempt conversion below the threshold", async () => {
    const dentistId = await seedTrialing({ provider: "PAYPLUS", trialRequestCap: 3, recurringToken: "tok_1" });
    await recordVerifiedRequest(dentistId);
    await recordVerifiedRequest(dentistId);
    expect(chargeByToken).not.toHaveBeenCalled();
  });

  it("PayPlus: crossing the threshold charges immediately and marks ACTIVE", async () => {
    chargeByToken.mockResolvedValue({ ok: true, transactionUid: `txn_${randomUUID().slice(0, 8)}` });
    const dentistId = await seedTrialing({ provider: "PAYPLUS", trialRequestCap: 2, recurringToken: "tok_1" });
    await recordVerifiedRequest(dentistId);
    expect(chargeByToken).not.toHaveBeenCalled();
    await recordVerifiedRequest(dentistId);
    expect(chargeByToken).toHaveBeenCalledTimes(1);
    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
    expect(sub.status).toBe("ACTIVE");
  });

  it("PayPlus: a request beyond the threshold does not charge a second time", async () => {
    chargeByToken.mockResolvedValue({ ok: true, transactionUid: `txn_${randomUUID().slice(0, 8)}` });
    const dentistId = await seedTrialing({ provider: "PAYPLUS", trialRequestCap: 1, recurringToken: "tok_1" });
    await recordVerifiedRequest(dentistId);
    expect(chargeByToken).toHaveBeenCalledTimes(1);
    await recordVerifiedRequest(dentistId);
    expect(chargeByToken).toHaveBeenCalledTimes(1);
  });

  it("Stripe: crossing the threshold ends the trial early via the Stripe API", async () => {
    const dentistId = await seedTrialing({
      provider: "STRIPE",
      trialRequestCap: 1,
      stripeSubscriptionId: "sub_test123",
    });
    await recordVerifiedRequest(dentistId);
    expect(endStripeTrialNow).toHaveBeenCalledWith("sub_test123");
    expect(chargeByToken).not.toHaveBeenCalled();
  });

  it("Stripe: crossing the threshold with no stripeSubscriptionId yet does nothing (not an error)", async () => {
    const dentistId = await seedTrialing({ provider: "STRIPE", trialRequestCap: 1 });
    await expect(recordVerifiedRequest(dentistId)).resolves.toBeUndefined();
    expect(endStripeTrialNow).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/server/request-usage.integration.test.ts`
Expected: FAIL — `src/server/request-usage.ts` does not exist yet.

- [ ] **Step 4: Write `src/server/request-usage.ts`**

```ts
import "server-only";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { isPayPlusConfigured } from "@/lib/payplus";
import { endStripeTrialNow } from "@/lib/stripe";
import { convertPayPlusTrialToPaid } from "@/server/subscriptions";
import type { SubscriptionPlanType } from "@/lib/constants";

function currentYearMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7); // "2026-09"
}

type TrialSubscriptionAfterIncrement = {
  id: string;
  status: string;
  provider: "PAYPLUS" | "STRIPE";
  plan: string;
  priceMinor: number | null;
  currency: string | null;
  recurringToken: string | null;
  payplusCustomerUid: string | null;
  stripeSubscriptionId: string | null;
  trialRequestCap: number;
  verifiedRequestCount: number;
  dentist: { clinicName: string; email: string; locale: string };
};

/**
 * Records that a request was actually delivered to a clinic — the trigger
 * for both the outcome-based trial (lifetime count on ClinicSubscription)
 * and the monthly request cap (MonthlyRequestUsage, unread by anything until
 * the request-cap-enforcement plan). Called once per (request, clinic) pair,
 * right after fulfillment.ts confirms the email to that clinic actually sent.
 *
 * If this push crosses the clinic's frozen trialRequestCap while it is still
 * TRIALING, the trial converts immediately. A daily cron remains the safety
 * net for PayPlus (a clinic that never crosses the threshold still converts
 * on its calendar trialEndsAt, unchanged by this plan); Stripe's own
 * trial_period_days, set at Checkout, is that same safety net for Stripe
 * clinics.
 */
export async function recordVerifiedRequest(dentistId: string): Promise<void> {
  const yearMonth = currentYearMonth();

  const [sub] = await db.$transaction([
    db.clinicSubscription.update({
      where: { dentistId },
      data: { verifiedRequestCount: { increment: 1 } },
      select: {
        id: true,
        status: true,
        provider: true,
        plan: true,
        priceMinor: true,
        currency: true,
        recurringToken: true,
        payplusCustomerUid: true,
        stripeSubscriptionId: true,
        trialRequestCap: true,
        verifiedRequestCount: true,
        dentist: { select: { clinicName: true, email: true, locale: true } },
      },
    }),
    db.monthlyRequestUsage.upsert({
      where: { dentistId_yearMonth: { dentistId, yearMonth } },
      create: { dentistId, yearMonth, count: 1 },
      update: { count: { increment: 1 } },
    }),
  ]);

  if (sub.status !== "TRIALING" || sub.verifiedRequestCount < sub.trialRequestCap) return;

  await attemptImmediateConversion(sub as TrialSubscriptionAfterIncrement);
}

async function attemptImmediateConversion(sub: TrialSubscriptionAfterIncrement): Promise<void> {
  if (sub.provider === "PAYPLUS") {
    await convertPayPlusTrialToPaid({
      subscriptionId: sub.id,
      plan: sub.plan as SubscriptionPlanType,
      priceMinor: sub.priceMinor,
      currency: sub.currency,
      recurringToken: sub.recurringToken,
      payplusCustomerUid: sub.payplusCustomerUid,
      periodStart: new Date(),
      dentistEmail: sub.dentist.email,
      dentistLocale: sub.dentist.locale,
      clinicName: sub.dentist.clinicName,
      payplusConfigured: isPayPlusConfigured(),
    });
    return;
  }

  // STRIPE. Nothing to end early if the clinic never completed Checkout —
  // the same known gap already documented for the PayPlus side (a clinic
  // approved but never onboarded has no subscription to act on yet). Stripe's
  // own trial_period_days is what eventually surfaces this one.
  if (!sub.stripeSubscriptionId) {
    logEvent("info", "subscription.trial_threshold_no_stripe_subscription", {
      subscriptionId: sub.id,
    });
    return;
  }

  try {
    await endStripeTrialNow(sub.stripeSubscriptionId);
  } catch (err) {
    logEvent("error", "subscription.stripe_trial_end_failed", {
      subscriptionId: sub.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/server/request-usage.integration.test.ts`
Expected: PASS, 8 tests (requires the local DB running).

- [ ] **Step 6: Wire the hook into `fulfillment.ts`**

In `src/server/fulfillment.ts`, add the import:

```ts
import { recordVerifiedRequest } from "@/server/request-usage";
```

Find the `requestDentists` select in `fulfillRequest` (currently selects `id` and nested `dentist{...}` only) and add `dentistId: true`:

```ts
      requestDentists: {
        where: { emailSent: false },
        select: {
          id: true,
          dentistId: true,
          dentist: { select: { dentistName: true, email: true, locale: true } },
        },
      },
```

Find the line `sent += 1;` inside the `try` block (right after the `resend.emails.send` call succeeds) and add the counter call immediately after it, wrapped so a counting failure never undoes the fact that the email genuinely sent:

```ts
      if (error) throw new Error(error.message ?? "Resend error");
      sent += 1;
      try {
        await recordVerifiedRequest(rd.dentistId);
      } catch (err) {
        logEvent("error", "fulfillment.record_verified_request_failed", {
          requestId: request.id,
          dentistId: rd.dentistId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
```

- [ ] **Step 7: Extend `fulfillment.integration.test.ts`**

This file's existing `seed({ dentistCount })` helper (near the top of the file) creates each `Dentist` WITHOUT a `ClinicSubscription` — fine for the existing tests, which never look at subscription state, but `recordVerifiedRequest` uses `db.clinicSubscription.update({ where: { dentistId } })`, which throws if no subscription row exists for that dentist. Do not modify the shared `seed()` helper (other tests depend on its exact current behavior) — instead, add a `ClinicSubscription` directly in the new test, after seeding.

Add this import at the top of the file, alongside the existing `randomUUID` import:

```ts
import { randomUUID } from "node:crypto";
```

(already present — just confirming it's there; no change needed if so.)

Add one new test, near the existing tests in the `describe.skipIf(!hasDb)(...)` block:

```ts
  it(
    "increments the clinic's verifiedRequestCount and MonthlyRequestUsage after a successful send",
    async () => {
      const { requestId } = await seed({ dentistCount: 1 });
      const dentistId = created.dentistIds[created.dentistIds.length - 1];
      await db.clinicSubscription.create({
        data: {
          dentistId,
          plan: "MONTHLY",
          priceMinor: 29900,
          currency: "ILS",
          trialDays: 60,
          setupToken: randomUUID(),
          status: "TRIALING",
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const result = await fulfillRequest(requestId);
      expect(result.ok).toBe(true);

      const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
      expect(sub.verifiedRequestCount).toBe(1);

      const yearMonth = new Date().toISOString().slice(0, 7);
      const usage = await db.monthlyRequestUsage.findUniqueOrThrow({
        where: { dentistId_yearMonth: { dentistId, yearMonth } },
      });
      expect(usage.count).toBe(1);
    },
    DB_TIMEOUT,
  );
```

Note this test does not add its own cleanup for the `ClinicSubscription` or `MonthlyRequestUsage` rows it creates — the existing `afterEach` in this file deletes every dentist in `created.dentistIds`, and both new tables cascade-delete from `Dentist` (see Task 1's schema: `MonthlyRequestUsage.dentist` has `onDelete: Cascade`; `ClinicSubscription.dentist` already did before this plan).

- [ ] **Step 8: Run the fulfillment test suite**

Run: `npx vitest run src/server/fulfillment.integration.test.ts`
Expected: PASS, including the new test, with no change to any existing test's behavior.

- [ ] **Step 9: Full verification**

Run: `npx tsc --noEmit` — expect clean, repo-wide.
Run: `npm test` — expect the full suite green.

- [ ] **Step 10: Commit**

```bash
git add src/lib/stripe.ts src/server/request-usage.ts src/server/request-usage.integration.test.ts src/server/fulfillment.ts src/server/fulfillment.integration.test.ts
git commit -m "feat: count verified requests and trigger immediate trial conversion"
```

---

### Task 4: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full type-check and full suite**

Run: `npx tsc --noEmit` — expect clean, repo-wide.
Run: `npm test` — expect every test passing, output pristine (no stray warnings).

- [ ] **Step 2: Sanity-check the cron still behaves identically for a calendar-driven conversion**

Run: `npx vitest run src/app/api/cron/renew-subscriptions/route.integration.test.ts`
Expected: PASS, same test count as before Task 2 — confirms the extraction in Task 2 didn't regress under the schema changes Task 1 and Task 3 added on top of it.

- [ ] **Step 3: Note what this plan does NOT do**

This plan does not enforce `monthlyRequestCap` anywhere (no clinic is ever hidden from the directory for exceeding it) and does not touch `publicDentistWhere()`/`dentist-public.ts`. `MonthlyRequestUsage` is written by this plan and read by nothing yet. That enforcement, plus the 5-clinic city floor, is the next plan in this series (spec section 3).

---

## After this plan

`verifiedRequestCount` and `MonthlyRequestUsage` are populated correctly from every real request going forward, and a TRIALING clinic converts to paid the moment it crosses its threshold — for both providers. The calendar trial (`trialEndsAt`/`trial_period_days`) still exists and still works as the safety net, unchanged. Nothing yet reads `monthlyRequestCap` to hide a clinic from the directory, and nothing yet decrements a count on a disputed lead (no code path can mark one). The next plan in this series (request-cap enforcement + the city floor) is the first one that changes what a patient actually sees.
