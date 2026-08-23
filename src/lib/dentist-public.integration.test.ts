import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import { destinationCountryCodes } from "./travel-scope";
import { PUBLIC_DENTIST_SELECT, publicDentistWhere } from "./dentist-public";

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

async function seedClinicIn(countryCode: string) {
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
    },
  });
  await db.clinicSubscription.create({
    data: {
      dentistId: dentist.id,
      plan: "MONTHLY",
      status: "ACTIVE",
      priceMinor: 29900,
      currency: "ILS",
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
});
