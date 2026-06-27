# Clinic Subscription Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let dental clinics pay a recurring subscription (₪299/month or ₪1,990/year) via PayPlus to be listed in the patient-facing directory; a clinic appears only while it is both admin-approved AND has an active paid subscription.

**Architecture:** Clinics register (details + logo + plan choice, no card yet) → admin approves → clinic gets an emailed payment-setup link → on a PayPlus hosted payment page they pay the first period and their card is tokenized → subscription becomes ACTIVE and the clinic goes live. A daily Vercel Cron charges the stored token before each period ends, extending the period on success or moving the subscription to PAST_DUE (and hiding the clinic) on failure. All PayPlus HTTP specifics are encapsulated in `src/lib/payplus.ts`; the rest of the app talks to typed functions only.

**Tech Stack:** Next.js 16 (App Router, server actions, route handlers), Prisma 7 + PostgreSQL (Neon), Vercel Blob (logos, already wired), Resend (email, already wired), PayPlus REST API (new), Vercel Cron (new), Vitest (new — pure-logic unit tests only).

## Global Constraints

- Next.js **16.2.9**, React **19.2.4**, Prisma **7.8.0** — do not change these versions.
- Prisma client is generated to `src/generated/prisma` (custom output). Import models from `@/generated/prisma/models` and the db client from `@/lib/db`.
- All user-facing copy is **Hebrew, RTL**. Currency is **ILS (₪)**, integers (no agorot in display).
- Subscription prices are exactly **₪299/month** and **₪1,990/year**. Define once in `src/lib/constants.ts`; never hard-code elsewhere.
- Server-only modules start with `import "server-only";`. Server actions files start with `"use server";`.
- **No card data ever touches our servers or DB** — only PayPlus tokens/UIDs are stored. PayPlus secrets live in env vars, server-side only.
- Every task must end with `npm run build` passing (TypeScript clean). Pure-logic tasks also run `npm run test`.
- Follow existing patterns: result type `{ ok: true } | { ok: false; error: string }` for server actions; best-effort emails that never throw into the main flow (see `src/server/clinic-notifications.ts`).
- The existing patient `Payment` model and `RequestStatus` enum reuse `PENDING/PAID/FAILED`. Reuse `RequestStatus` for charge status to match the established codebase convention.

---

## File Structure

**New files:**
- `src/lib/payplus.ts` — PayPlus REST client: create payment page, charge by token, verify webhook. The only file that knows PayPlus HTTP details.
- `src/lib/subscription.ts` — pure helpers: plan lookup, price, next period end, "is due for renewal", visibility predicate. Fully unit-tested.
- `src/server/subscriptions.ts` — server actions / server functions that mutate `ClinicSubscription` (create, activate, record charge, mark past-due, cancel).
- `src/server/subscription-notifications.ts` — Resend emails: payment-setup link, payment-failed, canceled.
- `src/app/clinics/billing/[token]/page.tsx` — clinic-facing page reached from the setup-link email; starts the PayPlus payment page.
- `src/app/clinics/billing/[token]/start/route.ts` — *(folded into the page via a server action instead; see Task 6)*.
- `src/app/clinics/billing/return/page.tsx` — landing page after PayPlus redirect; shows status.
- `src/app/api/webhooks/payplus/route.ts` — PayPlus IPN webhook → activates/records charges.
- `src/app/api/cron/renew-subscriptions/route.ts` — daily renewal job (Vercel Cron).
- `src/app/admin/subscriptions/page.tsx` — admin list of clinic subscriptions.
- `src/components/clinics/plan-picker.tsx` — client component: monthly/yearly radio cards used in the intake form.
- `vitest.config.ts`, `src/lib/subscription.test.ts`, `src/lib/payplus.test.ts` — test harness + pure-logic tests.

**Modified files:**
- `prisma/schema.prisma` — enums + `ClinicSubscription` + `SubscriptionCharge` + `Dentist.subscription` relation.
- `src/lib/constants.ts` — `SUBSCRIPTION_PLANS`, new contract copy/version.
- `src/components/clinics/registration-form.tsx` — add plan picker, swap commission copy → subscription copy.
- `src/server/clinic-registration.ts` — create `ClinicSubscription` (PENDING) with the chosen plan.
- `src/server/admin-actions.ts` — `approveClinic` generates a setup token and sends the payment-setup email (no longer implies "live").
- `src/server/clinic-notifications.ts` — approval email mentions "complete payment to go live" (or move to the new notifications file).
- `src/app/dentists/page.tsx` and `src/app/api/dentists/route.ts` — directory visibility gated on active subscription.
- `src/app/admin/layout.tsx` — add "מנויים" nav item.
- `package.json` — add `test` script + Vitest dev deps.
- `vercel.json` (create if absent) — cron schedule.
- `.env.example` — PayPlus + cron env vars.

---

## Task 1: Subscription constants + pure helpers (with Vitest harness)

**Files:**
- Modify: `src/lib/constants.ts`
- Create: `src/lib/subscription.ts`
- Create: `vitest.config.ts`
- Create: `src/lib/subscription.test.ts`
- Modify: `package.json` (scripts + devDeps)

**Interfaces:**
- Produces:
  - `SUBSCRIPTION_PLANS: Record<"MONTHLY" | "YEARLY", { priceILS: number; intervalMonths: number; labelHe: string }>`
  - `SUBSCRIPTION_CONTRACT_VERSION: string`
  - `SUBSCRIPTION_TERMS_HE: string[]`
  - `RENEWAL_LEAD_DAYS: number`, `PAST_DUE_GRACE_DAYS: number`
  - `planPriceILS(plan): number`
  - `addMonths(date: Date, months: number): Date`
  - `nextPeriodEnd(from: Date, plan): Date`
  - `isDueForRenewal(currentPeriodEnd: Date, now: Date): boolean`
  - `isClinicVisible(sub: { status: string } | null): boolean`

- [ ] **Step 1: Add Vitest dev dependencies**

Run:
```bash
cd "app" && npm install -D vitest@^2
```
Expected: `vitest` added under devDependencies; no peer-dep errors that fail install.

- [ ] **Step 2: Add the `test` script**

In `package.json` `"scripts"`, add after `"format:check"`:
```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 4: Add subscription constants to `src/lib/constants.ts`**

Append to the end of the file:
```ts
// --- Clinic subscription billing ---

export const SUBSCRIPTION_PLANS = {
  MONTHLY: { priceILS: 299, intervalMonths: 1, labelHe: "חודשי" },
  YEARLY: { priceILS: 1990, intervalMonths: 12, labelHe: "שנתי" },
} as const;

export type SubscriptionPlanType = keyof typeof SUBSCRIPTION_PLANS;

// Charge this many days before currentPeriodEnd; allow this many days of grace
// after a failed charge before the clinic is treated as lapsed.
export const RENEWAL_LEAD_DAYS = 1;
export const PAST_DUE_GRACE_DAYS = 3;

export const SUBSCRIPTION_CONTRACT_VERSION = "2026-06-sub-v1";

export const SUBSCRIPTION_TERMS_HE: string[] = [
  `המרפאה בוחרת מסלול מנוי: ${SUBSCRIPTION_PLANS.MONTHLY.priceILS} ₪ לחודש או ${SUBSCRIPTION_PLANS.YEARLY.priceILS} ₪ לשנה, עבור הופעה במאגר DentalCompare וקבלת פניות ממטופלים.`,
  "החיוב הראשון מתבצע לאחר אישור המרפאה על ידי צוות DentalCompare. כל עוד לא הושלם תשלום, המרפאה אינה מופיעה במאגר.",
  "המנוי מתחדש אוטומטית בתום כל תקופה באמצעי התשלום שנשמר, עד לביטול על ידי המרפאה.",
  "ניתן לבטל את המנוי בכל עת; הביטול ייכנס לתוקף בתום התקופה ששולמה. לא יינתן החזר יחסי.",
  "המרפאה מצהירה כי הפרטים שמסרה נכונים וכי היא בעלת הרישוי הנדרש לעיסוק ברפואת שיניים בישראל. DentalCompare רשאית להסיר את המרפאה מהמאגר בכל עת.",
];
```

- [ ] **Step 5: Write the failing test for the pure helpers**

Create `src/lib/subscription.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  planPriceILS,
  addMonths,
  nextPeriodEnd,
  isDueForRenewal,
  isClinicVisible,
} from "./subscription";

describe("subscription helpers", () => {
  it("returns the configured price per plan", () => {
    expect(planPriceILS("MONTHLY")).toBe(299);
    expect(planPriceILS("YEARLY")).toBe(1990);
  });

  it("adds months and clamps end-of-month overflow", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
    expect(addMonths(new Date("2026-03-15T00:00:00Z"), 12).toISOString()).toBe(
      "2027-03-15T00:00:00.000Z",
    );
  });

  it("computes next period end from plan interval", () => {
    const from = new Date("2026-06-01T00:00:00Z");
    expect(nextPeriodEnd(from, "MONTHLY").toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(nextPeriodEnd(from, "YEARLY").toISOString()).toBe("2027-06-01T00:00:00.000Z");
  });

  it("is due for renewal within the lead window, not before", () => {
    const end = new Date("2026-06-10T00:00:00Z");
    expect(isDueForRenewal(end, new Date("2026-06-09T12:00:00Z"))).toBe(true); // within 1 day
    expect(isDueForRenewal(end, new Date("2026-06-08T00:00:00Z"))).toBe(false); // 2 days out
    expect(isDueForRenewal(end, new Date("2026-06-11T00:00:00Z"))).toBe(true); // already past
  });

  it("only treats ACTIVE subscriptions as visible", () => {
    expect(isClinicVisible({ status: "ACTIVE" })).toBe(true);
    expect(isClinicVisible({ status: "PAST_DUE" })).toBe(false);
    expect(isClinicVisible({ status: "PENDING" })).toBe(false);
    expect(isClinicVisible(null)).toBe(false);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd "app" && npm run test`
Expected: FAIL — `Cannot find module './subscription'` (file not created yet).

- [ ] **Step 7: Implement `src/lib/subscription.ts`**

```ts
import { SUBSCRIPTION_PLANS, RENEWAL_LEAD_DAYS, type SubscriptionPlanType } from "./constants";

export function planPriceILS(plan: SubscriptionPlanType): number {
  return SUBSCRIPTION_PLANS[plan].priceILS;
}

/** Adds whole months, clamping to the last valid day (Jan 31 + 1mo -> Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getUTCMonth() + months;
  const result = new Date(
    Date.UTC(d.getUTCFullYear(), targetMonth, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()),
  );
  // If the day rolled over (e.g. Feb 31 -> Mar 3), clamp back to end of target month.
  if (result.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setUTCDate(0);
  }
  return result;
}

export function nextPeriodEnd(from: Date, plan: SubscriptionPlanType): Date {
  return addMonths(from, SUBSCRIPTION_PLANS[plan].intervalMonths);
}

export function isDueForRenewal(currentPeriodEnd: Date, now: Date): boolean {
  const leadMs = RENEWAL_LEAD_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() >= currentPeriodEnd.getTime() - leadMs;
}

export function isClinicVisible(sub: { status: string } | null): boolean {
  return sub?.status === "ACTIVE";
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd "app" && npm run test`
Expected: PASS — all 5 tests green.

- [ ] **Step 9: Build to confirm types**

Run: `cd "app" && npm run build`
Expected: Compiled successfully; TypeScript finished with no errors.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/constants.ts src/lib/subscription.ts src/lib/subscription.test.ts
git commit -m "feat(subscriptions): plan constants + tested billing-period helpers"
```

---

## Task 2: Prisma schema — subscription models

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_clinic_subscriptions/migration.sql` (generated)

**Interfaces:**
- Produces Prisma models consumed everywhere below:
  - `enum SubscriptionPlan { MONTHLY YEARLY }`
  - `enum SubscriptionStatus { PENDING ACTIVE PAST_DUE CANCELED }`
  - `ClinicSubscription { id, dentistId(unique), plan, status, priceILS, setupToken(unique), recurringToken?, payplusCustomerUid?, currentPeriodEnd?, lastChargeAt?, canceledAt?, createdAt, updatedAt }`
  - `SubscriptionCharge { id, subscriptionId, amountILS, status(RequestStatus), payplusTransactionUid?(unique), periodStart, periodEnd, paidAt?, createdAt }`
  - `Dentist.subscription ClinicSubscription?`

- [ ] **Step 1: Add enums and models to `prisma/schema.prisma`**

After the existing `enum RequestStatus { ... }` block, add:
```prisma
enum SubscriptionPlan {
  MONTHLY
  YEARLY
}

enum SubscriptionStatus {
  PENDING
  ACTIVE
  PAST_DUE
  CANCELED
}
```

Inside `model Dentist { ... }`, add the back-relation near `requestDentists`:
```prisma
  subscription    ClinicSubscription?
```

After the `Payment` model, add:
```prisma
model ClinicSubscription {
  id                 String             @id @default(uuid())
  dentistId          String             @unique
  dentist            Dentist            @relation(fields: [dentistId], references: [id], onDelete: Cascade)
  plan               SubscriptionPlan
  status             SubscriptionStatus @default(PENDING)
  priceILS           Int
  setupToken         String             @unique
  recurringToken     String? // PayPlus stored-card token uid (set after first paid charge)
  payplusCustomerUid String?
  currentPeriodEnd   DateTime?
  lastChargeAt       DateTime?
  canceledAt         DateTime?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  charges SubscriptionCharge[]

  @@index([status])
  @@index([currentPeriodEnd])
}

model SubscriptionCharge {
  id                   String             @id @default(uuid())
  subscriptionId       String
  subscription         ClinicSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  amountILS            Int
  status               RequestStatus      @default(PENDING)
  payplusTransactionUid String?           @unique
  periodStart          DateTime
  periodEnd            DateTime
  paidAt               DateTime?
  createdAt            DateTime           @default(now())

  @@index([subscriptionId])
}
```

- [ ] **Step 2: Create and apply the migration**

Run:
```bash
cd "app" && npx prisma migrate dev --name clinic_subscriptions
```
Expected: a new migration folder under `prisma/migrations/`, applied to the Neon DB, and the Prisma client regenerated into `src/generated/prisma`.

- [ ] **Step 3: Build to confirm the generated client types compile**

Run: `cd "app" && npm run build`
Expected: Compiled successfully; no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(subscriptions): ClinicSubscription + SubscriptionCharge schema"
```

---

## Task 3: PayPlus client module

**Files:**
- Create: `src/lib/payplus.ts`
- Create: `src/lib/payplus.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:
  - `isPayPlusConfigured(): boolean`
  - `createSubscriptionPaymentPage(args: { subscriptionId: string; setupToken: string; amountILS: number; clinicName: string; email: string; planLabelHe: string }): Promise<{ url: string; pageRequestUid: string }>`
  - `chargeByToken(args: { recurringToken: string; payplusCustomerUid?: string | null; amountILS: number; description: string }): Promise<{ ok: true; transactionUid: string } | { ok: false; error: string }>`
  - `verifyWebhookSignature(rawBody: string, header: string | null): boolean`
  - `parseWebhook(rawBody: string): { transactionUid: string; statusCode: string; approved: boolean; setupToken?: string; recurringToken?: string; customerUid?: string }`

> **CONFIRM against PayPlus docs/dashboard before runtime testing:** exact base URL, endpoint paths (`/PaymentPages/generateLink`, `/Transactions/Charge`), the auth header format, the token/customer field names in responses, and the HMAC header name + secret used for IPN signing. The shapes below match PayPlus's documented REST API as of this writing and are isolated to this one module — only the constants/field names here change if docs differ.

- [ ] **Step 1: Add env vars to `.env.example`**

Replace the Stripe section header area by adding, under `# --- Payments ---`:
```bash
# --- Clinic subscriptions: PayPlus ---
# https://www.payplus.co.il / restapidev (sandbox) | restapi (prod)
PAYPLUS_API_BASE="https://restapidev.payplus.co.il/api/v1.0"
PAYPLUS_API_KEY=""
PAYPLUS_SECRET_KEY=""
PAYPLUS_PAYMENT_PAGE_UID=""        # the hosted payment-page profile uid
PAYPLUS_WEBHOOK_SECRET=""          # shared secret for IPN signature verification
CRON_SECRET=""                     # bearer token Vercel Cron sends; also used to guard the cron route
```

- [ ] **Step 2: Write the failing test for signature verification + webhook parsing**

Create `src/lib/payplus.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature, parseWebhook } from "./payplus";

const SECRET = "test-secret";
function sign(body: string) {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

describe("payplus webhook", () => {
  beforeEach(() => {
    process.env.PAYPLUS_WEBHOOK_SECRET = SECRET;
  });

  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ transaction: { uid: "t1", status_code: "000" } });
    expect(verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rejects a tampered body or missing header", () => {
    const body = JSON.stringify({ transaction: { uid: "t1" } });
    expect(verifyWebhookSignature(body, "deadbeef")).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("parses approval + token fields from the IPN payload", () => {
    const body = JSON.stringify({
      transaction: { uid: "txn_9", status_code: "000" },
      data: { setup_token: "stk_1", token: "card_tok_1", customer_uid: "cus_1" },
    });
    const parsed = parseWebhook(body);
    expect(parsed).toEqual({
      transactionUid: "txn_9",
      statusCode: "000",
      approved: true,
      setupToken: "stk_1",
      recurringToken: "card_tok_1",
      customerUid: "cus_1",
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd "app" && npm run test`
Expected: FAIL — `Cannot find module './payplus'`.

- [ ] **Step 4: Implement `src/lib/payplus.ts`**

```ts
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = () => process.env.PAYPLUS_API_BASE ?? "";

export function isPayPlusConfigured(): boolean {
  return Boolean(
    process.env.PAYPLUS_API_KEY &&
      process.env.PAYPLUS_SECRET_KEY &&
      process.env.PAYPLUS_PAYMENT_PAGE_UID &&
      process.env.PAYPLUS_API_BASE,
  );
}

function authHeader(): string {
  // PayPlus expects credentials as a JSON string in the Authorization header.
  return JSON.stringify({
    api_key: process.env.PAYPLUS_API_KEY,
    secret_key: process.env.PAYPLUS_SECRET_KEY,
  });
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

/**
 * Generates a hosted PayPlus payment page for the first subscription charge,
 * configured to tokenize the card for future recurring charges. Returns the URL
 * to redirect the clinic to and the page-request uid for reference.
 */
export async function createSubscriptionPaymentPage(args: {
  subscriptionId: string;
  setupToken: string;
  amountILS: number;
  clinicName: string;
  email: string;
  planLabelHe: string;
}): Promise<{ url: string; pageRequestUid: string }> {
  const base = appUrl();
  const res = await fetch(`${BASE()}/PaymentPages/generateLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      payment_page_uid: process.env.PAYPLUS_PAYMENT_PAGE_UID,
      charge_method: 1, // immediate charge
      create_token: true, // tokenize the card for recurring charges
      amount: args.amountILS,
      currency_code: "ILS",
      sendEmailApproval: false,
      customer: { email: args.email, customer_name: args.clinicName },
      items: [{ name: `מנוי DentalCompare (${args.planLabelHe})`, quantity: 1, price: args.amountILS }],
      // setupToken round-trips back to us in the IPN + return URL so we can match.
      more_info: args.setupToken,
      refURL_success: `${base}/clinics/billing/return?token=${args.setupToken}&status=success`,
      refURL_failure: `${base}/clinics/billing/return?token=${args.setupToken}&status=failure`,
      refURL_callback: `${base}/api/webhooks/payplus`,
    }),
  });

  if (!res.ok) {
    throw new Error(`PayPlus generateLink failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { payment_page_link?: string; page_request_uid?: string };
  };
  const url = json.data?.payment_page_link;
  const pageRequestUid = json.data?.page_request_uid ?? "";
  if (!url) throw new Error("PayPlus generateLink returned no link");
  return { url, pageRequestUid };
}

/** Charges a previously stored card token for a renewal period. */
export async function chargeByToken(args: {
  recurringToken: string;
  payplusCustomerUid?: string | null;
  amountILS: number;
  description: string;
}): Promise<{ ok: true; transactionUid: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE()}/Transactions/Charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({
        payment_page_uid: process.env.PAYPLUS_PAYMENT_PAGE_UID,
        token: args.recurringToken,
        customer_uid: args.payplusCustomerUid ?? undefined,
        amount: args.amountILS,
        currency_code: "ILS",
        more_info: args.description,
      }),
    });
    const json = (await res.json()) as {
      results?: { status?: string; code?: string };
      data?: { transaction_uid?: string; transaction?: { uid?: string } };
    };
    const approved = json.results?.status === "success" || json.results?.code === "0";
    const txn = json.data?.transaction_uid ?? json.data?.transaction?.uid;
    if (!res.ok || !approved || !txn) {
      return { ok: false, error: `PayPlus charge declined (${json.results?.code ?? res.status})` };
    }
    return { ok: true, transactionUid: txn };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "charge error" };
  }
}

export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.PAYPLUS_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseWebhook(rawBody: string): {
  transactionUid: string;
  statusCode: string;
  approved: boolean;
  setupToken?: string;
  recurringToken?: string;
  customerUid?: string;
} {
  const json = JSON.parse(rawBody) as {
    transaction?: { uid?: string; status_code?: string };
    data?: { setup_token?: string; more_info?: string; token?: string; customer_uid?: string };
  };
  const statusCode = json.transaction?.status_code ?? "";
  return {
    transactionUid: json.transaction?.uid ?? "",
    statusCode,
    approved: statusCode === "000",
    setupToken: json.data?.setup_token ?? json.data?.more_info,
    recurringToken: json.data?.token,
    customerUid: json.data?.customer_uid,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd "app" && npm run test`
Expected: PASS — webhook signature + parse tests green.

- [ ] **Step 6: Build**

Run: `cd "app" && npm run build`
Expected: Compiled successfully.

- [ ] **Step 7: Commit**

```bash
git add src/lib/payplus.ts src/lib/payplus.test.ts .env.example
git commit -m "feat(subscriptions): PayPlus client (payment page, token charge, IPN verify)"
```

---

## Task 4: Subscription server functions

**Files:**
- Create: `src/server/subscriptions.ts`

**Interfaces:**
- Consumes: `db` (`@/lib/db`), `nextPeriodEnd` (`@/lib/subscription`), `SUBSCRIPTION_PLANS` (`@/lib/constants`).
- Produces (all server-side; called by registration, webhook, cron, admin):
  - `createPendingSubscription(args: { dentistId: string; plan: SubscriptionPlanType; setupToken: string }): Promise<void>`
  - `activateSubscriptionBySetupToken(args: { setupToken: string; transactionUid: string; recurringToken?: string; customerUid?: string }): Promise<{ ok: true } | { ok: false; error: string }>`
  - `recordRenewalCharge(args: { subscriptionId: string; transactionUid: string; amountILS: number; periodStart: Date; periodEnd: Date }): Promise<void>`
  - `markPastDue(subscriptionId: string): Promise<void>`
  - `cancelSubscription(subscriptionId: string): Promise<void>`

- [ ] **Step 1: Implement `src/server/subscriptions.ts`**

```ts
import "server-only";
import { db } from "@/lib/db";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanType } from "@/lib/constants";
import { nextPeriodEnd } from "@/lib/subscription";

export async function createPendingSubscription(args: {
  dentistId: string;
  plan: SubscriptionPlanType;
  setupToken: string;
}): Promise<void> {
  await db.clinicSubscription.create({
    data: {
      dentistId: args.dentistId,
      plan: args.plan,
      priceILS: SUBSCRIPTION_PLANS[args.plan].priceILS,
      setupToken: args.setupToken,
      status: "PENDING",
    },
  });
}

/**
 * Idempotently activates a subscription after its first paid charge: stores the
 * recurring token, opens the first paid period, and records a PAID charge. Safe
 * to call from both the webhook and the return page.
 */
export async function activateSubscriptionBySetupToken(args: {
  setupToken: string;
  transactionUid: string;
  recurringToken?: string;
  customerUid?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken: args.setupToken },
    select: { id: true, plan: true, priceILS: true, status: true },
  });
  if (!sub) return { ok: false, error: "מנוי לא נמצא" };

  // Idempotency: if we've already recorded this transaction, do nothing.
  const existing = await db.subscriptionCharge.findUnique({
    where: { payplusTransactionUid: args.transactionUid },
    select: { id: true },
  });
  if (existing) return { ok: true };

  const now = new Date();
  const periodEnd = nextPeriodEnd(now, sub.plan as SubscriptionPlanType);

  await db.$transaction([
    db.clinicSubscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        recurringToken: args.recurringToken ?? undefined,
        payplusCustomerUid: args.customerUid ?? undefined,
        currentPeriodEnd: periodEnd,
        lastChargeAt: now,
      },
    }),
    db.subscriptionCharge.create({
      data: {
        subscriptionId: sub.id,
        amountILS: sub.priceILS,
        status: "PAID",
        payplusTransactionUid: args.transactionUid,
        periodStart: now,
        periodEnd,
        paidAt: now,
      },
    }),
  ]);
  return { ok: true };
}

export async function recordRenewalCharge(args: {
  subscriptionId: string;
  transactionUid: string;
  amountILS: number;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  const now = new Date();
  await db.$transaction([
    db.clinicSubscription.update({
      where: { id: args.subscriptionId },
      data: { status: "ACTIVE", currentPeriodEnd: args.periodEnd, lastChargeAt: now },
    }),
    db.subscriptionCharge.create({
      data: {
        subscriptionId: args.subscriptionId,
        amountILS: args.amountILS,
        status: "PAID",
        payplusTransactionUid: args.transactionUid,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        paidAt: now,
      },
    }),
  ]);
}

export async function markPastDue(subscriptionId: string): Promise<void> {
  await db.clinicSubscription.update({
    where: { id: subscriptionId },
    data: { status: "PAST_DUE" },
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await db.clinicSubscription.update({
    where: { id: subscriptionId },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
}
```

- [ ] **Step 2: Build**

Run: `cd "app" && npm run build`
Expected: Compiled successfully (confirms `db.clinicSubscription` / `db.subscriptionCharge` types exist from Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/server/subscriptions.ts
git commit -m "feat(subscriptions): server functions for create/activate/renew/cancel"
```

---

## Task 5: Plan picker in the intake form + create PENDING subscription

**Files:**
- Create: `src/components/clinics/plan-picker.tsx`
- Modify: `src/components/clinics/registration-form.tsx`
- Modify: `src/server/clinic-registration.ts`

**Interfaces:**
- Consumes: `SUBSCRIPTION_PLANS`, `SUBSCRIPTION_TERMS_HE`, `SUBSCRIPTION_CONTRACT_VERSION` (`@/lib/constants`); `createPendingSubscription` (`@/server/subscriptions`); `randomUUID` (`node:crypto`).
- Produces: registration now also creates a `ClinicSubscription` (PENDING) with `setupToken`; the form submits a `plan` field that is one of `"MONTHLY" | "YEARLY"`.

- [ ] **Step 1: Create `src/components/clinics/plan-picker.tsx`**

```tsx
"use client";

import { useState } from "react";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: "MONTHLY" as const,
    title: "מסלול חודשי",
    price: `${SUBSCRIPTION_PLANS.MONTHLY.priceILS} ₪`,
    per: "לחודש",
    note: "ללא התחייבות — ביטול בכל עת",
  },
  {
    value: "YEARLY" as const,
    title: "מסלול שנתי",
    price: `${SUBSCRIPTION_PLANS.YEARLY.priceILS} ₪`,
    per: "לשנה",
    note: "חיסכון משמעותי לעומת חודשי",
  },
];

export function PlanPicker({ defaultValue = "MONTHLY" }: { defaultValue?: "MONTHLY" | "YEARLY" }) {
  const [selected, setSelected] = useState<"MONTHLY" | "YEARLY">(defaultValue);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          className={cn(
            "cursor-pointer rounded-2xl border p-5 transition-colors",
            selected === o.value
              ? "border-teal-deep bg-teal-deep/5 ring-teal-deep/20 ring-2"
              : "border-border/60 hover:border-teal-deep/40",
          )}
        >
          <input
            type="radio"
            name="plan"
            value={o.value}
            checked={selected === o.value}
            onChange={() => setSelected(o.value)}
            className="sr-only"
          />
          <p className="text-foreground font-semibold">{o.title}</p>
          <p className="text-foreground mt-2 text-2xl font-bold">
            {o.price} <span className="text-muted-foreground text-sm font-normal">{o.per}</span>
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{o.note}</p>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire the picker + swap contract copy in `registration-form.tsx`**

Add the import:
```tsx
import { PlanPicker } from "@/components/clinics/plan-picker";
```
Change the constants import to use the subscription copy:
```tsx
import {
  SUBSCRIPTION_TERMS_HE,
  HMO_OPTIONS,
  SPECIALTIES,
  TREATMENTS,
} from "@/lib/constants";
```
Replace the entire `{/* Contract */}` card so its heading is "מסלול ותנאי מנוי", it renders `<PlanPicker />` above the terms list, and the terms map over `SUBSCRIPTION_TERMS_HE` instead of `COMMISSION_TERMS_HE`. Keep the existing `agreeToTerms` checkbox and submit button unchanged:
```tsx
      {/* Plan + contract */}
      <div className="border-teal-deep/30 bg-teal-deep/5 rounded-3xl border p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <FileSignature className="text-teal-deep h-5 w-5" />
          <h2 className="font-display text-foreground text-lg font-bold">מסלול ותנאי מנוי</h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          בחרו מסלול. החיוב יתבצע רק לאחר אישור המרפאה על ידי הצוות — נשלח אליכם קישור להשלמת התשלום.
        </p>

        <div className="mt-5">
          <PlanPicker />
        </div>

        <ol className="text-foreground/90 mt-6 space-y-3 text-sm">
          {SUBSCRIPTION_TERMS_HE.map((clause, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="bg-teal-deep/10 text-teal-deep mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-pretty">{clause}</span>
            </li>
          ))}
        </ol>

        <label className="border-border/60 mt-6 flex cursor-pointer items-start gap-3 border-t pt-5 text-sm">
          <input
            type="checkbox"
            name="agreeToTerms"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="accent-teal-deep mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="text-foreground">
            קראתי, הבנתי ואני מאשר/ת בשם המרפאה את תנאי המנוי המפורטים לעיל.
          </span>
        </label>
      </div>
```
Remove the now-unused `COMMISSION` import line if present.

- [ ] **Step 3: Create the PENDING subscription in `registerClinic`**

In `src/server/clinic-registration.ts`:

Update imports:
```ts
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  HMO_OPTIONS,
  SPECIALTIES,
  TREATMENTS,
  SUBSCRIPTION_CONTRACT_VERSION,
  SUBSCRIPTION_PLANS,
} from "@/lib/constants";
import { createPendingSubscription } from "@/server/subscriptions";
```

After reading the other fields, read and validate the plan:
```ts
  const planRaw = String(formData.get("plan") ?? "");
  const plan = planRaw === "MONTHLY" || planRaw === "YEARLY" ? planRaw : null;
```
Add to the required-fields guard block:
```ts
  if (!plan) {
    return { ok: false, error: "יש לבחור מסלול מנוי" };
  }
```
Change the `termsVersion` stored to the subscription version:
```ts
      termsVersion: SUBSCRIPTION_CONTRACT_VERSION,
```
Replace the single `db.dentist.create({ ... })` call with a transaction that also creates the subscription. Capture the created dentist id:
```ts
  const setupToken = randomUUID();
  const dentist = await db.dentist.create({
    data: {
      clinicName,
      dentistName,
      contactName,
      email,
      phone,
      city,
      address,
      experienceYears: Math.floor(experienceYears),
      specialties: pickAllowed(formData, "specialties", SPECIALTIES),
      treatments: pickAllowed(formData, "treatments", TREATMENTS),
      hmoAffiliations: pickAllowed(formData, "hmoAffiliations", HMO_OPTIONS),
      profileImageUrl,
      isActive: false,
      submittedBySelf: true,
      agreedToTermsAt: new Date(),
      termsVersion: SUBSCRIPTION_CONTRACT_VERSION,
    },
    select: { id: true },
  });

  await createPendingSubscription({ dentistId: dentist.id, plan, setupToken });

  return { ok: true };
```
(`SUBSCRIPTION_PLANS` import is used by the called function; keep it only if referenced — otherwise drop it to satisfy lint.)

- [ ] **Step 4: Build**

Run: `cd "app" && npm run build`
Expected: Compiled successfully.

- [ ] **Step 5: Manual verification**

Run: `cd "app" && npm run dev`, open `/clinics/join`, submit the form with a plan selected.
Expected: success screen shown; in the DB a new `Dentist` (isActive=false) and a linked `ClinicSubscription` with `status=PENDING`, the chosen `plan`, correct `priceILS`, and a `setupToken`.

- [ ] **Step 6: Commit**

```bash
git add src/components/clinics/plan-picker.tsx src/components/clinics/registration-form.tsx src/server/clinic-registration.ts
git commit -m "feat(subscriptions): plan picker in intake form + PENDING subscription on register"
```

---

## Task 6: Approval generates a payment-setup link + email

**Files:**
- Modify: `src/server/admin-actions.ts` (`approveClinic`)
- Create: `src/server/subscription-notifications.ts`
- Modify: `src/server/clinic-notifications.ts` (approval email copy → "approved, complete payment to go live")

**Interfaces:**
- Consumes: `db`, `SITE_CONFIG` (`@/lib/constants`), `getResend`/`fromAddress` (`@/lib/email`).
- Produces:
  - `sendPaymentSetupEmail(args: { email: string; contactName: string | null; clinicName: string; setupToken: string }): Promise<boolean>`
  - `approveClinic` now: sets `isActive=true`, keeps subscription `PENDING`, and emails the setup link instead of a "you are live" message.

- [ ] **Step 1: Create `src/server/subscription-notifications.ts`**

```ts
import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import { SITE_CONFIG } from "@/lib/constants";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

function buildSetupHtml(opts: { contactName: string; clinicName: string; link: string }): string {
  const { contactName, clinicName, link } = opts;
  return `
  <div dir="rtl" style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #0f4c4c;">המרפאה אושרה — נותר רק להפעיל מנוי</h2>
    <p>שלום ${contactName || "צוות המרפאה"},</p>
    <p>המרפאה <strong>${clinicName}</strong> אושרה על ידי צוות DentalCompare.</p>
    <p>כדי שהמרפאה תופיע במאגר ותתחילו לקבל פניות, השלימו את הגדרת המנוי והתשלום:</p>
    <p style="margin: 24px 0;">
      <a href="${link}" style="background:#0f4c4c;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;">
        הפעלת המנוי והתשלום
      </a>
    </p>
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
    <p style="font-size: 12px; color: #777;">
      לשאלות: <a href="mailto:${SITE_CONFIG.supportEmail}">${SITE_CONFIG.supportEmail}</a>
    </p>
  </div>`;
}

export async function sendPaymentSetupEmail(args: {
  email: string;
  contactName: string | null;
  clinicName: string;
  setupToken: string;
}): Promise<boolean> {
  const link = `${appUrl()}/clinics/billing/${args.setupToken}`;
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.email,
      subject: "אישור מרפאה — הפעלת מנוי DentalCompare",
      html: buildSetupHtml({ contactName: args.contactName ?? "", clinicName: args.clinicName, link }),
    });
    if (error) {
      console.error(`Resend error for payment setup ${args.email}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send payment setup email to ${args.email}:`, err);
    return false;
  }
}
```

- [ ] **Step 2: Update `approveClinic` in `src/server/admin-actions.ts`**

Change the import from `sendClinicApprovalEmail` to the new setup email:
```ts
import { sendPaymentSetupEmail } from "@/server/subscription-notifications";
```
Replace the body of `approveClinic` so it loads the subscription's `setupToken` and emails the link (still flips the dentist active so it's "approved", but visibility now also depends on the subscription being ACTIVE — handled in Task 8):
```ts
export async function approveClinic(dentistId: string): Promise<ActionResult> {
  await requireAdmin();

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: {
      id: true,
      email: true,
      contactName: true,
      clinicName: true,
      subscription: { select: { setupToken: true } },
    },
  });
  if (!dentist) return { ok: false, error: "המרפאה לא נמצאה" };
  if (!dentist.subscription) {
    return { ok: false, error: "למרפאה אין מנוי משויך — לא ניתן לאשר" };
  }

  await db.dentist.update({
    where: { id: dentistId },
    data: { isActive: true, submittedBySelf: false },
  });

  await sendPaymentSetupEmail({
    email: dentist.email,
    contactName: dentist.contactName,
    clinicName: dentist.clinicName,
    setupToken: dentist.subscription.setupToken,
  });

  revalidatePath("/admin/clinics");
  revalidatePath("/admin/dentists");
  revalidatePath("/admin");
  return { ok: true };
}
```

- [ ] **Step 3: Build**

Run: `cd "app" && npm run build`
Expected: Compiled successfully. (The old `sendClinicApprovalEmail` may now be unused; leave the file in place — it is still valid — or remove the import only.)

- [ ] **Step 4: Commit**

```bash
git add src/server/admin-actions.ts src/server/subscription-notifications.ts
git commit -m "feat(subscriptions): approval emails a payment-setup link instead of going live"
```

---

## Task 7: Billing setup page → PayPlus payment page

**Files:**
- Create: `src/app/clinics/billing/[token]/page.tsx`
- Create: `src/server/billing-actions.ts`

**Interfaces:**
- Consumes: `db`, `createSubscriptionPaymentPage`/`isPayPlusConfigured` (`@/lib/payplus`), `SUBSCRIPTION_PLANS` (`@/lib/constants`).
- Produces: `startPayment(setupToken: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>` (server action).

- [ ] **Step 1: Create `src/server/billing-actions.ts`**

```ts
"use server";

import { db } from "@/lib/db";
import { createSubscriptionPaymentPage, isPayPlusConfigured } from "@/lib/payplus";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";

export async function startPayment(
  setupToken: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isPayPlusConfigured()) {
    return { ok: false, error: "התשלומים אינם מוגדרים עדיין. פנו לתמיכה." };
  }

  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken },
    select: {
      id: true,
      plan: true,
      priceILS: true,
      status: true,
      dentist: { select: { clinicName: true, email: true } },
    },
  });
  if (!sub) return { ok: false, error: "קישור לא תקין" };
  if (sub.status === "ACTIVE") return { ok: false, error: "המנוי כבר פעיל" };

  try {
    const { url } = await createSubscriptionPaymentPage({
      subscriptionId: sub.id,
      setupToken,
      amountILS: sub.priceILS,
      clinicName: sub.dentist.clinicName,
      email: sub.dentist.email,
      planLabelHe: SUBSCRIPTION_PLANS[sub.plan as "MONTHLY" | "YEARLY"].labelHe,
    });
    return { ok: true, url };
  } catch (err) {
    console.error("startPayment failed:", err);
    return { ok: false, error: "יצירת דף התשלום נכשלה — נסו שוב" };
  }
}
```

- [ ] **Step 2: Create `src/app/clinics/billing/[token]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import { StartPaymentButton } from "@/components/clinics/start-payment-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "הפעלת מנוי" };

export default async function BillingSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken: token },
    select: {
      plan: true,
      priceILS: true,
      status: true,
      dentist: { select: { clinicName: true } },
    },
  });
  if (!sub) notFound();

  const planLabel = SUBSCRIPTION_PLANS[sub.plan as "MONTHLY" | "YEARLY"].labelHe;

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-xl flex-1 flex-col px-6 py-16">
        <h1 className="font-display text-foreground text-3xl font-bold">הפעלת מנוי</h1>
        <p className="text-muted-foreground mt-2">{sub.dentist.clinicName}</p>

        {sub.status === "ACTIVE" ? (
          <p className="border-border/60 bg-card mt-8 rounded-2xl border p-6 text-sm">
            המנוי כבר פעיל. המרפאה מופיעה במאגר.
          </p>
        ) : (
          <div className="border-border/60 bg-card mt-8 rounded-2xl border p-6">
            <p className="text-foreground text-lg font-semibold">
              מסלול {planLabel} — {sub.priceILS} ₪
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              לאחר התשלום המרפאה תופיע במאגר ותתחילו לקבל פניות. המנוי יתחדש אוטומטית בתום התקופה.
            </p>
            <div className="mt-6">
              <StartPaymentButton setupToken={token} />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Create `src/components/clinics/start-payment-button.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { startPayment } from "@/server/billing-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function StartPaymentButton({ setupToken }: { setupToken: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await startPayment(setupToken);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.location.href = result.url;
        })
      }
      className={cn(
        buttonVariants(),
        "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 font-semibold disabled:opacity-50",
      )}
    >
      {isPending ? "מעבר לתשלום…" : "מעבר לתשלום מאובטח"}
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}
```

- [ ] **Step 4: Build**

Run: `cd "app" && npm run build`
Expected: Compiled successfully; route `/clinics/billing/[token]` listed.

- [ ] **Step 5: Commit**

```bash
git add src/app/clinics/billing/[token]/page.tsx src/server/billing-actions.ts src/components/clinics/start-payment-button.tsx
git commit -m "feat(subscriptions): billing setup page that opens the PayPlus payment page"
```

---

## Task 8: Webhook + return page → activate subscription; gate directory visibility

**Files:**
- Create: `src/app/api/webhooks/payplus/route.ts`
- Create: `src/app/clinics/billing/return/page.tsx`
- Modify: `src/app/dentists/page.tsx`
- Modify: `src/app/api/dentists/route.ts`

**Interfaces:**
- Consumes: `verifyWebhookSignature`/`parseWebhook` (`@/lib/payplus`), `activateSubscriptionBySetupToken` (`@/server/subscriptions`).
- Produces: directory queries now require `subscription: { status: "ACTIVE" }`.

- [ ] **Step 1: Create `src/app/api/webhooks/payplus/route.ts`**

```ts
import { NextResponse } from "next/server";
import { verifyWebhookSignature, parseWebhook } from "@/lib/payplus";
import { activateSubscriptionBySetupToken } from "@/server/subscriptions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  // PayPlus signs the IPN; confirm the exact header name against the dashboard.
  const signature = req.headers.get("hash") ?? req.headers.get("x-payplus-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let parsed: ReturnType<typeof parseWebhook>;
  try {
    parsed = parseWebhook(raw);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  if (parsed.approved && parsed.setupToken) {
    const result = await activateSubscriptionBySetupToken({
      setupToken: parsed.setupToken,
      transactionUid: parsed.transactionUid,
      recurringToken: parsed.recurringToken,
      customerUid: parsed.customerUid,
    });
    if (!result.ok) {
      console.error(`PayPlus activation failed for ${parsed.setupToken}:`, result.error);
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Create `src/app/clinics/billing/return/page.tsx`**

This page is where the clinic lands after PayPlus redirect. It activates as a fallback (in case the webhook is delayed) using the setup token + a lookup of the latest transaction is not available here, so it only reads status; activation is authoritative via webhook. Show status based on the current subscription state:
```tsx
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const dynamic = "force-dynamic";
export const metadata = { title: "סטטוס תשלום" };

export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;

  const sub = token
    ? await db.clinicSubscription.findUnique({
        where: { setupToken: token },
        select: { status: true, dentist: { select: { clinicName: true } } },
      })
    : null;

  const active = sub?.status === "ACTIVE";
  const success = active || status === "success";

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center px-6 py-20 text-center">
        {success ? (
          <CheckCircle2 className="text-teal-deep h-14 w-14" />
        ) : (
          <XCircle className="text-coral h-14 w-14" />
        )}
        <h1 className="font-display text-foreground mt-6 text-2xl font-bold">
          {success ? "התשלום התקבל!" : "התשלום לא הושלם"}
        </h1>
        <p className="text-muted-foreground mt-3">
          {success
            ? "המנוי הופעל. המרפאה מופיעה במאגר ותתחילו לקבל פניות ממטופלים."
            : "לא הצלחנו לאשר את התשלום. ניתן לנסות שוב מקישור ההפעלה שנשלח במייל."}
        </p>
        <Link
          href="/"
          className="text-teal-deep mt-8 text-sm font-semibold underline-offset-4 hover:underline"
        >
          חזרה לדף הבית
        </Link>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Gate the directory page query**

In `src/app/dentists/page.tsx`, change the query `where`:
```ts
  const dentists = await db.dentist.findMany({
    where: { isActive: true, subscription: { status: "ACTIVE" } },
    orderBy: [{ reviewCount: "desc" }, { rating: "desc" }, { experienceYears: "desc" }],
  });
```

- [ ] **Step 4: Gate the directory API query**

In `src/app/api/dentists/route.ts`, change the `where` to include the subscription filter:
```ts
    where: {
      isActive: true,
      subscription: { status: "ACTIVE" },
      ...(city ? { city } : {}),
      ...(specialties.length ? { specialties: { hasSome: specialties } } : {}),
      ...(hmos.length ? { hmoAffiliations: { hasSome: hmos } } : {}),
      ...(minExperience ? { experienceYears: { gte: minExperience } } : {}),
    },
```

- [ ] **Step 5: Build**

Run: `cd "app" && npm run build`
Expected: Compiled successfully; routes `/api/webhooks/payplus` and `/clinics/billing/return` listed.

- [ ] **Step 6: Manual verification (sandbox)**

With PayPlus **sandbox** env vars set: register a clinic, approve it in admin, open the setup link, complete payment on the PayPlus sandbox page.
Expected: webhook activates the subscription (`status=ACTIVE`, `recurringToken` stored, a `SubscriptionCharge` row `PAID`); the clinic now appears at `/dentists`; before payment it does NOT appear even though `isActive=true`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/webhooks/payplus/route.ts src/app/clinics/billing/return/page.tsx src/app/dentists/page.tsx src/app/api/dentists/route.ts
git commit -m "feat(subscriptions): PayPlus webhook activation + directory gated on active subscription"
```

---

## Task 9: Renewal cron + dunning

**Files:**
- Create: `src/app/api/cron/renew-subscriptions/route.ts`
- Create: `vercel.json` (or modify if present)
- Modify: `src/server/subscription-notifications.ts` (add `sendPaymentFailedEmail`)

**Interfaces:**
- Consumes: `db`, `isDueForRenewal`/`nextPeriodEnd` (`@/lib/subscription`), `chargeByToken` (`@/lib/payplus`), `recordRenewalCharge`/`markPastDue` (`@/server/subscriptions`).
- Produces: a GET route guarded by `CRON_SECRET` that renews due subscriptions.

- [ ] **Step 1: Add `sendPaymentFailedEmail` to `src/server/subscription-notifications.ts`**

```ts
export async function sendPaymentFailedEmail(args: {
  email: string;
  clinicName: string;
}): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.email,
      subject: "חיוב המנוי נכשל — DentalCompare",
      html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; color:#1a1a1a; max-width:560px; margin:0 auto;">
        <h2 style="color:#0f4c4c;">לא הצלחנו לחייב את המנוי</h2>
        <p>החיוב התקופתי עבור <strong>${args.clinicName}</strong> נכשל. כדי שהמרפאה תמשיך להופיע במאגר, יש לעדכן את אמצעי התשלום.</p>
        <p style="font-size:12px;color:#777;">פנו לתמיכה: <a href="mailto:${SITE_CONFIG.supportEmail}">${SITE_CONFIG.supportEmail}</a></p>
      </div>`,
    });
    if (error) {
      console.error(`Resend error for payment-failed ${args.email}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send payment-failed email to ${args.email}:`, err);
    return false;
  }
}
```

- [ ] **Step 2: Create `src/app/api/cron/renew-subscriptions/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDueForRenewal, nextPeriodEnd } from "@/lib/subscription";
import { chargeByToken } from "@/lib/payplus";
import { recordRenewalCharge, markPastDue } from "@/server/subscriptions";
import { sendPaymentFailedEmail } from "@/server/subscription-notifications";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanType } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const candidates = await db.clinicSubscription.findMany({
    where: { status: "ACTIVE", recurringToken: { not: null }, currentPeriodEnd: { not: null } },
    select: {
      id: true,
      plan: true,
      priceILS: true,
      recurringToken: true,
      payplusCustomerUid: true,
      currentPeriodEnd: true,
      dentist: { select: { clinicName: true, email: true } },
    },
  });

  let renewed = 0;
  let failed = 0;

  for (const sub of candidates) {
    if (!sub.currentPeriodEnd || !sub.recurringToken) continue;
    if (!isDueForRenewal(sub.currentPeriodEnd, now)) continue;

    const result = await chargeByToken({
      recurringToken: sub.recurringToken,
      payplusCustomerUid: sub.payplusCustomerUid,
      amountILS: sub.priceILS,
      description: `חידוש מנוי DentalCompare — ${sub.dentist.clinicName}`,
    });

    if (result.ok) {
      const periodStart = sub.currentPeriodEnd;
      const periodEnd = nextPeriodEnd(periodStart, sub.plan as SubscriptionPlanType);
      await recordRenewalCharge({
        subscriptionId: sub.id,
        transactionUid: result.transactionUid,
        amountILS: sub.priceILS,
        periodStart,
        periodEnd,
      });
      renewed += 1;
    } else {
      await markPastDue(sub.id);
      await sendPaymentFailedEmail({ email: sub.dentist.email, clinicName: sub.dentist.clinicName });
      failed += 1;
    }
  }

  // SUBSCRIPTION_PLANS referenced to keep label parity available for future use.
  void SUBSCRIPTION_PLANS;
  return NextResponse.json({ checked: candidates.length, renewed, failed });
}
```

- [ ] **Step 3: Create/modify `vercel.json` with the cron schedule**

```json
{
  "crons": [{ "path": "/api/cron/renew-subscriptions", "schedule": "0 6 * * *" }]
}
```
(Vercel Cron sends the `Authorization: Bearer $CRON_SECRET` header automatically when `CRON_SECRET` is set in project env.)

- [ ] **Step 4: Build**

Run: `cd "app" && npm run build`
Expected: Compiled successfully; route `/api/cron/renew-subscriptions` listed.

- [ ] **Step 5: Manual verification (local)**

With a subscription whose `currentPeriodEnd` you set to "tomorrow" in the DB and a valid sandbox token, run:
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/renew-subscriptions
```
Expected: JSON `{ checked, renewed, failed }`; on success a new `SubscriptionCharge` row and an extended `currentPeriodEnd`; an unauthorized call (no header) returns 401.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/renew-subscriptions/route.ts vercel.json src/server/subscription-notifications.ts
git commit -m "feat(subscriptions): daily renewal cron with dunning on failed charge"
```

---

## Task 10: Admin subscriptions view + nav

**Files:**
- Create: `src/app/admin/subscriptions/page.tsx`
- Modify: `src/app/admin/layout.tsx` (add nav item)

**Interfaces:**
- Consumes: `db`, `SUBSCRIPTION_PLANS` (`@/lib/constants`).
- Produces: read-only admin table of clinic subscriptions.

- [ ] **Step 1: Add the nav item in `src/app/admin/layout.tsx`**

Add `CreditCard`-style entry to the `NAV` array (after "תשלומים"); reuse an imported icon, e.g. `Repeat` from lucide-react (add to the import list):
```tsx
  { href: "/admin/subscriptions", label: "מנויים", icon: Repeat },
```

- [ ] **Step 2: Create `src/app/admin/subscriptions/page.tsx`**

```tsx
import { db } from "@/lib/db";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";

export const metadata = { title: "ניהול — מנויים" };
export const dynamic = "force-dynamic";

const statusHe: Record<string, string> = {
  PENDING: "ממתין לתשלום",
  ACTIVE: "פעיל",
  PAST_DUE: "חיוב נכשל",
  CANCELED: "בוטל",
};

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminSubscriptionsPage() {
  const subs = await db.clinicSubscription.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      plan: true,
      status: true,
      priceILS: true,
      currentPeriodEnd: true,
      dentist: { select: { clinicName: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">מנויים</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">מצב המנויים של המרפאות בפלטפורמה.</p>
      </header>

      <div className="border-border/60 bg-card overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-3 text-start font-medium">מרפאה</th>
              <th className="px-4 py-3 text-start font-medium">מסלול</th>
              <th className="px-4 py-3 text-start font-medium">סטטוס</th>
              <th className="px-4 py-3 text-start font-medium">תוקף עד</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {subs.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                  אין מנויים עדיין.
                </td>
              </tr>
            ) : (
              subs.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <p className="text-foreground font-medium">{s.dentist.clinicName}</p>
                    <p className="text-muted-foreground text-xs">{s.dentist.email}</p>
                  </td>
                  <td className="text-foreground px-4 py-3">
                    {SUBSCRIPTION_PLANS[s.plan as "MONTHLY" | "YEARLY"].labelHe} · {s.priceILS} ₪
                  </td>
                  <td className="px-4 py-3">{statusHe[s.status]}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {s.currentPeriodEnd ? dateFmt.format(s.currentPeriodEnd) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `cd "app" && npm run build`
Expected: Compiled successfully; route `/admin/subscriptions` listed.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/subscriptions/page.tsx src/app/admin/layout.tsx
git commit -m "feat(admin): clinic subscriptions overview"
```

---

## Self-Review

**Spec coverage (against the decided design):**
- Plan ₪299/mo, ₪1,990/yr → Task 1 constants, Task 5 picker. ✔
- PayPlus provider → Task 3 client, Task 7 page-create, Task 9 token charge. ✔
- Register → approve → pay → live ordering → Tasks 5/6/7/8. ✔
- Charge only after approval → Task 6 (approval emails setup link; first charge happens on the PayPlus page in Task 7/8). ✔
- Visibility = approved AND active subscription → Task 8 directory gating + `isClinicVisible` helper (Task 1). ✔
- Recurring renewal + dunning → Task 9. ✔
- Tax invoice — handled by PayPlus on each charge (config in the PayPlus dashboard); **noted as an out-of-code configuration item**, not a code task. ✔ (flagged below)
- Admin visibility of subscriptions → Task 10. ✔
- Cancel subscription → `cancelSubscription` exists (Task 4); an admin cancel button is **not** wired into the UI in this plan (read-only admin view). Out of scope for v1; add later if needed. ⚠ (intentional)

**Placeholder scan:** No "TBD/handle edge cases" steps; all code steps include full code. The only deliberate "confirm against vendor docs" notes are in Task 3/8 for PayPlus HTTP specifics (endpoint paths, auth/sig header names) — these are genuine external-contract unknowns isolated to one module, with a verification step, not hidden work.

**Type consistency:** `SubscriptionPlanType` (`"MONTHLY" | "YEARLY"`) is used consistently; `setupToken` is the join key across registration → email → page → action → webhook → activation; `recurringToken`/`payplusCustomerUid` names match between schema, `chargeByToken`, `activateSubscriptionBySetupToken`, and the cron; charge status reuses `RequestStatus`. `isClinicVisible` mirrors the `subscription.status === "ACTIVE"` filter used in queries.

**Known out-of-code prerequisites (not tasks, but required before go-live):**
1. PayPlus merchant account + payment-page profile; set the 6 env vars (Task 3 Step 1) in Vercel.
2. Enable automatic tax-invoice (חשבונית מס) issuance in the PayPlus dashboard.
3. Replace the old commission contract (`COMMISSION*` in constants) with the subscription contract everywhere it's still referenced; have the new `SUBSCRIPTION_TERMS_HE` reviewed by a lawyer.
4. Confirm PayPlus IPN signature header name + recurring/token field names against live docs; adjust `src/lib/payplus.ts` only.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-28-clinic-subscription-billing.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
