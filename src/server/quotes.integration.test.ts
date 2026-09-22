import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { submitQuote as SubmitQuoteFn } from "@/server/quotes";

vi.mock("@/server/quote-notifications", () => ({ sendNewQuoteEmail: async () => true }));

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let submitQuote: typeof SubmitQuoteFn;
const created = { dentistIds: [] as string[], userIds: [] as string[], requestIds: [] as string[] };

async function seedDentist(sfx: string) {
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `sqd_${sfx}@example.com`,
      phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      city: "Tel Aviv",
      address: "1 Main St",
      experienceYears: 5,
    },
  });
  created.dentistIds.push(dentist.id);
  return dentist;
}

async function seed() {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { clerkUserId: `sq_${sfx}`, fullName: "T", email: `sq_${sfx}@example.com` },
  });
  created.userIds.push(user.id);
  const request = await db.request.create({
    data: { userId: user.id, treatmentFileUrl: "https://blob/t", xrayFileUrl: "https://blob/x" },
  });
  created.requestIds.push(request.id);
  const dentist = await seedDentist(sfx);
  const token = randomUUID();
  const rd = await db.requestDentist.create({
    data: { requestId: request.id, dentistId: dentist.id, quoteToken: token },
  });
  return { request, rd, token };
}

describe.skipIf(!hasDb)("submitQuote locking", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ submitQuote } = await import("@/server/quotes"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it("refuses to edit a quote the patient has already approved", async () => {
    const { rd, token } = await seed();
    await db.quote.create({
      data: { requestDentistId: rd.id, amountMinor: 100000, currency: "ILS", status: "APPROVED" },
    });

    const result = await submitQuote({ token, amountMajor: 2000 });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.amountMinor).toBe(100000); // unchanged
  });

  it("still allows editing while PENDING_DECISION", async () => {
    const { rd, token } = await seed();
    await db.quote.create({
      data: { requestDentistId: rd.id, amountMinor: 100000, currency: "ILS" },
    });

    const result = await submitQuote({ token, amountMajor: 2000 });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.amountMinor).toBe(200000);
  });

  // Finding 1 (step 3) + Finding 6: a DIFFERENT clinic's quote on the same
  // request having already been decided must block this clinic from
  // submitting or editing its own quote too — approval is exclusive per
  // request, not just per quote.
  it("refuses to submit a brand-new quote once a sibling clinic on the same request has already been approved", async () => {
    const { request, rd, token } = await seed();
    const sfx = randomUUID().slice(0, 8);
    const otherDentist = await seedDentist(`${sfx}sibling`);
    const otherRd = await db.requestDentist.create({
      data: { requestId: request.id, dentistId: otherDentist.id },
    });
    await db.quote.create({
      data: { requestDentistId: otherRd.id, amountMinor: 100000, currency: "ILS", status: "APPROVED" },
    });

    const result = await submitQuote({ token, amountMajor: 2000 });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    const quote = await db.quote.findUnique({ where: { requestDentistId: rd.id } });
    expect(quote).toBeNull(); // never created
  });

  it("refuses to edit an existing PENDING_DECISION quote once a sibling clinic on the same request has already been approved", async () => {
    const { request, rd, token } = await seed();
    await db.quote.create({
      data: { requestDentistId: rd.id, amountMinor: 100000, currency: "ILS" },
    });
    const sfx = randomUUID().slice(0, 8);
    const otherDentist = await seedDentist(`${sfx}sibling2`);
    const otherRd = await db.requestDentist.create({
      data: { requestId: request.id, dentistId: otherDentist.id },
    });
    await db.quote.create({
      data: { requestDentistId: otherRd.id, amountMinor: 150000, currency: "ILS", status: "APPROVED" },
    });

    const result = await submitQuote({ token, amountMajor: 2000 });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.amountMinor).toBe(100000); // unchanged
  });
});

describe.skipIf(!hasDb)("submitQuote package fields", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ submitQuote } = await import("@/server/quotes"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it("forces accommodationNights to null when ACCOMMODATION is not included", async () => {
    const { rd, token } = await seed();

    const result = await submitQuote({
      token,
      amountMajor: 2000,
      includes: ["XRAYS"],
      accommodationNights: 5,
    });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.accommodationNights).toBeNull();
  });

  it("saves accommodationNights, clamped to 1-60, when ACCOMMODATION is included", async () => {
    const { rd, token } = await seed();

    const result = await submitQuote({
      token,
      amountMajor: 2000,
      includes: ["ACCOMMODATION"],
      accommodationNights: 500,
    });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.accommodationNights).toBe(60);
  });

  it("defaults accommodationNights to 1 when ACCOMMODATION is included but no count was sent", async () => {
    const { rd, token } = await seed();

    const result = await submitQuote({
      token,
      amountMajor: 2000,
      includes: ["ACCOMMODATION"],
    });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.accommodationNights).toBe(1);
  });

  it("defaults sessionsRequired to 1 and forces weeksBetweenSessions to null for a single session", async () => {
    const { rd, token } = await seed();

    const result = await submitQuote({ token, amountMajor: 2000 });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.sessionsRequired).toBe(1);
    expect(quote.weeksBetweenSessions).toBeNull();
  });

  it("saves sessionsRequired and weeksBetweenSessions, both clamped, for a multi-session quote", async () => {
    const { rd, token } = await seed();

    const result = await submitQuote({
      token,
      amountMajor: 2000,
      sessionsRequired: 99,
      weeksBetweenSessions: 999,
    });

    expect(result.ok).toBe(true);
    const quote = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rd.id } });
    expect(quote.sessionsRequired).toBe(10);
    expect(quote.weeksBetweenSessions).toBe(104);
  });
});
