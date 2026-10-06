import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { attachCapStatus as AttachCapStatusFn } from "./dentist-cap";
import { PUBLIC_DENTIST_SELECT } from "@/lib/dentist-public";

// Lazy, typed imports for both db and the function under test — not just db
// — so this file never triggers @/lib/db's module-scope DATABASE_URL guard
// merely by being collected. This mirrors the pattern already used in
// src/server/request-usage.integration.test.ts and others in this repo.
const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let attachCapStatus: typeof AttachCapStatusFn;

const TEST_COUNTRY = "QW";
const created = { dentistIds: [] as string[] };

async function seedClinic(monthlyRequestCap: number | null) {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `cap_${sfx}@example.com`,
      phone: "+972500000000",
      city: "Somewhere",
      address: "1 Main St",
      experienceYears: 10,
      countryCode: TEST_COUNTRY,
      isActive: true,
      licenceVerifiedAt: new Date(),
      licenceVerifiedBy: "admin@example.com",
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
      setupToken: randomUUID(),
      monthlyRequestCap,
    },
  });
  created.dentistIds.push(dentist.id);
  return dentist;
}

describe.skipIf(!hasDb)("attachCapStatus", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ attachCapStatus } = await import("./dentist-cap"));
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

  it("a clinic with no cap (null) is never at cap, regardless of usage", async () => {
    const clinic = await seedClinic(null);
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
    const clinic = await seedClinic(10);
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
    const clinic = await seedClinic(10);
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
    const clinic = await seedClinic(3);

    const [dentist] = await db.dentist.findMany({
      where: { id: clinic.id },
      select: PUBLIC_DENTIST_SELECT,
    });
    const [withStatus] = await attachCapStatus([dentist]);
    expect(withStatus.isAtCap).toBe(false);

    await db.dentist.delete({ where: { id: clinic.id } });
  });

  it("computes each clinic's status independently — no cross-contamination", async () => {
    const under = await seedClinic(10);
    const over = await seedClinic(2);
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
