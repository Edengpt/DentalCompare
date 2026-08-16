import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { fulfillRequest as FulfillFn } from "@/server/fulfillment";

// Record Resend sends and let specific recipients be forced to fail.
const h = vi.hoisted(() => {
  const state = { sends: [] as Array<{ to: string; html: string }>, failFor: new Set<string>() };
  return {
    state,
    send: async (msg: { to: string; html: string }) => {
      state.sends.push(msg);
      if (state.failFor.has(msg.to)) return { data: null, error: { name: "e", message: "boom" } };
      return { data: { id: "x" }, error: null };
    },
  };
});

vi.mock("@/lib/email", () => ({
  getResend: () => ({ emails: { send: h.send } }),
  fromAddress: () => "test@dentalcompare.co.il",
}));
vi.mock("@vercel/blob", () => ({
  get: async () => ({
    statusCode: 200,
    stream: new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([1, 2, 3]));
        c.close();
      },
    }),
    headers: new Headers(),
    blob: { contentType: "application/pdf" },
  }),
}));

const hasDb = Boolean(process.env.DATABASE_URL);

// Imported lazily (only when a DB is configured) so the suite stays safe — and
// db.ts doesn't throw at import time — in environments without DATABASE_URL.
let db: typeof Db;
let fulfillRequest: typeof FulfillFn;

const created = { userIds: [] as string[], dentistIds: [] as string[], requestIds: [] as string[] };

async function seed(opts: { dentistCount: number; createdAt?: Date }) {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: {
      clerkUserId: `itest_${sfx}`,
      fullName: "בדיקה",
      email: `itest_${sfx}@example.com`,
      // phone is unique now — derive a distinct E.164 number per seeded user.
      phone: `+9725${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, "0")}`,
      phoneVerifiedAt: new Date(),
    },
  });
  created.userIds.push(user.id);

  const request = await db.request.create({
    data: {
      userId: user.id,
      treatmentFileUrl: "https://blob/t",
      xrayFileUrl: "https://blob/x",
      status: "SUBMITTED",
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
  created.requestIds.push(request.id);

  for (let i = 0; i < opts.dentistCount; i++) {
    const d = await db.dentist.create({
      data: {
        clinicName: `Clinic ${sfx}-${i}`,
        dentistName: `Dr ${sfx}-${i}`,
        email: `dentist_${sfx}_${i}@example.com`,
        phone: "0500000000",
        city: "תל אביב",
        address: "רחוב 1",
        experienceYears: 5,
        specialties: [],
        treatments: [],
        hmoAffiliations: [],
      },
    });
    created.dentistIds.push(d.id);
    await db.requestDentist.create({ data: { requestId: request.id, dentistId: d.id } });
  }

  return { requestId: request.id };
}

describe.skipIf(!hasDb)("fulfillRequest (integration, real DB)", () => {
  // Generous timeouts — these hit a real (remote) Neon database.
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ fulfillRequest } = await import("@/server/fulfillment"));
  }, DB_TIMEOUT);

  beforeEach(() => {
    h.state.sends = [];
    h.state.failFor = new Set();
  });

  afterEach(async () => {
    // Audit rows (request.fulfilled) have no FK to the request — remove explicitly.
    if (created.requestIds.length)
      await db.auditLog
        .deleteMany({ where: { entityId: { in: created.requestIds } } })
        .catch(() => {});
    // Requests cascade to their requestDentists.
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it(
    "emails each dentist exactly once under concurrent fulfillment; token matches the DB",
    async () => {
      const { requestId } = await seed({ dentistCount: 3 });

      await Promise.all([fulfillRequest(requestId), fulfillRequest(requestId)]);

      // Exactly one email per dentist, three total — no duplicates from the race.
      const perRecipient = new Map<string, number>();
      for (const s of h.state.sends) perRecipient.set(s.to, (perRecipient.get(s.to) ?? 0) + 1);
      expect(h.state.sends.length).toBe(3);
      for (const n of perRecipient.values()) expect(n).toBe(1);

      const rows = await db.requestDentist.findMany({
        where: { requestId },
        select: { emailSent: true, quoteToken: true, dentist: { select: { email: true } } },
      });
      expect(rows.every((r) => r.emailSent && r.quoteToken)).toBe(true);
      // The token that reached the dentist is the one persisted in the DB.
      for (const r of rows) {
        const send = h.state.sends.find((s) => s.to === r.dentist.email);
        expect(send).toBeTruthy();
        expect(send!.html).toContain(r.quoteToken!);
      }
    },
    DB_TIMEOUT,
  );

  it(
    "a failed send releases the row for retry; the safety-net scan would pick it up",
    async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const { requestId } = await seed({ dentistCount: 1, createdAt: twoHoursAgo });

      const rd = await db.requestDentist.findFirst({
        where: { requestId },
        select: { dentist: { select: { email: true } } },
      });
      h.state.failFor = new Set([rd!.dentist.email]);

      // First attempt fails → the row is released back to emailSent=false.
      await fulfillRequest(requestId);
      let row = await db.requestDentist.findFirst({ where: { requestId } });
      expect(row!.emailSent).toBe(false);
      expect(row!.quoteToken).toBeNull();

      // The daily safety-net selection (read-only here) would include this request.
      const cutoff = new Date(Date.now() - 60 * 60 * 1000);
      const stuck = await db.request.findMany({
        where: {
          status: { in: ["SUBMITTED", "SENT", "FAILED"] },
          createdAt: { lt: cutoff },
          requestDentists: { some: { emailSent: false } },
        },
        select: { id: true },
      });
      expect(stuck.map((s) => s.id)).toContain(requestId);

      // Clear the failure and retry — the released row is now delivered.
      h.state.failFor = new Set();
      const result = await fulfillRequest(requestId);
      expect(result.ok).toBe(true);
      row = await db.requestDentist.findFirst({ where: { requestId } });
      expect(row!.emailSent).toBe(true);
      expect(row!.quoteToken).toBeTruthy();
    },
    DB_TIMEOUT,
  );
});
