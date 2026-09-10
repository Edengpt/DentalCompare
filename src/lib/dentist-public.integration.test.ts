import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import { destinationCountryCodes } from "./travel-scope";
import { PUBLIC_DENTIST_SELECT, publicDentistWhere, attachCapStatus } from "./dentist-public";

/**
 * The query the clinic-selection page runs, exercised against a real database.
 *
 * It is assembled here exactly as the page assembles it. The page has no test
 * of its own — a server component rendering is not something this suite can
 * drive — so this is where the shape of that query is pinned.
 */
function directoryWhere(codes: string[] | null) {
  return { ...publicDentistWhere(), ...(codes ? { countryCode: { in: codes } } : {}) };
}

const hasDb = Boolean(process.env.DATABASE_URL);

// Imported lazily (only when a DB is configured) so the suite stays safe — and
// db.ts doesn't throw at import time — in environments without DATABASE_URL.
let db: typeof Db;

const TEST_COUNTRY = "QW";
const created = { dentistIds: [] as string[] };

async function seedClinicIn(
  countryCode: string,
  opts: { verified?: boolean; monthlyRequestCap?: number | null } = {},
) {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `dir_${sfx}@example.com`,
      phone: "+972500000000",
      city: "Somewhere",
      address: "1 Main St",
      experienceYears: 10,
      countryCode,
      isActive: true,
      // Verified by default: every other test in this file is about something
      // else, and a clinic that reaches a patient is verified by definition now.
      licenceVerifiedAt: opts.verified === false ? null : new Date(),
      licenceVerifiedBy: opts.verified === false ? null : "admin@example.com",
    },
  });
  await db.clinicSubscription.create({
    data: {
      dentistId: dentist.id,
      plan: "MONTHLY",
      status: "ACTIVE",
      priceMinor: 29900,
      currency: "ILS",
      trialDays: 60,
      monthlyRequestCap: opts.monthlyRequestCap,
      setupToken: randomUUID(),
    },
  });
  created.dentistIds.push(dentist.id);
  return dentist;
}

describe.skipIf(!hasDb)("the directory query", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    await db.country.upsert({
      where: { code: TEST_COUNTRY },
      update: { isActive: true },
      create: {
        code: TEST_COUNTRY,
        nameEn: "Testland",
        currency: "EUR",
        callingCode: "99",
        defaultLocale: "en",
        isActive: true,
      },
    });
  });

  it("LOCAL shows only clinics in the patient's own country", async () => {
    const abroad = await seedClinicIn(TEST_COUNTRY);

    const clinics = await db.dentist.findMany({
      where: directoryWhere(destinationCountryCodes("LOCAL", [], "IL")),
      select: PUBLIC_DENTIST_SELECT,
    });

    expect(clinics.every((c) => c.countryCode === "IL")).toBe(true);
    expect(clinics.map((c) => c.id)).not.toContain(abroad.id);

    await db.dentist.delete({ where: { id: abroad.id } });
  });

  it("SELECTED shows the chosen country and not the patient's own", async () => {
    const abroad = await seedClinicIn(TEST_COUNTRY);

    const clinics = await db.dentist.findMany({
      where: directoryWhere(destinationCountryCodes("SELECTED", [TEST_COUNTRY], "IL")),
      select: PUBLIC_DENTIST_SELECT,
    });

    expect(clinics.map((c) => c.id)).toContain(abroad.id);
    expect(clinics.every((c) => c.countryCode === TEST_COUNTRY)).toBe(true);

    await db.dentist.delete({ where: { id: abroad.id } });
  });

  // The distinction that matters: no condition at all, rather than a condition
  // listing every country that happened to be active when it was built.
  it("ANY adds no country condition whatsoever", () => {
    const where = directoryWhere(destinationCountryCodes("ANY", [], "IL"));
    expect(where).not.toHaveProperty("countryCode");
  });

  // A clinic activated in a country after the request was made still appears,
  // because ANY is read at query time.
  it("ANY picks up a clinic in a country added after the fact", async () => {
    const abroad = await seedClinicIn(TEST_COUNTRY);

    const clinics = await db.dentist.findMany({
      where: directoryWhere(destinationCountryCodes("ANY", [], "IL")),
      select: PUBLIC_DENTIST_SELECT,
    });

    expect(clinics.map((c) => c.id)).toContain(abroad.id);

    await db.dentist.delete({ where: { id: abroad.id } });
  });
  // The gate that carries the platform's promise. It is the same failure mode
  // as the subscription filter: a clinic missing the stamp vanishes with no
  // error anywhere, so it is asserted against the real database rather than
  // trusted to the shape of the where clause.
  it("hides a clinic whose licence was never checked, and shows one whose was", async () => {
    const unchecked = await seedClinicIn(TEST_COUNTRY, { verified: false });
    const checked = await seedClinicIn(TEST_COUNTRY);

    const listed = await db.dentist.findMany({
      where: { ...publicDentistWhere(), id: { in: [unchecked.id, checked.id] } },
      select: { id: true },
    });

    expect(listed.map((d) => d.id)).toEqual([checked.id]);

    await db.dentist.delete({ where: { id: unchecked.id } });
    await db.dentist.delete({ where: { id: checked.id } });
  });
});

describe.skipIf(!hasDb)("attachCapStatus", () => {
  it("a clinic with no cap (null) is never at cap, regardless of usage", async () => {
    const clinic = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: null });
    const yearMonth = new Date().toISOString().slice(0, 7);
    await db.monthlyRequestUsage.create({ data: { dentistId: clinic.id, yearMonth, count: 999 } });

    const [dentist] = await db.dentist.findMany({
      where: { id: clinic.id },
      select: PUBLIC_DENTIST_SELECT,
    });
    const [withStatus] = await attachCapStatus([dentist]);
    expect(withStatus.isAtCap).toBe(false);

    await db.dentist.delete({ where: { id: clinic.id } });
  });

  it("a clinic under its cap is not at cap", async () => {
    const clinic = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: 10 });
    const yearMonth = new Date().toISOString().slice(0, 7);
    await db.monthlyRequestUsage.create({ data: { dentistId: clinic.id, yearMonth, count: 3 } });

    const [dentist] = await db.dentist.findMany({
      where: { id: clinic.id },
      select: PUBLIC_DENTIST_SELECT,
    });
    const [withStatus] = await attachCapStatus([dentist]);
    expect(withStatus.isAtCap).toBe(false);

    await db.dentist.delete({ where: { id: clinic.id } });
  });

  it("a clinic at or over its cap is at cap", async () => {
    const clinic = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: 10 });
    const yearMonth = new Date().toISOString().slice(0, 7);
    await db.monthlyRequestUsage.create({ data: { dentistId: clinic.id, yearMonth, count: 10 } });

    const [dentist] = await db.dentist.findMany({
      where: { id: clinic.id },
      select: PUBLIC_DENTIST_SELECT,
    });
    const [withStatus] = await attachCapStatus([dentist]);
    expect(withStatus.isAtCap).toBe(true);

    await db.dentist.delete({ where: { id: clinic.id } });
  });

  it("a clinic with a cap but no MonthlyRequestUsage row yet is not at cap (treated as 0 used)", async () => {
    const clinic = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: 3 });

    const [dentist] = await db.dentist.findMany({
      where: { id: clinic.id },
      select: PUBLIC_DENTIST_SELECT,
    });
    const [withStatus] = await attachCapStatus([dentist]);
    expect(withStatus.isAtCap).toBe(false);

    await db.dentist.delete({ where: { id: clinic.id } });
  });

  it("computes each clinic's status independently — no cross-contamination", async () => {
    const under = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: 10 });
    const over = await seedClinicIn(TEST_COUNTRY, { monthlyRequestCap: 2 });
    const yearMonth = new Date().toISOString().slice(0, 7);
    await db.monthlyRequestUsage.create({ data: { dentistId: under.id, yearMonth, count: 1 } });
    await db.monthlyRequestUsage.create({ data: { dentistId: over.id, yearMonth, count: 2 } });

    const dentists = await db.dentist.findMany({
      where: { id: { in: [under.id, over.id] } },
      select: PUBLIC_DENTIST_SELECT,
    });
    const withStatus = await attachCapStatus(dentists);
    expect(withStatus.find((d) => d.id === under.id)!.isAtCap).toBe(false);
    expect(withStatus.find((d) => d.id === over.id)!.isAtCap).toBe(true);

    await db.dentist.delete({ where: { id: under.id } });
    await db.dentist.delete({ where: { id: over.id } });
  });

  it("returns an empty array for an empty input without querying", async () => {
    const result = await attachCapStatus([]);
    expect(result).toEqual([]);
  });
});
