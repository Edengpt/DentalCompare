# P0 International Foundations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove everything that hardcodes Israel into DentalCompare, so clinics and patients from any country can exist in the system.

**Architecture:** A country becomes a row in a `Country` table, never a hardcoded list. Phone parsing moves to `libphonenumber-js`. Money becomes `<name>Minor Int` + `currency String`, migrated in four reversible steps because it touches live billing. Text moves into typed dictionaries under `src/i18n/` with `en.ts` declared `typeof he`, so a missing key fails the build.

**Tech Stack:** Next.js 16.2.9 (App Router), React 19.2, Prisma 7.8 + Postgres, Clerk 7.5, Tailwind v4, vitest (node env), PayPlus.

**Spec:** `docs/superpowers/specs/2026-08-20-international-p0-design.md`

## Global Constraints

- **Tests:** vitest, node environment, pattern `src/**/*.test.ts`. No component-test infrastructure exists and this plan adds none. Run with `npm test`.
- **Never hardcode a country list in code.** Countries are rows in `Country`.
- **Money is always integer minor units + an ISO 4217 currency code.** Never float, never a bare number.
- **`amountILS` / `priceILS` hold WHOLE SHEKELS**, confirmed at `src/lib/payplus.ts:45` (`amount: args.amountILS` with `currency_code: "ILS"`, constant `299`). Backfill multiplies by 100.
- **Any `middleware.ts` must be wrapped in `clerkMiddleware()`** or Clerk auth breaks silently — there is no middleware in the project today.
- **Patients never pay.** Nothing in this plan may introduce a patient-facing fee.
- **Existing Israeli behaviour must keep working** at every commit. This is an additive migration, not a rewrite.
- Commit after every task. Keep `main` releasable.

---

## Task Order Rationale

The spec's rollout order (§8) put the middleware first and the `[locale]/`
restructure last. **That order breaks the site in between**: a middleware that
redirects `/` → `/he/` while `src/app/[locale]/` does not yet exist 404s every
page.

This plan corrects it. Task 1 adds a **pass-through** middleware with no locale
logic at all — its only job is to prove Clerk survives the introduction of a
middleware, which is the single highest risk in P0. Locale routing lands in
Task 10 together with the `[locale]/` directory that makes it valid.

---

### Task 1: Pass-through middleware — isolate the Clerk risk

The project has no `src/middleware.ts` and Clerk works via `auth()` directly in
server components. Introducing a middleware changes the request pipeline. If it
is not wrapped in `clerkMiddleware()`, auth breaks **silently** — no error, no
build failure. This task changes nothing else, so if auth breaks, the cause is
unambiguous.

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a `middleware.ts` whose matcher and `clerkMiddleware()` wrapper Task 10 extends with locale logic

- [ ] **Step 1: Create the pass-through middleware**

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Deliberately does nothing yet.
 *
 * The project ran without a middleware for its whole life, with Clerk reached
 * through auth() inside server components. Introducing one changes the request
 * pipeline, and an unwrapped middleware breaks Clerk silently — no error, no
 * failed build, just logged-out users. Landing the wrapper on its own, with no
 * other behaviour, makes that failure impossible to misattribute.
 *
 * Locale negotiation is added here in Task 10, once src/app/[locale]/ exists to
 * redirect into.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next internals and files with an extension, which must
    // never pay middleware cost.
    "/((?!_next|monitoring|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // API routes: Clerk needs to run on them, locale logic never will.
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: builds clean. A Clerk misconfiguration usually surfaces here first.

- [ ] **Step 3: Manual Clerk smoke test — BLOCKING**

Run `npm run dev`, then in a browser verify **all four**:
1. `/sign-up` renders and a new account can be created
2. `/sign-in` renders and an existing account can sign in
3. `/dashboard` loads while signed in and shows the user's requests
4. `/dashboard` redirects to sign-in while signed out

**If any of these fail, STOP.** Do not continue to Task 2 — every later task
assumes a working auth pipeline, and debugging them against broken auth wastes
the whole plan.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): add pass-through clerkMiddleware ahead of locale routing"
```

---

### Task 2: International phone numbers

`src/lib/phone.ts:36` returns `null` for any number that is not `+972`. This is
the single bug that makes foreign registration impossible, so it comes before
everything that would need a foreign user to test.

**Files:**
- Modify: `src/lib/phone.ts` (full rewrite)
- Modify: `src/lib/phone.test.ts`
- Modify: `src/app/api/webhooks/clerk/route.ts:5,62`
- Modify: `src/server/phone-actions.ts:5,30`
- Modify: `src/server/users.ts:4,15`
- Modify: `src/server/fulfillment.ts:10,143`
- Modify: `src/components/request/phone-verification.tsx:8,48,62,119`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `normalizePhone(input: string | null | undefined, country?: string): string | null` — E.164 or null
  - `formatPhoneForDisplay(e164: string | null | undefined): string` — national format, or the input unchanged if unparseable

**The mobile rule, which is subtle.** The existing product rule is mobile-only:
a clinic calling back a landline is not the qualification gate wanted, and SMS
OTP needs a mobile. But mobile-vs-landline is not knowable everywhere — in the
US both share the same number ranges, and `libphonenumber-js` reports
`FIXED_LINE_OR_MOBILE`. So the rule is: **accept `MOBILE` and
`FIXED_LINE_OR_MOBILE`, reject `FIXED_LINE`.** Israel distinguishes them, so
every existing Israeli landline rejection keeps working; the US stays usable.

**One existing test must change, and that is the point.** `phone.test.ts`
currently asserts `normalizeIsraeliMobile("+14155552671")` is `null` under
"rejects wrong lengths, foreign numbers and junk". Rejecting foreign numbers is
the defect being fixed. The Israeli *format* tests all stay and must still pass.

- [ ] **Step 1: Install the dependency**

```bash
npm install libphonenumber-js
```

Chosen over full `libphonenumber` for size (~145KB vs ~530KB) with identical
parse/validate/format behaviour.

- [ ] **Step 2: Write the failing tests**

Replace `src/lib/phone.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { normalizePhone, formatPhoneForDisplay } from "./phone";

describe("normalizePhone — Israeli regression", () => {
  it("normalises the common local formats to E.164", () => {
    for (const input of [
      "0501234567",
      "050-123-4567",
      "050 123 4567",
      "+972501234567",
      "+972-50-123-4567",
      "972501234567",
      "00972501234567",
    ]) {
      expect(normalizePhone(input, "IL")).toBe("+972501234567");
    }
  });

  it("accepts every allocated mobile prefix", () => {
    for (const p of ["050", "051", "052", "053", "054", "055", "056", "058", "059"]) {
      expect(normalizePhone(`${p}1234567`, "IL")).toBe(`+972${p.slice(1)}1234567`);
    }
  });

  it("still rejects Israeli landlines — the mobile gate is a product rule", () => {
    for (const input of ["031234567", "0212345678", "089123456", "+97231234567"]) {
      expect(normalizePhone(input, "IL")).toBeNull();
    }
  });

  it("rejects wrong lengths and junk", () => {
    for (const input of ["050123456", "05012345678", "", "   ", "not a phone", "05a1234567"]) {
      expect(normalizePhone(input, "IL")).toBeNull();
    }
  });

  it("is idempotent", () => {
    const once = normalizePhone("0541112222", "IL")!;
    expect(normalizePhone(once, "IL")).toBe(once);
  });
});

describe("normalizePhone — international", () => {
  it("accepts mobiles from other countries in international form", () => {
    expect(normalizePhone("+447911123456")).toBe("+447911123456"); // UK
    expect(normalizePhone("+905321234567")).toBe("+905321234567"); // Turkey
    expect(normalizePhone("+36201234567")).toBe("+36201234567"); // Hungary
  });

  it("uses the country hint to read a local-format number", () => {
    expect(normalizePhone("07911 123456", "GB")).toBe("+447911123456");
    expect(normalizePhone("0532 123 45 67", "TR")).toBe("+905321234567");
  });

  it("lets an explicit international prefix win over a wrong country hint", () => {
    expect(normalizePhone("+447911123456", "IL")).toBe("+447911123456");
  });

  it("accepts US numbers, where mobile and landline are indistinguishable", () => {
    // libphonenumber reports FIXED_LINE_OR_MOBILE here. Rejecting that would
    // lock out every US patient, which is worse than admitting a landline.
    expect(normalizePhone("+14155552671")).toBe("+14155552671");
  });

  it("rejects unparseable input with no country hint", () => {
    expect(normalizePhone("0501234567")).toBeNull(); // ambiguous without a country
    expect(normalizePhone("+999999999999")).toBeNull();
  });
});

describe("formatPhoneForDisplay", () => {
  it("renders Israeli numbers in the local format users recognise", () => {
    expect(formatPhoneForDisplay("+972501234567")).toBe("050-123-4567");
  });

  it("renders foreign numbers in their own national format", () => {
    expect(formatPhoneForDisplay("+447911123456")).toBe("07911 123456");
  });

  it("passes through anything it can't parse rather than throwing", () => {
    expect(formatPhoneForDisplay("nonsense")).toBe("nonsense");
    expect(formatPhoneForDisplay(null)).toBe("");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/lib/phone.test.ts`
Expected: FAIL — `normalizePhone` is not exported.

- [ ] **Step 4: Rewrite `src/lib/phone.ts`**

```ts
import { parsePhoneNumberWithError, type CountryCode } from "libphonenumber-js";

/**
 * Phone number handling, international.
 *
 * Was Israel-only: any number that wasn't +972 was rejected outright, which
 * made foreign registration impossible. The canonical stored form is still
 * E.164 — one row per real number — because two spellings of the same number
 * both passing would let one person open unlimited accounts.
 */

/**
 * Mobile-only is a product rule: a clinic calling back a landline isn't the
 * qualification gate we want, and SMS OTP needs a mobile.
 *
 * But it isn't knowable everywhere. The US shares number ranges between
 * landline and mobile, so libphonenumber can only say FIXED_LINE_OR_MOBILE.
 * Rejecting that would lock out every US patient — worse than admitting the
 * occasional landline. Israel does distinguish them, so Israeli landlines are
 * still rejected exactly as before.
 */
const ACCEPTED_TYPES = new Set(["MOBILE", "FIXED_LINE_OR_MOBILE"]);

/**
 * Returns the number as E.164, or null if it isn't a usable mobile.
 *
 * `country` is a hint for reading local-format input (`05X…` as Israeli,
 * `07X…` as British). An explicit international prefix always wins over it.
 */
export function normalizePhone(
  input: string | null | undefined,
  country?: string,
): string | null {
  if (!input?.trim()) return null;

  try {
    const parsed = parsePhoneNumberWithError(input, country as CountryCode | undefined);
    if (!parsed.isValid()) return null;

    const type = parsed.getType();
    // An unknown type on a number libphonenumber already called valid means the
    // country's metadata doesn't classify ranges. Admit it rather than lock the
    // country out.
    if (type && !ACCEPTED_TYPES.has(type)) return null;

    return parsed.number;
  } catch {
    return null;
  }
}

/** Renders a stored E.164 number in its own country's national format. */
export function formatPhoneForDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  try {
    const parsed = parsePhoneNumberWithError(e164);
    return parsed.isValid() ? parsed.formatNational() : e164;
  } catch {
    return e164;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/lib/phone.test.ts`
Expected: PASS.

If the Israeli display test fails on separators, adjust the **expected string**
to whatever `formatNational()` produces for `+972501234567` — do not hand-roll
formatting to force the old shape. The library's national format is correct per
country and hand-rolling it reintroduces the Israel-only assumption.

- [ ] **Step 6: Update all five callers**

Rename at each site; no logic changes:
- `src/app/api/webhooks/clerk/route.ts:5,62` — `normalizeIsraeliMobile(rawPhone)` → `normalizePhone(rawPhone)`. No country hint: Clerk gives international format.
- `src/server/phone-actions.ts:5,30` — same rename.
- `src/server/users.ts:4,15` — same rename.
- `src/server/fulfillment.ts:10,143` — `formatIsraeliMobileForDisplay` → `formatPhoneForDisplay`.
- `src/components/request/phone-verification.tsx:8,48,62,119` — both renames.

- [ ] **Step 7: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all green, no references to the old names remain.

Verify with: `grep -rn "normalizeIsraeliMobile\|formatIsraeliMobileForDisplay" src`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/lib/phone.ts src/lib/phone.test.ts src/app/api/webhooks/clerk/route.ts src/server/phone-actions.ts src/server/users.ts src/server/fulfillment.ts src/components/request/phone-verification.tsx package.json package-lock.json
git commit -m "feat(phone): accept international numbers, not just Israeli mobiles"
```

---

### Task 3: The Country model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_country_model/migration.sql` (generated)
- Modify: `prisma/seed.ts`
- Create: `src/lib/countries.ts`
- Create: `src/lib/countries.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `Country` model with `code`, `nameEn`, `currency`, `callingCode`, `defaultLocale`, `insurers`, `requiredDocs`, `isActive`
  - `getActiveCountries(): Promise<Country[]>`
  - `getCountry(code: string): Promise<Country | null>`

- [ ] **Step 1: Add the models to `prisma/schema.prisma`**

```prisma
model Country {
  code          String   @id              // ISO 3166-1 alpha-2: "IL", "TR", "HU"
  nameEn        String
  currency      String                    // ISO 4217: "ILS", "TRY", "EUR"
  callingCode   String                    // "972", "90", "36"
  defaultLocale String   @default("en")
  // Payers to offer in the clinic profile. Empty where the concept doesn't apply.
  insurers      String[]
  // Licence documents an admin must see before approving a clinic here. P2
  // consumes this; P0 only stores it, so the model doesn't change again.
  requiredDocs  String[]
  // New countries arrive as drafts. An admin flips this only once currency,
  // insurers and required documents are filled in — a half-configured country
  // must never reach users.
  isActive      Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  dentists Dentist[]
  users    User[]
}
```

Add to `User`:

```prisma
  countryCode String  @default("IL")
  country     Country @relation(fields: [countryCode], references: [code])
  locale      String  @default("he")
```

Add to `Dentist`:

```prisma
  countryCode     String   @default("IL")
  country         Country  @relation(fields: [countryCode], references: [code])
  locale          String   @default("he")
  spokenLanguages String[]
```

`@default("IL")` makes every existing row correct the moment the column exists.

- [ ] **Step 2: Seed Israel BEFORE generating the migration**

The foreign keys will not apply against existing rows unless `IL` exists first.
Add to `prisma/seed.ts`, preserving the existing "no fake clinics" comment:

```ts
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient();

/**
 * Countries ARE seeded, unlike clinics. A country is reference data the app
 * cannot function without — every User and Dentist foreign-keys to one — and
 * Israel is the only country with existing rows pointing at it.
 *
 * Adding further countries is an admin action, never a code change.
 */
async function main() {
  await db.country.upsert({
    where: { code: "IL" },
    update: {},
    create: {
      code: "IL",
      nameEn: "Israel",
      currency: "ILS",
      callingCode: "972",
      defaultLocale: "he",
      insurers: ["Clalit", "Maccabi", "Meuhedet", "Leumit"],
      requiredDocs: ["dental_licence", "business_registration"],
      isActive: true,
    },
  });

  console.log("✅ Seeded country: IL");
  console.log(
    "ℹ️  No clinic seed data. Clinics are added via the intake form + admin approval.",
  );
}

main().finally(() => db.$disconnect());
```

- [ ] **Step 3: Generate and apply the migration**

```bash
docker start dentalcompare-db
npx prisma migrate dev --name country_model
npm run db:seed
```

If the migration fails on the foreign key because rows already exist, hand-edit
the generated SQL to `INSERT` the `IL` row into `Country` **before** the
`ALTER TABLE … ADD CONSTRAINT` statements, then re-run.

- [ ] **Step 4: Write the failing test**

Create `src/lib/countries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isSupportedCurrency, minorUnitDigits } from "./countries";

describe("minorUnitDigits", () => {
  it("returns 2 for the common currencies", () => {
    expect(minorUnitDigits("ILS")).toBe(2);
    expect(minorUnitDigits("EUR")).toBe(2);
    expect(minorUnitDigits("GBP")).toBe(2);
  });

  it("handles currencies that are not 100 minor units", () => {
    // Assuming 100 everywhere overstates a yen amount by 100x.
    expect(minorUnitDigits("JPY")).toBe(0);
    expect(minorUnitDigits("KWD")).toBe(3);
  });

  it("falls back to 2 for an unknown code rather than throwing", () => {
    expect(minorUnitDigits("XXX")).toBe(2);
  });
});

describe("isSupportedCurrency", () => {
  it("accepts well-formed ISO 4217 codes", () => {
    expect(isSupportedCurrency("ILS")).toBe(true);
    expect(isSupportedCurrency("ils")).toBe(false); // must be canonical upper-case
  });

  it("rejects malformed codes", () => {
    expect(isSupportedCurrency("")).toBe(false);
    expect(isSupportedCurrency("SHEKEL")).toBe(false);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -- src/lib/countries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 6: Create `src/lib/countries.ts`**

```ts
import "server-only";
import { db } from "./db";

/**
 * Country access. There is deliberately no hardcoded country list anywhere in
 * the codebase — a country is a row, and adding one is an admin action rather
 * than a release.
 */

export function getActiveCountries() {
  return db.country.findMany({ where: { isActive: true }, orderBy: { nameEn: "asc" } });
}

export function getCountry(code: string) {
  return db.country.findUnique({ where: { code } });
}

/** Well-formed canonical ISO 4217: exactly three upper-case letters. */
export function isSupportedCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/**
 * How many minor units make one major unit, as a digit count.
 *
 * Not every currency is 100 — JPY has no minor unit, KWD has 1000. Hardcoding
 * 100 would overstate a yen amount by 100x, so this is read from Intl rather
 * than assumed.
 */
export function minorUnitDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}
```

**Note:** `isSupportedCurrency` and `minorUnitDigits` are pure and must not be
behind `server-only`. If the vitest `server-only` alias shim (configured in
`vitest.config.ts`) does not neutralise the import, move those two functions to
`src/lib/money.ts` in Task 5 and re-point the test.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- src/lib/countries.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts src/lib/countries.ts src/lib/countries.test.ts
git commit -m "feat(countries): add data-driven Country model, seeded with Israel"
```

---

### Task 4: Exchange rates

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/money.ts`
- Create: `src/lib/money.test.ts`
- Create: `src/app/api/cron/refresh-exchange-rates/route.ts`
- Modify: `vercel.json` (cron schedule) — create it if absent

**Interfaces:**
- Consumes: `minorUnitDigits` (Task 3)
- Produces:
  - `formatMoney(minor: number, currency: string, locale: string): string`
  - `convert(minor: number, from: string, to: string, rate: number): number`
  - `RATE_STALE_MS` constant

- [ ] **Step 1: Add the model**

```prisma
model ExchangeRate {
  base      String                        // "EUR"
  quote     String                        // "ILS"
  rate      Decimal  @db.Decimal(18, 8)
  fetchedAt DateTime

  @@id([base, quote])
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatMoney, convert, isRateStale } from "./money";

describe("formatMoney", () => {
  it("renders minor units as a currency amount", () => {
    expect(formatMoney(29900, "ILS", "he")).toContain("299");
    expect(formatMoney(180000, "EUR", "en")).toContain("1,800");
  });

  it("respects currencies that are not 100 minor units", () => {
    // 5000 yen is ¥5,000 — not ¥50.
    expect(formatMoney(5000, "JPY", "en")).toContain("5,000");
  });
});

describe("convert", () => {
  it("converts between currencies with the same minor-unit scale", () => {
    // €1,800.00 at 4.0 ILS/EUR = ₪7,200.00
    expect(convert(180000, "EUR", "ILS", 4)).toBe(720000);
  });

  it("rescales when the minor-unit digits differ", () => {
    // ¥10,000 (0 digits) at 0.025 EUR/JPY = €250.00 → 25000 minor units
    expect(convert(10000, "JPY", "EUR", 0.025)).toBe(25000);
  });

  it("rounds to the nearest minor unit rather than truncating", () => {
    expect(convert(100, "EUR", "ILS", 3.999)).toBe(400);
  });

  it("is a no-op when the currencies match", () => {
    expect(convert(29900, "ILS", "ILS", 1)).toBe(29900);
  });
});

describe("isRateStale", () => {
  it("accepts a rate fetched today", () => {
    expect(isRateStale(new Date("2026-08-20T09:00:00Z"), new Date("2026-08-20T12:00:00Z"))).toBe(false);
  });

  it("rejects a rate older than 48 hours", () => {
    expect(isRateStale(new Date("2026-08-17T09:00:00Z"), new Date("2026-08-20T12:00:00Z"))).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/lib/money.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `src/lib/money.ts`**

```ts
import { minorUnitDigits } from "./countries";

/**
 * Money is always an integer count of minor units plus an ISO 4217 code.
 *
 * Floats accumulate drift across repeated billing, and a fractional agora that
 * rounds the wrong way becomes a real mischarge. Integers in the smallest unit
 * are the only representation that can't drift.
 */

/** A rate older than this is not trusted for display. */
export const RATE_STALE_MS = 48 * 60 * 60 * 1000;

export function isRateStale(fetchedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - fetchedAt.getTime() > RATE_STALE_MS;
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  const digits = minorUnitDigits(currency);
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    minor / 10 ** digits,
  );
}

/**
 * Converts between currencies, rescaling when their minor-unit digits differ.
 *
 * Rounds rather than truncates: truncation biases every conversion downward,
 * which across a list of quotes systematically understates the more expensive
 * ones.
 */
export function convert(minor: number, from: string, to: string, rate: number): number {
  if (from === to) return minor;
  const major = minor / 10 ** minorUnitDigits(from);
  return Math.round(major * rate * 10 ** minorUnitDigits(to));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/lib/money.test.ts`
Expected: PASS.

- [ ] **Step 6: Create the cron route**

Create `src/app/api/cron/refresh-exchange-rates/route.ts`, following the auth
pattern in `src/app/api/cron/retry-notifications/route.ts:17-20` exactly:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily FX refresh, kept as its own cron rather than folded into an existing
 * one: a failed rate fetch must never take down subscription renewal.
 *
 * Quotes are always STORED in the currency the clinic named. These rates are
 * for display only — converting at save time would commit the platform to a
 * price it doesn't control.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const currencies = (
    await db.country.findMany({ where: { isActive: true }, select: { currency: true } })
  ).map((c) => c.currency);
  const unique = [...new Set(currencies)];
  if (unique.length < 2) {
    return NextResponse.json({ ok: true, skipped: "fewer than two active currencies" });
  }

  const res = await fetch(
    `https://api.frankfurter.app/latest?base=${unique[0]}&symbols=${unique.slice(1).join(",")}`,
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, status: res.status }, { status: 502 });
  }

  const { rates } = (await res.json()) as { rates: Record<string, number> };
  const fetchedAt = new Date();

  for (const [quote, rate] of Object.entries(rates)) {
    await db.exchangeRate.upsert({
      where: { base_quote: { base: unique[0], quote } },
      update: { rate, fetchedAt },
      create: { base: unique[0], quote, rate, fetchedAt },
    });
  }

  return NextResponse.json({ ok: true, base: unique[0], count: Object.keys(rates).length });
}
```

**Note:** `frankfurter.app` is free, keyless, and ECB-sourced. It does not cover
every currency (TRY is present; some emerging-market currencies are not). If a
needed currency is missing, swap the provider — the storage shape does not
change. Log and skip a currency the provider omits rather than failing the run.

- [ ] **Step 7: Register the cron schedule**

Add to `vercel.json` (create the file if it does not exist, merging with any
existing `crons` array):

```json
{
  "crons": [{ "path": "/api/cron/refresh-exchange-rates", "schedule": "0 4 * * *" }]
}
```

- [ ] **Step 8: Apply the migration and commit**

```bash
npx prisma migrate dev --name exchange_rates
npm test && npm run build
git add prisma/schema.prisma prisma/migrations src/lib/money.ts src/lib/money.test.ts src/app/api/cron/refresh-exchange-rates/route.ts vercel.json
git commit -m "feat(money): add multi-currency helpers and a daily FX refresh cron"
```

---

### Task 5: Money migration M1 — add the new columns

Additive only. Nothing reads the new columns yet, so this is safe to deploy on
its own and trivially reversible.

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add nullable columns alongside the existing ones**

```prisma
// Quote
  amountMinor Int?
  currency    String?

// ClinicSubscription
  priceMinor Int?
  currency   String?

// SubscriptionCharge
  amountMinor Int?
  currency    String?
```

Leave `amountILS` / `priceILS` exactly as they are. Both live side by side
until M4.

- [ ] **Step 2: Apply and verify nothing broke**

```bash
npx prisma migrate dev --name money_m1_add_columns
npm test && npm run build
```
Expected: all green — no code reads the new columns yet.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(money): M1 — add nullable minor-unit columns beside the ILS ones"
```

---

### Task 6: Money migration M2 — backfill

**Files:**
- Create: `prisma/migrations/<timestamp>_money_m2_backfill/migration.sql`
- Create: `src/lib/money-backfill.integration.test.ts`

**The multiplier is 100 and this is verified, not assumed.** `src/lib/payplus.ts:45`
sends `amount: args.amountILS` with `currency_code: "ILS"`, and
`SUBSCRIPTION_PLANS.MONTHLY.priceILS` is `299` — whole shekels. A wrong
multiplier here is a 100x error on a real customer charge.

- [ ] **Step 1: Write the backfill migration by hand**

```bash
npx prisma migrate dev --create-only --name money_m2_backfill
```

Replace the generated (empty) SQL with:

```sql
-- Backfill minor units from the whole-shekel columns. Verified whole shekels:
-- payplus.ts sends amountILS directly as `amount` with currency_code "ILS".
UPDATE "Quote"
   SET "amountMinor" = "amountILS" * 100, "currency" = 'ILS'
 WHERE "amountMinor" IS NULL;

UPDATE "ClinicSubscription"
   SET "priceMinor" = "priceILS" * 100, "currency" = 'ILS'
 WHERE "priceMinor" IS NULL;

UPDATE "SubscriptionCharge"
   SET "amountMinor" = "amountILS" * 100, "currency" = 'ILS'
 WHERE "amountMinor" IS NULL;
```

`WHERE … IS NULL` makes it idempotent — re-running cannot double-multiply.

- [ ] **Step 2: Write the verification test**

Create `src/lib/money-backfill.integration.test.ts`, following the pattern of
the existing `*.integration.test.ts` files:

```ts
import { describe, it, expect } from "vitest";
import { db } from "./db";

/**
 * Guards the M2 backfill. A wrong multiplier here is a 100x error on a real
 * charge, so this asserts the invariant directly against the database rather
 * than trusting the migration ran correctly.
 */
describe("money backfill", () => {
  it("leaves no ILS row without its minor-unit twin", async () => {
    const quotes = await db.quote.findMany({
      where: { amountMinor: null },
      select: { id: true },
    });
    expect(quotes).toEqual([]);
  });

  it("keeps minor units exactly 100x the shekel column", async () => {
    const rows = await db.quote.findMany({
      select: { amountILS: true, amountMinor: true, currency: true },
    });
    for (const r of rows) {
      expect(r.amountMinor).toBe(r.amountILS * 100);
      expect(r.currency).toBe("ILS");
    }
  });
});
```

- [ ] **Step 3: Apply and run**

```bash
npx prisma migrate dev
npm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations src/lib/money-backfill.integration.test.ts
git commit -m "feat(money): M2 — backfill minor units from the shekel columns"
```

---

### Task 7: Money migration M3 — switch reads and writes

The behavioural cut-over. After this the app uses only the new columns; the old
ones remain populated but unread, so reverting is a code revert with no data
loss.

**Files:**
- Modify: `src/lib/constants.ts` (`SUBSCRIPTION_PLANS`)
- Modify: `src/lib/payplus.ts:32,45,49,83,94,102,161,172`
- Modify: `src/server/billing-actions.ts`
- Modify: `src/app/api/cron/renew-subscriptions/route.ts:48,72,99`
- Modify: `src/app/api/webhooks/payplus/route.ts`
- Modify: `src/app/admin/page.tsx:27,44,52`
- Modify: `src/app/admin/subscriptions/page.tsx:26,64`
- Modify: `src/components/quote/quote-form.tsx`
- Modify: `src/app/quote/[token]/page.tsx`
- Modify: `src/lib/subscription.test.ts`, `src/lib/payplus.test.ts`, `src/app/api/cron/renew-subscriptions/route.integration.test.ts`

- [ ] **Step 1: Convert the plan constants to minor units**

```ts
export const SUBSCRIPTION_PLANS = {
  MONTHLY: { priceMinor: 29900, currency: "ILS", intervalMonths: 1, labelHe: "חודשי" },
  YEARLY: { priceMinor: 199000, currency: "ILS", intervalMonths: 12, labelHe: "שנתי" },
} as const;
```

- [ ] **Step 2: Convert at the PayPlus boundary only**

PayPlus expects whole shekels. Keep that conversion in one place, at the edge —
if minor units leak into the request body every clinic is charged 100x.

In `src/lib/payplus.ts`, rename the argument fields to `amountMinor` /
`currency` and convert on the way out:

```ts
// PayPlus takes major units. This division is the ONLY place minor units
// become shekels — leaking amountMinor into the request body would charge
// every clinic 100x.
const amountMajor = args.amountMinor / 10 ** minorUnitDigits(args.currency);
// …
amount: amountMajor,
currency_code: args.currency,
items: [{ name: `מנוי DentalCompare (${args.planLabelHe})`, quantity: 1, price: amountMajor }],
```

- [ ] **Step 3: Update every display site to `formatMoney`**

Replace hand-built strings like `` `${totalRevenue.toLocaleString("he-IL")} ₪` ``
(`src/app/admin/page.tsx:52`) and `` `{s.priceILS} ₪` ``
(`src/app/admin/subscriptions/page.tsx:64`) with
`formatMoney(minor, currency, locale)`. The currency symbol comes from the data,
never from a literal `₪`.

- [ ] **Step 4: Update the affected tests**

`src/lib/subscription.test.ts`, `src/lib/payplus.test.ts` and
`src/app/api/cron/renew-subscriptions/route.integration.test.ts:53` all
reference `priceILS: 299`. Change to `priceMinor: 29900, currency: "ILS"` and
assert PayPlus still receives `amount: 299`.

- [ ] **Step 5: Run everything**

```bash
npm test && npm run build
grep -rn "amountILS\|priceILS" src
```
Expected: tests green; the grep returns **no results in `src/`** (the columns
survive in `prisma/schema.prisma` only, until M4).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(money): M3 — read and write minor units, convert only at the PayPlus edge"
```

---

### Task 8: Per-country insurers

**Files:**
- Modify: `src/lib/constants.ts` (remove `HMO_OPTIONS`, `HMO` type)
- Modify: `src/lib/labels.ts` (`HMO_LABELS_HE` → `INSURER_LABELS_HE`)
- Modify: `prisma/schema.prisma` (`hmoAffiliations` → `insurerAffiliations`)
- Modify: `src/components/clinics/registration-form.tsx`
- Modify: `src/components/dentists/filter-bar.tsx`
- Modify: `src/components/admin/new-dentist-form.tsx`

- [ ] **Step 1: Rename the column, preserving data**

```bash
npx prisma migrate dev --create-only --name insurer_affiliations
```

Replace the generated SQL — Prisma renders a rename as drop-then-add, which
would **destroy every clinic's affiliations**:

```sql
ALTER TABLE "Dentist" RENAME COLUMN "hmoAffiliations" TO "insurerAffiliations";
```

- [ ] **Step 2: Source the options from the country**

In the three forms, replace the `HMO_OPTIONS` import with the insurer list from
the selected country's `Country.insurers`. Israel's values are unchanged
(`Clalit`, `Maccabi`, `Meuhedet`, `Leumit`), so `INSURER_LABELS_HE` keeps
mapping them to the same Hebrew labels and **no existing clinic loses data**.

Where a country has an empty `insurers` array, hide the field entirely rather
than rendering an empty select.

- [ ] **Step 3: Verify and commit**

```bash
npm test && npm run build
git add -A
git commit -m "feat(countries): source clinic insurers from the country, not a hardcoded HMO list"
```

---

### Task 9: Quote comparison fields

Across borders the price alone lies: £3,200 over two trips costs more than
£4,000 over one. These are the four dimensions that make the comparison honest.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/constants.ts` (add `QUOTE_INCLUSIONS`)
- Modify: `src/lib/labels.ts`
- Modify: `src/components/quote/quote-form.tsx`
- Modify: `src/lib/quotes.test.ts`

- [ ] **Step 1: Add the fields**

```prisma
// --- Quote: cross-border comparison ---
  // Canonical keys; labels live in the i18n layer.
  includes          String[]
  tripsRequired     Int      @default(1)
  daysPerTrip       Int      @default(1)
  weeksBetweenTrips Int?     // null when a single trip is enough
  warrantyYears     Int?
  warrantyNote      String?  @db.Text
```

Defaults of `1` keep existing single-country quotes valid without a backfill.

- [ ] **Step 2: Add the canonical inclusion keys**

```ts
// What a quote covers. Canonical keys — Hebrew/English labels live in i18n.
export const QUOTE_INCLUSIONS = [
  "XRAYS",
  "ANESTHESIA",
  "TEMP_CROWN",
  "FOLLOW_UP",
  "AIRPORT_TRANSFER",
  "ACCOMMODATION",
] as const;

export type QuoteInclusion = (typeof QUOTE_INCLUSIONS)[number];
```

- [ ] **Step 3: Extend the quote form**

In `src/components/quote/quote-form.tsx`, add: an inclusion checkbox group, a
trips number input, days-per-trip, a conditional weeks-between-trips (shown only
when `tripsRequired > 1`), warranty years, and a warranty note textarea.

**Do not add a flight-cost field.** Per spec §2.3 the platform shows trip counts
and lets the patient price their own travel; an estimate that goes stale
destroys trust in the whole comparison.

- [ ] **Step 4: Verify and commit**

```bash
npx prisma migrate dev --name quote_comparison_fields
npm test && npm run build
git add -A
git commit -m "feat(quotes): capture inclusions, trips, and warranty for cross-border comparison"
```

---

### Task 10: The locale layer

Largest task by file count (77 files hold Hebrew), lowest risk per file. Split
into four commits so review stays tractable.

**Files:**
- Create: `src/i18n/config.ts`, `src/i18n/dictionaries/he.ts`, `src/i18n/dictionaries/en.ts`, `src/i18n/get-dictionary.ts`, `src/i18n/provider.tsx`
- Create: `src/lib/locale-negotiation.ts`, `src/lib/locale-negotiation.test.ts`
- Create: `src/i18n/dictionaries.test.ts`
- Create: `src/components/ui/forward-arrow.tsx`
- Modify: `src/middleware.ts`, `src/app/layout.tsx`
- Move: all of `src/app/*` except `api/` into `src/app/[locale]/`

**Interfaces:**
- Consumes: the `clerkMiddleware()` wrapper from Task 1
- Produces: `getDictionary(locale)`, `useT()`, `<ForwardArrow />`, `negotiateLocale(cookie, acceptLanguage)`

- [ ] **Step 10a: Locale plumbing and the `[locale]/` move**

1. `src/i18n/config.ts`:

```ts
export const locales = ["he", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "he";
export const dir: Record<Locale, "rtl" | "ltr"> = { he: "rtl", en: "ltr" };

export function isLocale(v: string): v is Locale {
  return (locales as readonly string[]).includes(v);
}
```

2. `src/lib/locale-negotiation.ts` — pure, so it is testable without a request:

```ts
import { defaultLocale, isLocale, locales, type Locale } from "@/i18n/config";

/** cookie wins over the browser header, which wins over the default. */
export function negotiateLocale(
  cookie: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (cookie && isLocale(cookie)) return cookie;

  for (const part of acceptLanguage?.split(",") ?? []) {
    const tag = part.split(";")[0]!.trim().toLowerCase().split("-")[0]!;
    if (isLocale(tag)) return tag;
  }
  return defaultLocale;
}

/**
 * True for a first segment that looks like a language code but isn't one we
 * serve. Those get a 404 — redirecting /de/x to /he/de/x would 404 anyway, at a
 * misleading URL, hiding the broken link.
 */
export function isUnsupportedLocaleSegment(segment: string): boolean {
  return /^[a-z]{2}$/.test(segment) && !isLocale(segment);
}
```

3. Test it (`src/lib/locale-negotiation.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { negotiateLocale, isUnsupportedLocaleSegment } from "./locale-negotiation";

describe("negotiateLocale", () => {
  it("prefers the cookie over the browser header", () => {
    expect(negotiateLocale("en", "he-IL,he;q=0.9")).toBe("en");
  });

  it("falls back to the browser header when there is no cookie", () => {
    expect(negotiateLocale(undefined, "en-GB,en;q=0.9")).toBe("en");
  });

  it("falls back to Hebrew for an unsupported language", () => {
    expect(negotiateLocale(undefined, "de-DE,de;q=0.9")).toBe("he");
    expect(negotiateLocale(undefined, null)).toBe("he");
  });

  it("ignores a malformed cookie rather than trusting it", () => {
    expect(negotiateLocale("klingon", "en-GB")).toBe("en");
  });
});

describe("isUnsupportedLocaleSegment", () => {
  it("flags a language-shaped segment we don't serve", () => {
    expect(isUnsupportedLocaleSegment("de")).toBe(true);
  });

  it("does not flag supported locales or ordinary paths", () => {
    expect(isUnsupportedLocaleSegment("he")).toBe(false);
    expect(isUnsupportedLocaleSegment("request")).toBe(false);
  });
});
```

4. Move every directory under `src/app/` **except `api/`** into
   `src/app/[locale]/`. Use `git mv` so history follows.
5. Split `src/app/layout.tsx`: the root keeps only `<html><body>{children}`;
   `[locale]/layout.tsx` takes the fonts, `ClerkProvider`, `Toaster`, and sets
   `lang={locale} dir={dir[locale]}` with Clerk's `heIL`/`enUS`.
6. Extend `src/middleware.ts` with the negotiation, keeping the
   `clerkMiddleware()` wrapper from Task 1 intact.

**Re-run the Task 1 Clerk smoke test after this step.** Moving the
`ClerkProvider` between layouts is the second-most likely way to break auth.

Commit: `refactor(i18n): move pages under [locale] and negotiate locale in middleware`

- [ ] **Step 10b: The dictionary and the marketing pages**

Build `he.ts` from the strings currently in `components/sections/*`,
`components/shared/header.tsx`, `footer.tsx`, and the five legal pages. Write
`en.ts` as `const en: typeof he = { … }` — **English copy written natively, not
translated literally.**

Add `src/i18n/dictionaries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import he from "./dictionaries/he";
import en from "./dictionaries/en";

/**
 * TypeScript already fails the build on a missing key (en is typed `typeof he`).
 * This catches what types cannot: a key that exists but was left empty.
 */
function emptyPaths(obj: unknown, path = ""): string[] {
  if (typeof obj === "string") return obj.trim() ? [] : [path];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => emptyPaths(v, `${path}[${i}]`));
  if (obj && typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) => emptyPaths(v, path ? `${path}.${k}` : k));
  }
  return [];
}

describe("dictionaries", () => {
  it("has no empty strings in Hebrew", () => {
    expect(emptyPaths(he)).toEqual([]);
  });

  it("has no empty strings in English", () => {
    expect(emptyPaths(en)).toEqual([]);
  });
});
```

Add `<ForwardArrow />` and replace the ~10 `ArrowLeft` "next" arrows:

```tsx
"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocale } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * The "next" arrow. ArrowLeft points forward in Hebrew and backward in English,
 * so the icon and its hover nudge both flip with the locale.
 */
export function ForwardArrow({ className }: { className?: string }) {
  const locale = useLocale();
  const Icon = locale === "he" ? ArrowLeft : ArrowRight;
  const nudge = locale === "he" ? "group-hover:-translate-x-1" : "group-hover:translate-x-1";
  return <Icon className={cn("transition-transform", nudge, className)} />;
}
```

Fix the three directional classes: `request/[id]/page.tsx:158` `mr-2`→`me-2`,
`legal/legal-layout.tsx:61` `pr-5`→`ps-5`, `request/explain-treatment.tsx:102`
`border-r-2 pr-3`→`border-s-2 ps-3`.

Commit: `feat(i18n): translate marketing pages, header, footer and legal pages`

- [ ] **Step 10c: The patient journey and emails**

Extract strings from `app/[locale]/request/**`, `dashboard`, `verify-phone`,
`components/request/**`, `components/upload/**`, `components/dentists/**`.

Split `src/server/emails/templates.ts` into `emails/he.ts` + `emails/en.ts`;
each sender reads the recipient's `locale` (added in Task 3). Extend
`src/server/emails/templates.test.ts` to cover both languages.

Pass `locale` into the Claude prompt in `src/server/explain-treatment.ts` so the
medical explanation comes back in the reader's language.

Make `src/lib/labels.ts` locale-aware: `getLabels(locale)`. The English side is
nearly identity — the DB already stores canonical English (`Implants`,
`Clalit`).

Commit: `feat(i18n): translate the patient journey and outgoing emails`

- [ ] **Step 10d: Clinics, admin, and SEO**

Extract the remaining strings from `app/[locale]/clinics/**`,
`app/[locale]/admin/**`, `components/clinics/**`, `components/admin/**`.

Add `generateMetadata` per page with `alternates.languages` (`he-IL`, `en`,
`x-default` → `he`) and the correct `openGraph.locale`. Emit both locales in the
sitemap.

Final verification:

```bash
npm test && npm run build
grep -rlP '[\x{0590}-\x{05FF}]' src --include=*.tsx | grep -v i18n
```
Expected: tests green; the grep returns **only** `src/i18n/dictionaries/he.ts`
and `src/server/emails/he.ts`. Anything else is an un-extracted string.

Commit: `feat(i18n): translate clinic and admin areas, add hreflang metadata`

---

## Deferred: M4

Dropping `amountILS` / `priceILS` is **not in this plan**. It is the one
irreversible step, and per spec §5 it runs only after a week of stable
production on the new columns. Track it separately.

---

## Self-Review

**Spec coverage:** §3.1 Country → Task 3. §3.2 phone → Task 2. §3.3 money →
Tasks 4–7. §3.4 insurers → Task 8. §3.5 quote fields → Task 9. §3.6 locale
layer → Task 10. §3.7 middleware → Tasks 1 and 10a. §5 migration M1–M3 → Tasks
5–7; M4 explicitly deferred. §7 testing → tests in Tasks 2, 3, 4, 6, 10a, 10b,
10c.

**Known deviation from the spec:** the spec's §8 rollout put the middleware
first and `[locale]/` last, which would 404 the entire site in between. This
plan splits the middleware into a pass-through wrapper (Task 1) and the locale
logic (Task 10a). **Update spec §8 to match.**

**Type consistency:** `normalizePhone` / `formatPhoneForDisplay` used
identically in Tasks 2 and 10c. `minorUnitDigits` defined in Task 3, consumed in
Tasks 4 and 7. `formatMoney(minor, currency, locale)` — same signature in Tasks
4 and 7. `Country.insurers` defined in Task 3, consumed in Task 8.
`QUOTE_INCLUSIONS` defined and consumed within Task 9.
