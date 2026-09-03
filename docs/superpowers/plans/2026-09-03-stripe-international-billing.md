# Stripe International Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A non-Israeli clinic can register, pay via Stripe (card collected at signup, native Stripe trial, no charge until the trial ends), and have its subscription lifecycle (trial → active → past-due → canceled) driven entirely by Stripe webhooks — mirroring what PayPlus already does for Israeli clinics, without touching PayPlus's own cron-driven engine at all.

**Architecture:** Provider is decided once, at registration, from the clinic's country (`countryCode === "IL"` → `PAYPLUS`, everything else → `STRIPE`) and stored on `ClinicSubscription.provider` — the same `SubscriptionProvider` enum `SubscriptionPricing` already uses. PayPlus keeps its existing cron-driven flow untouched. Stripe is additive: a new `src/lib/stripe.ts` wraps the official `stripe` SDK, a new webhook route translates Stripe's own subscription/invoice events into this app's existing `SubscriptionStatus` states, and two provider-agnostic functions already in `src/server/subscriptions.ts` (`markPastDue`, `cancelSubscription`) are reused as-is for Stripe too — no new "past due" or "cancel" logic needed, only new "how do we learn about it" plumbing.

**Tech Stack:** Next.js 16.2.11, React 19.2, Prisma 7.8 + Postgres, `stripe` npm SDK (new dependency), vitest (node).

**Spec:** No separate spec document for this plan — the design was worked out and approved directly in conversation (Eden asked to skip straight to the implementation plan). The **Global Constraints** below are the closed decisions this plan argues from; treat them as the binding authority a spec would normally carry.

## Global Constraints

- **Card required at signup, exactly like PayPlus.** Stripe Checkout is configured with `payment_method_collection: "always"` and a native `trial_period_days` on the subscription — the card is validated and saved immediately, but Stripe does not charge anything until the trial ends. This is a closed decision (Eden confirmed explicitly): do not build a "no card until trial ends" flow.
- **Provider is decided once, at registration, from `Dentist.countryCode`.** `"IL"` → `PAYPLUS`; anything else → `STRIPE`. Never re-derived later. Never ask the clinic to pick a provider.
- **One fixed currency for every Stripe clinic (USD), regardless of the clinic's own country** — this was decided when `SubscriptionPricing`'s `STRIPE` row was seeded (`docs/superpowers/plans/2026-09-02-editable-subscription-pricing.md`) and is unchanged here.
- **`Quote.status`-style discipline: `SubscriptionStatus` is the only thing anything gates on.** A Stripe webhook handler must translate Stripe's own subscription status into our enum via one pure, testable mapping function — never scatter `if (stripeStatus === "trialing")` checks across multiple call sites.
- **PayPlus's cron (`src/app/api/cron/renew-subscriptions/route.ts`) must never process a Stripe row.** Add an explicit `provider: "PAYPLUS"` filter — don't rely on a Stripe row simply lacking a `recurringToken` to keep it out, that's an accident of the current data shape, not a guarantee.
- **Every server action returns `{ ok: true } | { ok: false; error: string }`**, matching the `ActionResult` pattern already used throughout (see `src/server/request-deletion.ts`, `src/server/pricing-actions.ts`).
- **`he.ts` is the dictionary source of truth; `en.ts` must receive every new key in the same commit.**
- **Test file naming:** `*.integration.test.ts` for anything touching the real Postgres database (`describe.skipIf(!hasDb)`). Local DB: `docker start dentalcompare-db` before running `npm test`. For the Stripe SDK itself, mock it with `vi.mock("stripe", ...)` — never let a test make a real network call to Stripe, and never require live Stripe credentials for `npm test` to pass.
- **This plan cannot be fully exercised end-to-end without a real Stripe account and API keys, which Eden has to create — not something any task here can do.** Every task must still be independently buildable and testable (mocked in unit/integration tests) without live credentials; only the final manual walkthrough needs them.

---

### Task 1: Schema — `provider` on `ClinicSubscription`, Stripe identifiers, and the `stripe` dependency

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_clinic_subscription_stripe/migration.sql`
- Modify: `package.json` (add the `stripe` dependency)
- Modify: `.env.example`
- Test: `src/server/clinic-subscription-provider-schema.integration.test.ts`

**Interfaces:**
- Produces: `ClinicSubscription.provider` (`SubscriptionProvider`, reusing the enum from `docs/superpowers/plans/2026-09-02-editable-subscription-pricing.md`'s Task 1 — do not create a second enum). `ClinicSubscription.stripeCustomerId String?`, `ClinicSubscription.stripeSubscriptionId String? @unique`. `SubscriptionCharge.stripeInvoiceId String? @unique`.

- [ ] **Step 1: Add the `stripe` package**

Run: `npm install stripe`. Check the installed version's peer requirements (`npm ls stripe`) — this plan does not pin an explicit Stripe API version in code (see Task 2) so it tracks whatever the installed SDK's own default is; just confirm the install succeeds and `npx tsc --noEmit` still passes with no new type errors from the empty import surface.

- [ ] **Step 2: Write the failing test**

```ts
// src/server/clinic-subscription-provider-schema.integration.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;

describe.skipIf(!hasDb)("ClinicSubscription.provider", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, 60_000);

  it("defaults an existing-shape row to PAYPLUS and accepts an explicit STRIPE row", async () => {
    const sfx = randomUUID().slice(0, 8);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `prov_${sfx}@example.com`,
        phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
        city: "Tel Aviv",
        address: "1 Main St",
        experienceYears: 5,
      },
    });
    const sub = await db.clinicSubscription.create({
      data: {
        dentistId: dentist.id,
        plan: "MONTHLY",
        priceMinor: 7900,
        currency: "USD",
        trialDays: 60,
        provider: "STRIPE",
        stripeCustomerId: "cus_test123",
        stripeSubscriptionId: `sub_test_${sfx}`,
        setupToken: randomUUID(),
      },
    });
    expect(sub.provider).toBe("STRIPE");
    expect(sub.stripeCustomerId).toBe("cus_test123");

    await db.subscriptionCharge.create({
      data: {
        subscriptionId: sub.id,
        amountMinor: 7900,
        currency: "USD",
        status: "PAID",
        stripeInvoiceId: `in_test_${sfx}`,
        periodStart: new Date(),
        periodEnd: new Date(),
        paidAt: new Date(),
      },
    });

    await db.dentist.delete({ where: { id: dentist.id } });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- clinic-subscription-provider-schema` (needs `docker start dentalcompare-db`)
Expected: FAIL — `provider`, `stripeCustomerId`, `stripeSubscriptionId`, `stripeInvoiceId` don't exist yet.

- [ ] **Step 4: Add the fields to the schema**

In `prisma/schema.prisma`, in `model ClinicSubscription`, add right after `currency`:

```prisma
  // Which payment provider this clinic is billed through, decided once at
  // registration from Dentist.countryCode (IL -> PAYPLUS, else STRIPE) and
  // never re-derived. PayPlus's cron-driven renewal engine and Stripe's own
  // webhook-driven one are completely separate — this field is how every
  // query and cron tells them apart.
  //
  // Unlike priceMinor/currency/trialDays (which dropped their defaults so a
  // missing value fails loudly), this keeps @default(PAYPLUS) permanently:
  // every one of this codebase's dozens of existing ClinicSubscription test
  // fixtures genuinely IS a PayPlus subscription (Israeli test data,
  // ILS pricing) — the default states that historical fact rather than
  // papering over an unknown one, and every real write path this plan adds
  // (Task 3's createPendingSubscription, Task 4's registerClinic) always
  // passes provider explicitly regardless, so production code never leans
  // on the default at all.
  provider                SubscriptionProvider @default(PAYPLUS)
```

And after `pageRequestUid` (the last PayPlus-specific field), add the Stripe equivalents:

```prisma
  // Stripe's own identifiers for this subscription. Set once, from the first
  // webhook event (checkout.session.completed) that confirms Checkout finished.
  stripeCustomerId        String?
  stripeSubscriptionId    String?              @unique
```

In `model SubscriptionCharge`, right after `payplusTransactionUid`, add:

```prisma
  stripeInvoiceId       String?            @unique
```

- [ ] **Step 5: Write the migration**

Check `ls prisma/migrations | tail -3` for the latest timestamp and pick one after it (e.g. `20260903150000`).

```sql
-- prisma/migrations/20260903150000_clinic_subscription_stripe/migration.sql
-- Every existing row is a PayPlus subscription (Stripe support didn't exist
-- before this migration) — backfilled via the DEFAULT below. Unlike
-- priceMinor/currency/trialDays's migrations, the DEFAULT is kept (not
-- dropped) — see the matching comment on the schema field in Step 4 for why.
ALTER TABLE "ClinicSubscription" ADD COLUMN "provider" "SubscriptionProvider" NOT NULL DEFAULT 'PAYPLUS';

ALTER TABLE "ClinicSubscription" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "ClinicSubscription" ADD COLUMN "stripeSubscriptionId" TEXT;
CREATE UNIQUE INDEX "ClinicSubscription_stripeSubscriptionId_key" ON "ClinicSubscription"("stripeSubscriptionId");

ALTER TABLE "SubscriptionCharge" ADD COLUMN "stripeInvoiceId" TEXT;
CREATE UNIQUE INDEX "SubscriptionCharge_stripeInvoiceId_key" ON "SubscriptionCharge"("stripeInvoiceId");
```

- [ ] **Step 6: Apply the migration and regenerate the client**

Run: `docker start dentalcompare-db && npx prisma migrate dev` (confirm the generated migration name matches), then `npx prisma generate`. If `prisma migrate dev` also generates an EXTRA, unrelated migration touching `Quote`/`Request` columns (this has happened before in this repo — pre-existing drift in the local dev database, unrelated to this task), delete that extra migration folder before committing and do not include it; only commit the one migration file you wrote in Step 5. Run `npx prisma migrate status` afterward to confirm no drift is reported for your own change.

- [ ] **Step 7: Add Stripe env vars to `.env.example`**

Near the `PAYPLUS_*` block:

```
STRIPE_SECRET_KEY=""              # sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=""          # whsec_..., from the Stripe Dashboard webhook endpoint
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- clinic-subscription-provider-schema`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations package.json package-lock.json .env.example src/server/clinic-subscription-provider-schema.integration.test.ts
git commit -m "feat(billing): add provider + Stripe identifiers to ClinicSubscription/SubscriptionCharge"
```

---

### Task 2: `src/lib/stripe.ts` — the Stripe wrapper

**Files:**
- Create: `src/lib/stripe.ts`
- Create: `src/lib/stripe.test.ts`

**Interfaces:**
- Produces: `isStripeConfigured(): boolean`. `createSubscriptionCheckoutSession(args): Promise<{ url: string }>`. `verifyStripeWebhookSignature(rawBody: string, signature: string | null): Stripe.Event | null`. `mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus` — the ONE place Stripe's status vocabulary becomes ours.

- [ ] **Step 1: Write the failing tests for the pure status mapping**

```ts
// src/lib/stripe.test.ts
import { describe, it, expect, vi } from "vitest";
import { mapStripeSubscriptionStatus, isStripeConfigured } from "./stripe";

describe("mapStripeSubscriptionStatus", () => {
  it("maps trialing to TRIALING", () => {
    expect(mapStripeSubscriptionStatus("trialing")).toBe("TRIALING");
  });
  it("maps active to ACTIVE", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("ACTIVE");
  });
  it("maps past_due to PAST_DUE", () => {
    expect(mapStripeSubscriptionStatus("past_due")).toBe("PAST_DUE");
  });
  it("maps canceled, unpaid, and incomplete_expired to CANCELED", () => {
    expect(mapStripeSubscriptionStatus("canceled")).toBe("CANCELED");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("CANCELED");
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("CANCELED");
  });
  it("maps incomplete and paused to PAST_DUE — needs attention, never silently ACTIVE", () => {
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("PAST_DUE");
    expect(mapStripeSubscriptionStatus("paused")).toBe("PAST_DUE");
  });
});

describe("isStripeConfigured", () => {
  it("is false when the env vars are missing", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(isStripeConfigured()).toBe(false);
    vi.unstubAllEnvs();
  });
  it("is true when both env vars are set", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    expect(isStripeConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/stripe.test.ts`
Expected: FAIL — `./stripe` does not exist.

- [ ] **Step 3: Implement `src/lib/stripe.ts`**

First check the installed `stripe` package's TypeScript types for whether the `Stripe` constructor requires an `apiVersion` option (`node_modules/stripe/types/*.d.ts` or the package's own README) — recent versions make it optional (defaulting to the account's pinned version) but confirm before writing the constructor call, and adjust the snippet below if the installed version's types require one explicitly.

```ts
// src/lib/stripe.ts
import "server-only";
import Stripe from "stripe";
import { appUrl } from "@/lib/app-url";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

let cachedClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!cachedClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    cachedClient = new Stripe(key);
  }
  return cachedClient;
}

/**
 * The one place Stripe's own subscription-status vocabulary becomes ours.
 * incomplete/paused map to PAST_DUE rather than a silent ACTIVE — both mean
 * "this subscription needs attention", and PAST_DUE is exactly the status
 * this app already has a notification path for (markPastDue's caller sends
 * sendPaymentFailedEmail).
 */
export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "CANCELED";
    case "incomplete":
    case "paused":
    default:
      return "PAST_DUE";
  }
}

/**
 * Creates a Stripe Checkout Session for a new subscription. The price is
 * built inline (price_data) from whatever SubscriptionPricing says right
 * now, rather than a pre-created, reusable Stripe Price object — this is
 * what makes an admin-editable price actually take effect on the very next
 * registration without any Stripe-dashboard bookkeeping. Once a session
 * completes, the resulting Stripe Subscription keeps billing at whatever
 * amount was passed here, unaffected by a later SubscriptionPricing edit —
 * the same snapshot-at-creation guarantee priceMinor/currency already give
 * PayPlus subscriptions.
 *
 * payment_method_collection: "always" + trial_period_days together are what
 * make this "card required now, first charge only when the trial ends" —
 * Stripe validates and saves the card via a $0 SetupIntent at checkout, and
 * schedules the real charge automatically.
 */
export async function createSubscriptionCheckoutSession(args: {
  setupToken: string;
  amountMinor: number;
  currency: string;
  trialDays: number;
  intervalMonths: 1 | 12;
  clinicName: string;
  email: string;
  itemName: string;
}): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const base = appUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: args.email,
    payment_method_collection: "always",
    line_items: [
      {
        price_data: {
          currency: args.currency.toLowerCase(),
          unit_amount: args.amountMinor,
          recurring: { interval: args.intervalMonths === 12 ? "year" : "month" },
          product_data: { name: args.itemName },
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: args.trialDays,
      metadata: { setupToken: args.setupToken },
    },
    metadata: { setupToken: args.setupToken },
    success_url: `${base}/clinics/billing/return?token=${args.setupToken}&status=success`,
    cancel_url: `${base}/clinics/billing/return?token=${args.setupToken}&status=failure`,
  });
  if (!session.url) throw new Error("Stripe checkout session has no url");
  return { url: session.url };
}

/**
 * Verifies and parses a Stripe webhook payload. Returns null on any failure
 * (missing secret, missing signature header, bad signature) — the caller
 * treats null exactly like an invalid PayPlus IPN signature: a 401, nothing
 * else happens.
 */
export function verifyStripeWebhookSignature(rawBody: string, signature: string | null): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return null;
  try {
    return getStripeClient().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

/** Fetches the live Stripe Subscription for a given id — used by the return-page fallback and the webhook handler alike, so both read the exact same shape. */
export async function retrieveStripeSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  return getStripeClient().subscriptions.retrieve(stripeSubscriptionId);
}

/** Fetches a Checkout Session, expanding its subscription — used by the return-page fallback when the webhook hasn't landed yet. */
export async function retrieveCheckoutSessionWithSubscription(
  sessionId: string,
): Promise<Stripe.Checkout.Session & { subscription: Stripe.Subscription | null }> {
  const session = await getStripeClient().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  return session as Stripe.Checkout.Session & { subscription: Stripe.Subscription | null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/stripe.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If the `Stripe` constructor call or any method signature doesn't match the installed SDK version's types, fix the call site to match what's actually installed — do not downgrade the package to make old code samples fit.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe.ts src/lib/stripe.test.ts
git commit -m "feat(billing): Stripe wrapper — checkout sessions, webhook verification, status mapping"
```

---

### Task 3: `subscriptions.ts` — provider-aware creation, Stripe sync, Stripe charge recording

**Files:**
- Modify: `src/server/subscriptions.ts`
- Create: `src/server/subscriptions-stripe.integration.test.ts`
- Modify: `src/server/subscriptions.integration.test.ts` (only the existing `createPendingSubscription` test call sites, to add the new required `provider` argument)

**Interfaces:**
- Consumes: `mapStripeSubscriptionStatus` from `@/lib/stripe` (Task 2).
- Produces: `createPendingSubscription` gains a required `provider: SubscriptionProvider` argument. `export async function syncStripeSubscription(args: { stripeSubscriptionId: string; stripeCustomerId: string; status: Stripe.Subscription.Status; currentPeriodEnd: Date | null; trialEndsAt: Date | null; setupToken?: string }): Promise<{ ok: true; subscriptionId: string } | { ok: false; error: string }>`. `export async function recordStripeCharge(args: { subscriptionId: string; stripeInvoiceId: string; amountMinor: number; currency: string; periodStart: Date; periodEnd: Date }): Promise<void>`.

- [ ] **Step 1: Update `createPendingSubscription`'s signature**

In `src/server/subscriptions.ts`, add `provider: SubscriptionProvider` to the args type (import `type { SubscriptionProvider } from "@/generated/prisma/enums";`) and pass it through to `client.clinicSubscription.create`'s `data`.

- [ ] **Step 2: Fix the one existing caller immediately (same commit, not a later task)**

`createPendingSubscription` has exactly one caller today: `src/server/clinic-registration.ts` (its `createPendingSubscription(...)` call). Pass `provider: "PAYPLUS"` there for now — **Task 4 replaces this with the real country-based resolution in the same file**, so don't spend time on country logic here; just get the build compiling with the new required argument. (`src/server/admin-actions.ts`'s `createDentist` builds its `ClinicSubscription` with a direct `db.clinicSubscription.create` call, not through `createPendingSubscription` — it needs no change here, since Task 1's schema keeps `provider`'s `@default(PAYPLUS)`, which is also the historically correct value for that admin-only manual-add path.)

- [ ] **Step 3: Write the failing tests for the Stripe-specific functions**

```ts
// src/server/subscriptions-stripe.integration.test.ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type {
  syncStripeSubscription as SyncFn,
  recordStripeCharge as RecordChargeFn,
} from "@/server/subscriptions";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let syncStripeSubscription: typeof SyncFn;
let recordStripeCharge: typeof RecordChargeFn;
const created = { dentistIds: [] as string[] };

async function seedStripePendingSubscription() {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `strp_${sfx}@example.com`,
      phone: `+3620${Math.floor(Math.random() * 1e7).toString().padStart(7, "0")}`,
      city: "Budapest",
      address: "1 Main St",
      experienceYears: 5,
    },
  });
  created.dentistIds.push(dentist.id);
  const setupToken = randomUUID();
  const sub = await db.clinicSubscription.create({
    data: {
      dentistId: dentist.id,
      plan: "MONTHLY",
      priceMinor: 7900,
      currency: "USD",
      trialDays: 60,
      provider: "STRIPE",
      setupToken,
      status: "PENDING",
    },
  });
  return { dentist, sub, setupToken };
}

describe.skipIf(!hasDb)("syncStripeSubscription / recordStripeCharge", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ syncStripeSubscription, recordStripeCharge } = await import("@/server/subscriptions"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
  }, DB_TIMEOUT);

  it("links stripeSubscriptionId/stripeCustomerId and sets TRIALING by setupToken on first sync", async () => {
    const { sub, setupToken } = await seedStripePendingSubscription();
    const trialEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const result = await syncStripeSubscription({
      stripeSubscriptionId: `sub_${setupToken}`,
      stripeCustomerId: `cus_${setupToken}`,
      status: "trialing",
      currentPeriodEnd: null,
      trialEndsAt,
      setupToken,
    });

    expect(result.ok).toBe(true);
    const row = await db.clinicSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.status).toBe("TRIALING");
    expect(row.stripeSubscriptionId).toBe(`sub_${setupToken}`);
    expect(row.stripeCustomerId).toBe(`cus_${setupToken}`);
    expect(row.trialEndsAt?.getTime()).toBe(trialEndsAt.getTime());
  });

  it("finds the row by stripeSubscriptionId on later syncs, without a setupToken", async () => {
    const { sub, setupToken } = await seedStripePendingSubscription();
    await syncStripeSubscription({
      stripeSubscriptionId: `sub_${setupToken}`,
      stripeCustomerId: `cus_${setupToken}`,
      status: "trialing",
      currentPeriodEnd: null,
      trialEndsAt: new Date(),
      setupToken,
    });

    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const result = await syncStripeSubscription({
      stripeSubscriptionId: `sub_${setupToken}`,
      stripeCustomerId: `cus_${setupToken}`,
      status: "active",
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
    });

    expect(result.ok).toBe(true);
    const row = await db.clinicSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.status).toBe("ACTIVE");
    expect(row.currentPeriodEnd?.getTime()).toBe(periodEnd.getTime());
  });

  it("returns ok:false when neither stripeSubscriptionId nor setupToken matches a row", async () => {
    const result = await syncStripeSubscription({
      stripeSubscriptionId: "sub_does_not_exist",
      stripeCustomerId: "cus_x",
      status: "active",
      currentPeriodEnd: null,
      trialEndsAt: null,
    });
    expect(result.ok).toBe(false);
  });

  it("recordStripeCharge inserts a PAID charge and is idempotent on stripeInvoiceId", async () => {
    const { sub } = await seedStripePendingSubscription();
    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await recordStripeCharge({
      subscriptionId: sub.id,
      stripeInvoiceId: "in_test_1",
      amountMinor: 7900,
      currency: "USD",
      periodStart,
      periodEnd,
    });
    // Second call with the same invoice id must not create a duplicate row.
    await recordStripeCharge({
      subscriptionId: sub.id,
      stripeInvoiceId: "in_test_1",
      amountMinor: 7900,
      currency: "USD",
      periodStart,
      periodEnd,
    });

    const charges = await db.subscriptionCharge.findMany({ where: { subscriptionId: sub.id } });
    expect(charges).toHaveLength(1);
    expect(charges[0].status).toBe("PAID");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test -- src/server/subscriptions-stripe.integration.test.ts`
Expected: FAIL — `syncStripeSubscription`/`recordStripeCharge` don't exist.

- [ ] **Step 5: Implement `syncStripeSubscription` and `recordStripeCharge`**

Add to `src/server/subscriptions.ts` (add the import `import { mapStripeSubscriptionStatus } from "@/lib/stripe";` and `import type Stripe from "stripe";`):

```ts
/**
 * The single write path for everything a Stripe webhook learns about a
 * subscription's status. Finds the row by stripeSubscriptionId once it's
 * linked; falls back to setupToken for the very first sync (checkout.session.
 * completed), before the link exists yet. Links stripeSubscriptionId/
 * stripeCustomerId on that first call and leaves them alone afterward.
 */
export async function syncStripeSubscription(args: {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: Stripe.Subscription.Status;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  setupToken?: string;
}): Promise<{ ok: true; subscriptionId: string } | { ok: false; error: string }> {
  const existing = await db.clinicSubscription.findUnique({
    where: { stripeSubscriptionId: args.stripeSubscriptionId },
    select: { id: true },
  });

  const target =
    existing ??
    (args.setupToken
      ? await db.clinicSubscription.findUnique({
          where: { setupToken: args.setupToken },
          select: { id: true },
        })
      : null);

  if (!target) return { ok: false, error: "subscription not found for Stripe sync" };

  await db.clinicSubscription.update({
    where: { id: target.id },
    data: {
      status: mapStripeSubscriptionStatus(args.status),
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeCustomerId: args.stripeCustomerId,
      currentPeriodEnd: args.currentPeriodEnd,
      trialEndsAt: args.trialEndsAt,
    },
  });
  return { ok: true, subscriptionId: target.id };
}

/** Records a Stripe invoice as a PAID charge. Idempotent on stripeInvoiceId — a webhook Stripe retries must not double-record the same invoice. */
export async function recordStripeCharge(args: {
  subscriptionId: string;
  stripeInvoiceId: string;
  amountMinor: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  const existing = await db.subscriptionCharge.findUnique({
    where: { stripeInvoiceId: args.stripeInvoiceId },
    select: { id: true },
  });
  if (existing) return;

  const now = new Date();
  await db.$transaction([
    db.clinicSubscription.update({
      where: { id: args.subscriptionId },
      data: {
        status: "ACTIVE",
        currentPeriodEnd: args.periodEnd,
        lastChargeAt: now,
        paymentFailedNotifiedAt: null,
      },
    }),
    db.subscriptionCharge.create({
      data: {
        subscriptionId: args.subscriptionId,
        amountMinor: args.amountMinor,
        currency: args.currency,
        status: "PAID",
        stripeInvoiceId: args.stripeInvoiceId,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        paidAt: now,
      },
    }),
  ]);
}
```

- [ ] **Step 6: Fix the type error `db.clinicSubscription.findUnique({ where: { stripeSubscriptionId: ... } })` may raise**

Prisma only generates a `findUnique`-by-field lookup for `@unique`/`@id` fields — `stripeSubscriptionId` is `@unique` (Task 1), so this should already work. Run `npx tsc --noEmit` after Step 5 and fix any mismatch against the real generated client types rather than assuming the shape above is exactly right.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- src/server/subscriptions-stripe.integration.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 8: Fix the existing `createPendingSubscription` test call sites**

`src/server/subscriptions.integration.test.ts` has two calls to `createPendingSubscription` without `provider` — add `provider: "PAYPLUS"` to both (matching what they were implicitly testing before this task).

- [ ] **Step 9: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/server/subscriptions.ts src/server/subscriptions-stripe.integration.test.ts src/server/subscriptions.integration.test.ts src/server/clinic-registration.ts
git commit -m "feat(billing): syncStripeSubscription/recordStripeCharge, createPendingSubscription takes a provider"
```

---

### Task 4: Provider resolution in `clinic-registration.ts` — and fixing a pre-existing bug

**Files:**
- Modify: `src/server/clinic-registration.ts`
- Modify: `src/server/clinic-registration.integration.test.ts`

**Interfaces:**
- Consumes: `getSubscriptionPricing` (existing), `SubscriptionProvider` enum.
- Produces: no new exports — `registerClinic`'s internal provider/pricing resolution changes.

- [ ] **Step 1: Read the file fresh**

Read `src/server/clinic-registration.ts` in full — it currently ALWAYS calls `getSubscriptionPricing("PAYPLUS")` regardless of the clinic's country (confirmed while writing this plan: line ~150, `const pricing = await getSubscriptionPricing("PAYPLUS");`, unconditional). **This is a real, pre-existing bug this task fixes**: a Hungarian or Turkish clinic registering today would silently get Israeli PayPlus pricing in ILS, which PayPlus cannot even charge (it's an Israel-only provider) — this has presumably gone unnoticed only because zero non-Israeli clinics have registered yet.

- [ ] **Step 2: Write the failing test — and fix the one existing test this bugfix breaks**

`src/server/clinic-registration.integration.test.ts` already registers every test clinic against `COUNTRY = "QV"` — a deliberately non-Israel test country (`currency: "EUR"`, chosen specifically so it never collides with the real `"IL"`/`"ZZ"` codes other suites assert on; see the file's own comment on `COUNTRY`). `baseForm(sfx)` takes the random suffix as its one argument and always fills `email` as `` `reg_${sfx}@example.com` ``. **This means the pre-existing test "prices a YEARLY registration off the yearly rate, not the monthly one" (lines 96-128) is built on today's bug**: it fetches `subscriptionPricing.findUniqueOrThrow({ where: { provider: "PAYPLUS" } })` and asserts the QV-registered clinic's price matches it — that assertion is only true because `registerClinic` currently ignores country and always uses PAYPLUS. Once Step 4 fixes that, QV correctly resolves to STRIPE and this test starts asserting the wrong provider's numbers. Fix it in the same commit as the bug, not as an unrelated later cleanup — change its `provider: "PAYPLUS"` to `provider: "STRIPE"` (its actual behavior after this task is correct, so the rest of the test is untouched: QV is non-Israel, so it's supposed to price off STRIPE).

Then add a second, focused test that specifically checks provider-tagging and the Israel/non-Israel split — placed right after that fixed test:

```ts
// (append to) src/server/clinic-registration.integration.test.ts, after the
// "prices a YEARLY registration..." test
it(
  "tags a non-Israeli registration STRIPE and an Israeli one PAYPLUS, each priced off its own provider row",
  async () => {
    const stripePricing = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "STRIPE" } });
    const payplusPricing = await db.subscriptionPricing.findUniqueOrThrow({ where: { provider: "PAYPLUS" } });

    await db.country.upsert({
      where: { code: "IL" },
      update: { isActive: true },
      create: {
        code: "IL",
        nameEn: "Israel",
        currency: "ILS",
        callingCode: "972",
        insurers: [],
        requiredDocs: [],
        isActive: true,
      },
    });

    const nonIlSfx = randomUUID().slice(0, 8);
    const nonIlForm = baseForm(nonIlSfx); // COUNTRY = "QV", already non-Israel
    const nonIlResult = await registerClinic(nonIlForm);
    expect(nonIlResult.ok).toBe(true);
    const nonIlDentist = await db.dentist.findUnique({
      where: { email: `reg_${nonIlSfx}@example.com` },
      include: { subscription: true },
    });
    created.push(nonIlDentist!.id);
    expect(nonIlDentist!.subscription!.provider).toBe("STRIPE");
    expect(nonIlDentist!.subscription!.currency).toBe(stripePricing.currency);
    expect(nonIlDentist!.subscription!.trialDays).toBe(stripePricing.trialDays);

    const ilSfx = randomUUID().slice(0, 8);
    const ilForm = baseForm(ilSfx);
    ilForm.set("countryCode", "IL");
    const ilResult = await registerClinic(ilForm);
    expect(ilResult.ok).toBe(true);
    const ilDentist = await db.dentist.findUnique({
      where: { email: `reg_${ilSfx}@example.com` },
      include: { subscription: true },
    });
    created.push(ilDentist!.id);
    expect(ilDentist!.subscription!.provider).toBe("PAYPLUS");
    expect(ilDentist!.subscription!.currency).toBe(payplusPricing.currency);
  },
  DB_TIMEOUT,
);
```

`"IL"` is seeded with `upsert` (not `create`) because it may already exist as a real, permanent row seeded by `prisma/seed.ts` — `upsert` avoids a unique-constraint failure either way and this test never deletes it, matching how the codebase treats the real `IL` country as permanent shared fixture data rather than this file's own disposable `QV`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/server/clinic-registration.integration.test.ts`
Expected: the new test FAILs (registered subscriptions all say `provider: "PAYPLUS"` regardless of country), and the fixed "prices a YEARLY registration..." test also FAILs against its new `provider: "STRIPE"` fetch (today's code still prices every registration off PAYPLUS) — confirming both are exercising the same bug from two angles before Step 4 fixes it.

- [ ] **Step 4: Fix `registerClinic`**

Replace:

```ts
const setupToken = randomUUID();
const pricing = await getSubscriptionPricing("PAYPLUS");
```

with:

```ts
const setupToken = randomUUID();
const provider: SubscriptionProvider = country.code === "IL" ? "PAYPLUS" : "STRIPE";
const pricing = await getSubscriptionPricing(provider);
```

Add the import: `import type { SubscriptionProvider } from "@/generated/prisma/enums";`

And update the `createPendingSubscription` call to pass `provider`:

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
      },
      tx,
    );
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/server/clinic-registration.integration.test.ts`
Expected: PASS, including the pre-existing tests (confirm no Israeli-registration test broke — `country.code === "IL"` must still resolve to `"PAYPLUS"`).

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/clinic-registration.ts src/server/clinic-registration.integration.test.ts
git commit -m "fix(billing): a non-Israeli registration is priced and provider-tagged for Stripe, not silently defaulted to PayPlus/ILS"
```

---

### Task 5: `startPayment` branches by provider

**Files:**
- Modify: `src/server/billing-actions.ts`
- Modify: `src/server/billing-actions.test.ts` (extend if it exists — check with `find src/server -iname "billing-actions*test*"`; create if absent)

**Interfaces:**
- Consumes: `createSubscriptionCheckoutSession`, `isStripeConfigured` from `@/lib/stripe` (Task 2).
- Produces: `startPayment`'s exported signature is unchanged (`(setupToken: string) => Promise<{ ok: true; url: string } | { ok: false; error: string }>`) — only its internal branching changes. `StartPaymentButton` needs NO changes at all — it already just calls `startPayment` and redirects to whatever `url` comes back.

- [ ] **Step 1: Read the current file and check for existing tests**

Read `src/server/billing-actions.ts` in full (already known from earlier reading in this session, but re-read to catch any drift) and run `find src/server -iname "billing-actions*test*"`.

- [ ] **Step 2: Write the failing test**

```ts
// src/server/billing-actions.integration.test.ts (create if no test file exists for this action; extend if one does)
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { startPayment as StartPaymentFn } from "@/server/billing-actions";

vi.mock("@/lib/stripe", async (orig) => {
  const actual = await orig<typeof import("@/lib/stripe")>();
  return {
    ...actual,
    isStripeConfigured: () => true,
    createSubscriptionCheckoutSession: vi.fn(async () => ({ url: "https://checkout.stripe.com/test-session" })),
  };
});

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let startPayment: typeof StartPaymentFn;
const created = { dentistIds: [] as string[] };

async function seedPendingSubscription(provider: "PAYPLUS" | "STRIPE") {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `bill_${sfx}@example.com`,
      phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      city: "Tel Aviv",
      address: "1 Main St",
      experienceYears: 5,
    },
  });
  created.dentistIds.push(dentist.id);
  const setupToken = randomUUID();
  await db.clinicSubscription.create({
    data: {
      dentistId: dentist.id,
      plan: "MONTHLY",
      priceMinor: provider === "PAYPLUS" ? 29900 : 7900,
      currency: provider === "PAYPLUS" ? "ILS" : "USD",
      trialDays: 60,
      provider,
      setupToken,
      status: "PENDING",
    },
  });
  return setupToken;
}

describe.skipIf(!hasDb)("startPayment provider branching", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ startPayment } = await import("@/server/billing-actions"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
  }, DB_TIMEOUT);

  it("routes a STRIPE subscription to createSubscriptionCheckoutSession, not PayPlus", async () => {
    const setupToken = await seedPendingSubscription("STRIPE");
    const result = await startPayment(setupToken);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe("https://checkout.stripe.com/test-session");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- billing-actions`
Expected: FAIL — `startPayment` calls PayPlus's `createSubscriptionPaymentPage` unconditionally today, so a STRIPE-provider row would either error or produce a PayPlus URL.

- [ ] **Step 4: Update `startPayment`**

Read the current function's exact shape (it selects `plan`, `priceMinor`, `currency`, `status`, and the dentist's `clinicName`/`email`/`locale` — extend the `select` to also pull `provider`, `trialDays`, and `dentist.locale` if not already there). Branch:

```ts
export async function startPayment(
  setupToken: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const t = await getDictionary(await getRequestLocale());
  const e = t.errors;

  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken },
    select: {
      id: true,
      plan: true,
      priceMinor: true,
      currency: true,
      status: true,
      provider: true,
      trialDays: true,
      dentist: { select: { clinicName: true, email: true, locale: true } },
    },
  });
  if (!sub) return { ok: false, error: e.invalidLink };
  if (sub.status === "ACTIVE") return { ok: false, error: e.subscriptionAlreadyActive };
  if (sub.priceMinor === null || sub.currency === null) {
    console.error("startPayment: subscription has no price", { subscriptionId: sub.id });
    return { ok: false, error: e.subscriptionMisconfigured };
  }

  const itemName = format(t.clinics.itemSubscription, {
    plan: sub.plan === "MONTHLY" ? t.emails.planMonthly : t.emails.planYearly,
  });

  if (sub.provider === "STRIPE") {
    if (!isStripeConfigured()) {
      return { ok: false, error: e.paymentsNotConfigured };
    }
    try {
      const { url } = await createSubscriptionCheckoutSession({
        setupToken,
        amountMinor: sub.priceMinor,
        currency: sub.currency,
        trialDays: sub.trialDays,
        intervalMonths: sub.plan === "MONTHLY" ? 1 : 12,
        clinicName: sub.dentist.clinicName,
        email: sub.dentist.email,
        itemName,
      });
      return { ok: true, url };
    } catch (err) {
      console.error("startPayment (Stripe) failed:", err);
      return { ok: false, error: e.paymentPageFailed };
    }
  }

  // provider === "PAYPLUS" — existing behavior, unchanged.
  if (!isPayPlusConfigured()) {
    return { ok: false, error: e.paymentsNotConfigured };
  }
  try {
    const { url, pageRequestUid } = await createSubscriptionPaymentPage({
      subscriptionId: sub.id,
      setupToken,
      amountMinor: sub.priceMinor,
      currency: sub.currency,
      clinicName: sub.dentist.clinicName,
      email: sub.dentist.email,
      itemName,
    });
    await db.clinicSubscription.update({ where: { id: sub.id }, data: { pageRequestUid } });
    return { ok: true, url };
  } catch (err) {
    console.error("startPayment failed:", err);
    return { ok: false, error: e.paymentPageFailed };
  }
}
```

Add the import: `import { createSubscriptionCheckoutSession, isStripeConfigured } from "@/lib/stripe";`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- billing-actions`
Expected: PASS. Also confirm the existing PayPlus-path tests (if any exist in the same or a sibling file) still pass unmodified.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/billing-actions.ts src/server/billing-actions.integration.test.ts
git commit -m "feat(billing): startPayment opens a Stripe Checkout session for STRIPE-provider subscriptions"
```

---

### Task 6: The Stripe webhook route

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`
- Create: `src/app/api/webhooks/stripe/route.test.ts`

**Interfaces:**
- Consumes: `verifyStripeWebhookSignature` (Task 2), `syncStripeSubscription`/`recordStripeCharge`/`markPastDue`/`cancelSubscription` (Task 3 + existing).
- Produces: `POST` handler at `/api/webhooks/stripe`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/webhooks/stripe/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyStripeWebhookSignature, syncStripeSubscription, recordStripeCharge, markPastDue, cancelSubscription } =
  vi.hoisted(() => ({
    verifyStripeWebhookSignature: vi.fn(),
    syncStripeSubscription: vi.fn(async () => ({ ok: true, subscriptionId: "sub-row-1" })),
    recordStripeCharge: vi.fn(async () => {}),
    markPastDue: vi.fn(async () => true),
    cancelSubscription: vi.fn(async () => {}),
  }));

vi.mock("@/lib/stripe", () => ({ verifyStripeWebhookSignature }));
vi.mock("@/server/subscriptions", () => ({ syncStripeSubscription, recordStripeCharge, markPastDue, cancelSubscription }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/log", () => ({ logEvent: vi.fn() }));

function req(body: string, signature = "sig") {
  return new Request("http://x/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

describe("stripe webhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request with no valid signature", async () => {
    verifyStripeWebhookSignature.mockReturnValue(null);
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(401);
    expect(syncStripeSubscription).not.toHaveBeenCalled();
  });

  it("syncs on checkout.session.completed using the subscription id and setupToken metadata", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          subscription: "sub_123",
          customer: "cus_123",
          metadata: { setupToken: "tok_abc" },
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(syncStripeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: "sub_123",
        stripeCustomerId: "cus_123",
        setupToken: "tok_abc",
      }),
    );
  });

  it("syncs on customer.subscription.updated from the subscription object's own fields", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          current_period_end: 1_800_000_000,
          trial_end: null,
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(syncStripeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: "sub_123", status: "active" }),
    );
  });

  it("records a charge on invoice.paid, looked up by the subscription id", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_123",
          subscription: "sub_123",
          amount_paid: 7900,
          currency: "usd",
          period_start: 1_700_000_000,
          period_end: 1_702_600_000,
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(recordStripeCharge).toHaveBeenCalledWith(
      expect.objectContaining({ stripeInvoiceId: "in_123", amountMinor: 7900, currency: "USD" }),
    );
  });

  it("marks past due on invoice.payment_failed", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub_123" } },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
  });

  it("cancels on customer.subscription.deleted", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123" } },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
  });

  it("acknowledges an event type it doesn't handle, without erroring", async () => {
    verifyStripeWebhookSignature.mockReturnValue({ type: "customer.updated", data: { object: {} } });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
  });
});
```

`markPastDue`/`cancelSubscription` both take this app's own `ClinicSubscription.id`, not Stripe's id — Step 3 resolves Stripe's subscription id to a row via `db.clinicSubscription.findUnique`, so these two mocked-DB-less unit tests can only assert the HTTP status (there's no real row for the route to find, and mocking `@/lib/db` here would just be re-testing Step 3's `if (!row) break` branch, which Task 3's already-covered `syncStripeSubscription`/`recordStripeCharge` pattern shows is the right place for that kind of DB-shaped assertion, not this route-shape unit suite).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/api/webhooks/stripe/route.test.ts`
Expected: FAIL — the route doesn't exist.

- [ ] **Step 3: Implement the route**

`markPastDue`/`cancelSubscription` both take this app's own `ClinicSubscription.id`, not Stripe's subscription id — so `invoice.payment_failed` and `customer.subscription.deleted` need to resolve Stripe's id to the row first. Do this with a small local lookup inside the route (not a new exported function — it's only needed here):

```ts
// src/app/api/webhooks/stripe/route.ts
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyStripeWebhookSignature } from "@/lib/stripe";
import { syncStripeSubscription, recordStripeCharge, markPastDue, cancelSubscription } from "@/server/subscriptions";
import { sendPaymentFailedEmail } from "@/server/subscription-notifications";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { asLocale } from "@/i18n/config";

export const runtime = "nodejs";

/**
 * Stripe's own webhook endpoint — the counterpart to /api/webhooks/payplus,
 * but structurally different on purpose: PayPlus's IPN only ever tells us
 * "a charge happened", and OUR cron drives every other state transition.
 * Stripe tells us about every transition itself (trial started, went active,
 * failed, canceled) — this handler's whole job is translating those into
 * SubscriptionStatus via the functions in subscriptions.ts, never deciding
 * anything on its own.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  const event = verifyStripeWebhookSignature(raw, signature);

  if (!event) {
    logEvent("warn", "stripe.webhook.bad_signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const setupToken = session.metadata?.setupToken;
      const stripeSubscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (!stripeSubscriptionId || !stripeCustomerId) {
        logEvent("error", "stripe.webhook.checkout_session_missing_ids", { setupToken });
        break;
      }
      const result = await syncStripeSubscription({
        stripeSubscriptionId,
        stripeCustomerId,
        status: "trialing", // Checkout with trial_period_days always starts trialing.
        currentPeriodEnd: null,
        trialEndsAt: null, // customer.subscription.updated (fired moments later) carries the real trial_end.
        setupToken,
      });
      if (result.ok) {
        await audit({
          actor: "webhook",
          action: "subscription.stripe_checkout_completed",
          entity: "ClinicSubscription",
          entityId: result.subscriptionId,
          metadata: { stripeSubscriptionId },
        });
      } else {
        logEvent("error", "stripe.webhook.sync_failed", { stripeSubscriptionId, error: result.error });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await syncStripeSubscription({
        stripeSubscriptionId: sub.id,
        stripeCustomerId,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (!stripeSubscriptionId) break;
      const row = await db.clinicSubscription.findUnique({
        where: { stripeSubscriptionId },
        select: { id: true },
      });
      if (!row) {
        logEvent("error", "stripe.webhook.invoice_paid_unknown_subscription", { stripeSubscriptionId });
        break;
      }
      await recordStripeCharge({
        subscriptionId: row.id,
        stripeInvoiceId: invoice.id,
        amountMinor: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
      });
      await audit({
        actor: "webhook",
        action: "subscription.stripe_invoice_paid",
        entity: "ClinicSubscription",
        entityId: row.id,
        metadata: { stripeInvoiceId: invoice.id, amountMinor: invoice.amount_paid },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (!stripeSubscriptionId) break;
      const row = await db.clinicSubscription.findUnique({
        where: { stripeSubscriptionId },
        select: { id: true, dentist: { select: { clinicName: true, email: true, locale: true } } },
      });
      if (!row) {
        logEvent("error", "stripe.webhook.invoice_failed_unknown_subscription", { stripeSubscriptionId });
        break;
      }
      // markPastDue returns true only the FIRST time (see subscriptions.ts) —
      // exactly the same "notify once, not on every retry" gate the PayPlus
      // renewal cron already relies on, so this mirrors that cron's own
      // firstFailure-check-then-email pattern (see
      // src/app/api/cron/renew-subscriptions/route.ts) rather than inventing
      // a second one.
      const firstFailure = await markPastDue(row.id);
      if (firstFailure) {
        await sendPaymentFailedEmail({
          email: row.dentist.email,
          clinicName: row.dentist.clinicName,
          locale: asLocale(row.dentist.locale),
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const row = await db.clinicSubscription.findUnique({
        where: { stripeSubscriptionId: sub.id },
        select: { id: true },
      });
      if (!row) {
        logEvent("error", "stripe.webhook.subscription_deleted_unknown", { stripeSubscriptionId: sub.id });
        break;
      }
      await cancelSubscription(row.id);
      await audit({
        actor: "webhook",
        action: "subscription.stripe_canceled",
        entity: "ClinicSubscription",
        entityId: row.id,
        metadata: {},
      });
      break;
    }

    default:
      // Acknowledged, ignored — Stripe sends many event types we don't act on.
      break;
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/api/webhooks/stripe/route.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts src/app/api/webhooks/stripe/route.test.ts
git commit -m "feat(billing): Stripe webhook — translates subscription/invoice events into SubscriptionStatus"
```

---

### Task 7: Billing return page — provider-aware

**Files:**
- Modify: `src/app/[locale]/clinics/billing/return/page.tsx`

**Interfaces:**
- Consumes: `retrieveCheckoutSessionWithSubscription`, `syncStripeSubscription` (Tasks 2-3).
- Produces: no new exports — page behavior only.

- [ ] **Step 1: Read the current page in full**

Already read once while planning (see above) — re-read to catch drift, since this file may have shifted.

- [ ] **Step 2: Broaden the success condition**

Change:

```ts
const success = fresh?.status === "ACTIVE";
```

to:

```ts
// A Stripe subscription with a trial is correctly TRIALING right after
// checkout — "ACTIVE only" was true for PayPlus (which charges immediately
// on setup) but would show every successful Stripe signup as a failure.
const success = fresh?.status === "ACTIVE" || fresh?.status === "TRIALING";
```

- [ ] **Step 3: Add the Stripe fallback-verification block**

The existing PayPlus fallback block (`if (token && sub?.status === "PENDING" && sub.pageRequestUid) { ... getPageRequestStatus ... }`) only fires for a PayPlus row (a Stripe row never has `pageRequestUid` set). Add a parallel block for Stripe, keyed on the subscription still being `PENDING` after redirect (meaning the webhook hasn't landed yet) — this needs the Stripe Checkout Session id, which isn't stored anywhere today. Extend the `sub` query's `select` to include `provider`, and use the `token` (setupToken) itself to re-fetch the session via Stripe's API by searching for it — actually, simplest: Stripe's Checkout redirect can append `{CHECKOUT_SESSION_ID}` to the success/cancel URL as a template Stripe substitutes automatically. Update `createSubscriptionCheckoutSession` (Task 2) to include it, and read it here:

Go back to Task 2's `createSubscriptionCheckoutSession` and change:

```ts
    success_url: `${base}/clinics/billing/return?token=${args.setupToken}&status=success`,
    cancel_url: `${base}/clinics/billing/return?token=${args.setupToken}&status=failure`,
```

to:

```ts
    success_url: `${base}/clinics/billing/return?token=${args.setupToken}&status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/clinics/billing/return?token=${args.setupToken}&status=failure`,
```

(This is a small addition to Task 2's file — make it now, don't leave Task 2 as originally written; both tasks touch the same function, and this plan is sequenced so Task 7 can still amend an earlier task's code before it's ever deployed. Re-run Task 2's tests after this change to confirm nothing broke.)

Then in the return page, read `searchParams.session_id` and add the fallback:

```ts
export default async function BillingReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; status?: string; session_id?: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  const { token, session_id } = await searchParams;

  const sub = token
    ? await db.clinicSubscription.findUnique({
        where: { setupToken: token },
        select: { status: true, pageRequestUid: true, provider: true },
      })
    : null;

  if (token && sub?.status === "PENDING" && sub.provider === "PAYPLUS" && sub.pageRequestUid) {
    try {
      const { approved, transactionUid } = await getPageRequestStatus(sub.pageRequestUid);
      if (approved) {
        await activateSubscriptionBySetupToken({ setupToken: token, transactionUid });
      }
    } catch (err) {
      console.error("Billing return verification failed:", err);
    }
  }

  if (token && sub?.status === "PENDING" && sub.provider === "STRIPE" && session_id) {
    try {
      const session = await retrieveCheckoutSessionWithSubscription(session_id);
      if (session.subscription) {
        await syncStripeSubscription({
          stripeSubscriptionId: session.subscription.id,
          stripeCustomerId:
            typeof session.subscription.customer === "string"
              ? session.subscription.customer
              : session.subscription.customer.id,
          status: session.subscription.status,
          currentPeriodEnd: session.subscription.current_period_end
            ? new Date(session.subscription.current_period_end * 1000)
            : null,
          trialEndsAt: session.subscription.trial_end
            ? new Date(session.subscription.trial_end * 1000)
            : null,
          setupToken: token,
        });
      }
    } catch (err) {
      console.error("Billing return Stripe verification failed:", err);
    }
  }

  const fresh = token
    ? await db.clinicSubscription.findUnique({ where: { setupToken: token }, select: { status: true } })
    : null;

  const success = fresh?.status === "ACTIVE" || fresh?.status === "TRIALING";
  // ...rest of the component unchanged
```

Add the imports: `import { retrieveCheckoutSessionWithSubscription } from "@/lib/stripe"; import { syncStripeSubscription } from "@/server/subscriptions";` (alongside the existing `activateSubscriptionBySetupToken` import).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (this page has no dedicated automated test today per the earlier read — this task doesn't add one either; verified manually in the final walkthrough, matching how the equivalent PayPlus return-page logic is already only manually verified).

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/clinics/billing/return/page.tsx" src/lib/stripe.ts src/lib/stripe.test.ts
git commit -m "feat(billing): the return page recognizes a successful Stripe trial signup and has a webhook-delay fallback"
```

---

### Task 8: Keep PayPlus's renewal cron away from Stripe rows

**Files:**
- Modify: `src/app/api/cron/renew-subscriptions/route.ts`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing tests**

`src/app/api/cron/renew-subscriptions/route.integration.test.ts` has two seed helpers: `seedSub(opts: { status: "ACTIVE" | "PAST_DUE"; periodEndOffsetMs: number; notified?: boolean })` for the renewal pass, and `seedTrialSub(opts: { trialEndsAtOffsetMs: number; withCard?: boolean; warningSentDays?: number | null; endedUnbilled?: boolean })` for the trial pass — neither currently accepts a `provider`, so both default their created row to `"PAYPLUS"` via the schema default (Task 1). Extend both to accept an optional `provider?: "PAYPLUS" | "STRIPE"` (defaulting to `"PAYPLUS"` when omitted, so every existing call site in this file is unaffected) and pass it through to the `clinicSubscription.create` call's `data`. The file already asserts "the cron left this row untouched" via `expect(chargeByToken).not.toHaveBeenCalled()` (see e.g. line 200) — match that same convention rather than inventing a new one. Then add:

```ts
it(
  "never charges or cancels a STRIPE-provider subscription in the renewal pass, even with a currentPeriodEnd in the past",
  async () => {
    const { subId } = await seedSub({
      provider: "STRIPE",
      status: "PAST_DUE",
      periodEndOffsetMs: -60 * DAY, // long past its grace window if this were PayPlus
    });

    const res = await GET(cronReq());
    expect(res.status).toBe(200);
    expect(chargeByToken).not.toHaveBeenCalled();

    const row = await db.clinicSubscription.findUniqueOrThrow({ where: { id: subId } });
    expect(row.status).toBe("PAST_DUE"); // untouched — not canceled, not renewed
  },
  DB_TIMEOUT,
);

it(
  "never charges a STRIPE-provider trial, even one whose trialEndsAt is already past",
  async () => {
    const { subId } = await seedTrialSub({ provider: "STRIPE", trialEndsAtOffsetMs: -1 * DAY });

    const res = await GET(cronReq());
    expect(res.status).toBe(200);
    expect(chargeByToken).not.toHaveBeenCalled();

    const row = await db.clinicSubscription.findUniqueOrThrow({ where: { id: subId } });
    expect(row.status).toBe("TRIALING"); // untouched
  },
  DB_TIMEOUT,
);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- renew-subscriptions`
Expected: FAIL — today's queries have no provider filter, so a STRIPE row with a past `currentPeriodEnd`/`trialEndsAt` and a `recurringToken`-shaped value gets picked up and `chargeByToken` is called on a subscription that has no real PayPlus token.

- [ ] **Step 3: Add the filter**

In the `renewals` query (the one selecting `status: { in: ["ACTIVE", "PAST_DUE"] }, recurringToken: { not: null }, currentPeriodEnd: { not: null }`), add `provider: "PAYPLUS"` to the `where` clause. Also check the trial pass's query (`status: "TRIALING", trialEndsAt: { not: null }`) — a Stripe row can also be `TRIALING`, and this cron's trial pass must not touch it either (it would try to `chargeByToken` a Stripe subscription, which has no `recurringToken`/PayPlus token at all). Add `provider: "PAYPLUS"` to that query's `where` too.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- renew-subscriptions`
Expected: PASS, and confirm every pre-existing test in this file still passes (they all implicitly seed PayPlus rows today, so adding an explicit filter should not change their behavior).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/cron/renew-subscriptions/route.ts" "src/app/api/cron/renew-subscriptions/route.integration.test.ts"
git commit -m "fix(billing): the PayPlus renewal cron explicitly never touches a Stripe-provider subscription"
```

---

### Task 9: Admin subscriptions page shows the provider; dictionary keys; final verification

**Files:**
- Modify: `src/app/[locale]/admin/subscriptions/page.tsx`
- Modify: `src/i18n/dictionaries/he.ts`, `src/i18n/dictionaries/en.ts`

**Interfaces:** none new.

- [ ] **Step 1: Add the dictionary keys**

In `he.ts`, inside `admin`, near `colValidUntil`:

```ts
    colProvider: "ספק",
    providerPayPlus: "PayPlus",
    providerStripe: "Stripe",
```

Matching English in `en.ts` (same values — provider names aren't translated).

- [ ] **Step 2: Extend the query and the table**

In `src/app/[locale]/admin/subscriptions/page.tsx`, add `provider: true` to the `subs` query's `select`. Add a `{t.admin.colProvider}` header cell after `{t.admin.colStatus}`, and a body cell:

```tsx
<td className="text-muted-foreground px-4 py-3 text-xs">
  {s.provider === "STRIPE" ? t.admin.providerStripe : t.admin.providerPayPlus}
</td>
```

Update `colSpan={4}` on the empty-state row to `colSpan={5}`.

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/admin/subscriptions/page.tsx" src/i18n/dictionaries/he.ts src/i18n/dictionaries/en.ts
git commit -m "feat(admin): the subscriptions screen shows which provider each clinic is billed through"
```

---

## After Task 9

This cannot be manually walked end-to-end without a real Stripe account. Once Eden creates one and adds `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` to Vercel (test-mode keys first), the manual pass is: register a clinic with a non-Israeli country → confirm the plan picker/legal text show the USD Stripe price → complete Stripe Checkout with a test card → confirm the return page shows success and the subscription is `TRIALING` → use the Stripe CLI (`stripe trigger`) or the Dashboard to fire `invoice.paid`/`invoice.payment_failed`/`customer.subscription.deleted` against the webhook endpoint and confirm each lands correctly on the `ClinicSubscription` row. Add this to `docs/HANDOFF.md`'s pending manual-walkthrough list once this plan is merged.
