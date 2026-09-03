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
    vi.clearAllMocks();
  }, DB_TIMEOUT);

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
});
