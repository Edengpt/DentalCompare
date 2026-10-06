import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
const created = { dentistIds: [] as string[], userIds: [] as string[], requestIds: [] as string[] };

describe.skipIf(!hasDb)("Quote.status schema", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it("defaults a new quote to PENDING_DECISION with every transition timestamp null", async () => {
    const sfx = randomUUID().slice(0, 8);
    const user = await db.user.create({
      data: { clerkUserId: `qs_${sfx}`, fullName: "T", email: `qs_${sfx}@example.com` },
    });
    created.userIds.push(user.id);
    const request = await db.request.create({
      data: { userId: user.id, treatmentFileUrl: "https://blob/t", xrayFileUrl: "https://blob/x" },
    });
    created.requestIds.push(request.id);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `qsd_${sfx}@example.com`,
        phone: `+9725${Math.floor(Math.random() * 1e8)
          .toString()
          .padStart(8, "0")}`,
        city: "Tel Aviv",
        address: "1 Main St",
        experienceYears: 5,
      },
    });
    created.dentistIds.push(dentist.id);
    const rd = await db.requestDentist.create({
      data: { requestId: request.id, dentistId: dentist.id },
    });
    const quote = await db.quote.create({
      data: { requestDentistId: rd.id, amountMinor: 100000, currency: "ILS" },
    });

    expect(quote.status).toBe("PENDING_DECISION");
    expect(quote.decidedAt).toBeNull();
    expect(quote.rejectedAuto).toBe(false);
    expect(quote.treatmentStartedAt).toBeNull();
    expect(quote.completionRequestedAt).toBeNull();
    expect(quote.completedAt).toBeNull();
  });
});
