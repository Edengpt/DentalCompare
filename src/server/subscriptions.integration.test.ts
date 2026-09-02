import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { createPendingSubscription as CreatePendingFn } from "@/server/subscriptions";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let createPendingSubscription: typeof CreatePendingFn;
const created = { dentistIds: [] as string[] };

describe.skipIf(!hasDb)("createPendingSubscription", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ createPendingSubscription } = await import("@/server/subscriptions"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
  }, DB_TIMEOUT);

  it("stores the exact priceMinor/currency it was given, not a hardcoded value", async () => {
    const sfx = randomUUID().slice(0, 8);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `pend_${sfx}@example.com`,
        phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
        city: "Tel Aviv",
        address: "1 Main St",
        experienceYears: 5,
      },
    });
    created.dentistIds.push(dentist.id);

    await createPendingSubscription({
      dentistId: dentist.id,
      plan: "MONTHLY",
      setupToken: randomUUID(),
      priceMinor: 12345,
      currency: "USD",
    });

    const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId: dentist.id } });
    expect(sub.priceMinor).toBe(12345);
    expect(sub.currency).toBe("USD");
  });
});
