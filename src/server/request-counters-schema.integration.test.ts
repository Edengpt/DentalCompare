import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
const created = { dentistIds: [] as string[] };

describe.skipIf(!hasDb)("ClinicSubscription counters and MonthlyRequestUsage", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
  }, DB_TIMEOUT);

  async function seedDentist(): Promise<string> {
    const sfx = randomUUID().slice(0, 8);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `counters_${sfx}@example.com`,
        phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
        city: "Tel Aviv",
        address: "1 Main St",
        experienceYears: 5,
      },
    });
    created.dentistIds.push(dentist.id);
    return dentist.id;
  }

  it("a raw ClinicSubscription insert defaults trialRequestCap to 5 and verifiedRequestCount to 0", async () => {
    const dentistId = await seedDentist();
    const sub = await db.clinicSubscription.create({
      data: {
        dentistId,
        plan: "MONTHLY",
        priceMinor: 29900,
        currency: "ILS",
        trialDays: 60,
        setupToken: randomUUID(),
      },
    });
    expect(sub.trialRequestCap).toBe(5);
    expect(sub.verifiedRequestCount).toBe(0);
  });

  it("MonthlyRequestUsage upserts by (dentistId, yearMonth)", async () => {
    const dentistId = await seedDentist();
    await db.monthlyRequestUsage.create({ data: { dentistId, yearMonth: "2026-09", count: 1 } });
    const updated = await db.monthlyRequestUsage.update({
      where: { dentistId_yearMonth: { dentistId, yearMonth: "2026-09" } },
      data: { count: { increment: 1 } },
    });
    expect(updated.count).toBe(2);

    const other = await db.monthlyRequestUsage.create({
      data: { dentistId, yearMonth: "2026-10", count: 1 },
    });
    expect(other.count).toBe(1);
  });

  it("deleting the dentist cascades to its MonthlyRequestUsage rows", async () => {
    const dentistId = await seedDentist();
    await db.monthlyRequestUsage.create({ data: { dentistId, yearMonth: "2026-09", count: 3 } });
    await db.dentist.delete({ where: { id: dentistId } });
    created.dentistIds = created.dentistIds.filter((id) => id !== dentistId);
    const rows = await db.monthlyRequestUsage.findMany({ where: { dentistId } });
    expect(rows).toHaveLength(0);
  });
});
