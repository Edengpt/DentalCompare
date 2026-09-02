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
    // Submit a currency different from the row's real one (ILS): if
    // updatePricing ever started reading `currency` from the form, this
    // would flip the row to USD and the assertion below would catch it.
    await updatePricing(
      formData({
        provider: "PAYPLUS",
        monthlyPriceMajor: "350",
        yearlyPriceMajor: "2200",
        trialDays: "45",
        currency: "USD",
      }),
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
