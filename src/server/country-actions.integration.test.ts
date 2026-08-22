import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import type { db as Db } from "@/lib/db";
import type {
  createCountry as CreateFn,
  updateCountry as UpdateFn,
  toggleCountryActive as ToggleFn,
} from "@/server/country-actions";

vi.mock("@/server/admin", () => ({
  requireAdmin: async () => ({ email: "admin@dentalcompare.co.il" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const hasDb = Boolean(process.env.DATABASE_URL);

// Imported lazily (only when a DB is configured) so the suite stays safe — and
// db.ts doesn't throw at import time — in environments without DATABASE_URL.
let db: typeof Db;
let createCountry: typeof CreateFn;
let updateCountry: typeof UpdateFn;
let toggleCountryActive: typeof ToggleFn;

// Codes outside the ISO 3166-1 assigned range, so a test row can never collide
// with a country an admin actually added.
const TEST_CODES = ["QX", "QY", "QZ"];

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const draft = (code: string, overrides: Record<string, string> = {}) =>
  form({
    code,
    nameEn: "Testland",
    currency: "EUR",
    callingCode: "+99",
    defaultLocale: "en",
    insurers: "",
    requiredDocs: "",
    ...overrides,
  });

describe.skipIf(!hasDb)("country admin actions", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ createCountry, updateCountry, toggleCountryActive } =
      await import("@/server/country-actions"));
  });

  afterEach(async () => {
    await db.auditLog.deleteMany({ where: { entity: "Country", entityId: { in: TEST_CODES } } });
    await db.country.deleteMany({ where: { code: { in: TEST_CODES } } });
  });

  it("creates a country as a draft, never active", async () => {
    expect(await createCountry(draft("QX"))).toEqual({ ok: true });

    const row = await db.country.findUnique({ where: { code: "QX" } });
    expect(row?.isActive).toBe(false);
    expect(row?.callingCode).toBe("99"); // the leading + is stripped
  });

  it("records who added the country", async () => {
    await createCountry(draft("QX"));

    const entry = await db.auditLog.findFirst({
      where: { entity: "Country", entityId: "QX", action: "country.create" },
    });
    expect(entry?.actor).toBe("admin@dentalcompare.co.il");
  });

  it("rejects a code that already exists", async () => {
    await createCountry(draft("QX"));
    const second = await createCountry(draft("QX", { nameEn: "Otherland" }));

    expect(second.ok).toBe(false);
    const row = await db.country.findUnique({ where: { code: "QX" } });
    expect(row?.nameEn).toBe("Testland"); // the original survived
  });

  it("names the offending field instead of failing generically", async () => {
    const result = await createCountry(draft("QX", { currency: "EURO" }));

    expect(result.ok).toBe(false);
    // Hebrew is the fallback locale outside a request.
    if (!result.ok) expect(result.error).toContain("מטבע");
    expect(await db.country.findUnique({ where: { code: "QX" } })).toBeNull();
  });

  it("treats the code as an identifier on update, never as an editable field", async () => {
    await createCountry(draft("QX"));
    expect(await updateCountry(draft("QX", { nameEn: "Renamed" }))).toEqual({ ok: true });

    const row = await db.country.findUnique({ where: { code: "QX" } });
    expect(row?.nameEn).toBe("Renamed");
  });

  it("activates a complete draft", async () => {
    await createCountry(draft("QX"));
    expect(await toggleCountryActive("QX")).toEqual({ ok: true });

    const row = await db.country.findUnique({ where: { code: "QX" } });
    expect(row?.isActive).toBe(true);
  });

  // The seed and psql write to this table too, so "valid enough to create" and
  // "valid enough to show users" have to be the same check.
  it("refuses to activate a row that was written around the form", async () => {
    await db.country.create({
      data: {
        code: "QY",
        nameEn: "Halfland",
        currency: "not-a-currency",
        callingCode: "99",
        defaultLocale: "en",
        isActive: false,
      },
    });

    const result = await toggleCountryActive("QY");
    expect(result.ok).toBe(false);

    const row = await db.country.findUnique({ where: { code: "QY" } });
    expect(row?.isActive).toBe(false);
  });

  it("reports a country that isn't there", async () => {
    expect((await toggleCountryActive("QZ")).ok).toBe(false);
  });

  // Switching off the last active country empties getActiveCountries(), and the
  // clinic registration form then demands a country it cannot offer.
  it("refuses to switch off the only active country", async () => {
    const others = await db.country.findMany({ where: { isActive: true }, select: { code: true } });
    await db.country.updateMany({ where: { isActive: true }, data: { isActive: false } });
    await db.country.create({
      data: {
        code: "QX",
        nameEn: "Testland",
        currency: "EUR",
        callingCode: "99",
        defaultLocale: "en",
        isActive: true,
      },
    });

    try {
      const result = await toggleCountryActive("QX");
      expect(result.ok).toBe(false);

      const row = await db.country.findUnique({ where: { code: "QX" } });
      expect(row?.isActive).toBe(true);
    } finally {
      await db.country.updateMany({
        where: { code: { in: others.map((c) => c.code) } },
        data: { isActive: true },
      });
    }
  });

  it("allows switching one off while another stays active", async () => {
    await createCountry(draft("QX"));
    await createCountry(draft("QY"));
    await toggleCountryActive("QX");
    await toggleCountryActive("QY");

    expect(await toggleCountryActive("QY")).toEqual({ ok: true });
    expect((await db.country.findUnique({ where: { code: "QY" } }))?.isActive).toBe(false);
  });
});
