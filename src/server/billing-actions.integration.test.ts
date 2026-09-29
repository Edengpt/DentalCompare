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

vi.mock("@/lib/payplus", async (orig) => {
  const actual = await orig<typeof import("@/lib/payplus")>();
  return {
    ...actual,
    isPayPlusConfigured: () => true,
    createSubscriptionPaymentPage: vi.fn(async () => ({
      url: "https://payments.payplus.co.il/test-page",
      pageRequestUid: "test-page-request-uid",
    })),
  };
});

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let startPayment: typeof StartPaymentFn;
const created = { dentistIds: [] as string[] };

async function seedPendingSubscription(
  provider: "PAYPLUS" | "STRIPE",
  overrides: {
    status?: "PENDING" | "TRIALING" | "ACTIVE";
    stripeSubscriptionId?: string;
    recurringToken?: string | null;
    free?: boolean;
    founding?: boolean;
  } = {},
) {
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
      status: overrides.status ?? "PENDING",
      stripeSubscriptionId: overrides.stripeSubscriptionId,
      recurringToken: overrides.recurringToken,
      ...(overrides.free ? { tier: "FREE" as const, priceMinor: 0 } : {}),
      ...(overrides.founding
        ? { isFounding: true, priceMinor: 5300, regularPriceMinor: 7900 }
        : {}),
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
    vi.clearAllMocks();
  }, DB_TIMEOUT);

  it("never opens a payment page for the free tier", async () => {
    const { createSubscriptionPaymentPage } = await import("@/lib/payplus");
    const setupToken = await seedPendingSubscription("PAYPLUS", { status: "ACTIVE", free: true });
    const result = await startPayment(setupToken);
    expect(result.ok).toBe(false);
    expect(createSubscriptionPaymentPage).not.toHaveBeenCalled();
  });

  it("bills a founding STRIPE clinic the list price with a coupon for the difference", async () => {
    const { createSubscriptionCheckoutSession } = await import("@/lib/stripe");
    const setupToken = await seedPendingSubscription("STRIPE", { founding: true });
    const result = await startPayment(setupToken);
    expect(result.ok).toBe(true);
    const args = vi.mocked(createSubscriptionCheckoutSession).mock.calls[0][0];
    expect(args.amountMinor).toBe(7900);
    expect(args.discount).toEqual({ amountOffMinor: 2600, months: 14 });
  });

  it("routes a STRIPE subscription to createSubscriptionCheckoutSession, not PayPlus", async () => {
    const { createSubscriptionPaymentPage } = await import("@/lib/payplus");
    const setupToken = await seedPendingSubscription("STRIPE");
    const result = await startPayment(setupToken);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe("https://checkout.stripe.com/test-session");
    expect(createSubscriptionPaymentPage).not.toHaveBeenCalled();
  });

  it("routes a PAYPLUS subscription to createSubscriptionPaymentPage, not Stripe, and persists pageRequestUid", async () => {
    const { createSubscriptionCheckoutSession } = await import("@/lib/stripe");
    const setupToken = await seedPendingSubscription("PAYPLUS");
    const result = await startPayment(setupToken);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe("https://payments.payplus.co.il/test-page");
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();

    const sub = await db.clinicSubscription.findUnique({ where: { setupToken } });
    expect(sub?.pageRequestUid).toBe("test-page-request-uid");
  });

  // Root-cause regression: TRIALING is reached both by mere admin approval
  // (nothing attempted) and by a completed Stripe Checkout (trial genuinely
  // started) — status alone can't tell them apart. A STRIPE row that already
  // has a stripeSubscriptionId has completed payment setup and must be
  // refused, even though its status is TRIALING, not ACTIVE.
  it("refuses a STRIPE subscription that already completed Checkout (TRIALING with stripeSubscriptionId set), not just ACTIVE ones", async () => {
    const setupToken = await seedPendingSubscription("STRIPE", {
      status: "TRIALING",
      stripeSubscriptionId: "sub_already_completed",
    });
    const result = await startPayment(setupToken);
    expect(result.ok).toBe(false);
  });

  // Regression (fix wave 2): an ACTIVE PayPlus row can have a null
  // recurringToken — the return page's own fallback-activation path never
  // receives one, and an admin-created complimentary subscription is created
  // this way directly (see src/server/admin-actions.ts). hasCompletedPaymentSetup
  // alone would say "not set up" here and let the clinic be charged again;
  // status === "ACTIVE" alone must still be sufficient to refuse re-payment.
  it("refuses a PAYPLUS subscription that is ACTIVE with no recurringToken (complimentary/fallback-activated)", async () => {
    const setupToken = await seedPendingSubscription("PAYPLUS", {
      status: "ACTIVE",
      recurringToken: null,
    });
    const result = await startPayment(setupToken);
    expect(result.ok).toBe(false);
  });
});
