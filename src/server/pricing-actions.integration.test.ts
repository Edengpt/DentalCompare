import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
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
  const ADMIN_EMAIL = "pricing-admin-test@example.com";
  let originalAdminEmails: string | undefined;
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
    // requireAdmin checks the signed-in user's email against ADMIN_EMAILS. The
    // suite puts its own address on that list rather than borrowing whatever a
    // developer's .env.local happens to hold: in CI the variable is unset, and
    // every test here was being redirected away as a non-admin.
    originalAdminEmails = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = [originalAdminEmails, ADMIN_EMAIL].filter(Boolean).join(",");
    const admin = await db.user.upsert({
      where: { clerkUserId: "pricing_admin_test" },
      create: { clerkUserId: "pricing_admin_test", fullName: "Admin", email: ADMIN_EMAIL },
      update: { email: ADMIN_EMAIL },
    });
    authState.clerkUserId = admin.clerkUserId;
    originalPayplusBasicRow = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
    });
  }, DB_TIMEOUT);

  afterAll(() => {
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
  });

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

  it("saves an empty monthlyRequestCap as null (unlimited), not 0", async () => {
    const result = await updatePricing(formData({ ...BASIC_FIELDS, monthlyRequestCap: "" }));
    expect(result.ok).toBe(true);
    const row = await db.subscriptionPricing.findUniqueOrThrow({
      where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
    });
    expect(row.monthlyRequestCap).toBeNull();
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
