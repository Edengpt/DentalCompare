import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

// Record patient-notification sends and let them be forced to fail.
const h = vi.hoisted(() => {
  const state = { sends: [] as Array<{ to: string }>, failAll: false };
  return {
    state,
    send: async (msg: { to: string }) => {
      state.sends.push(msg);
      if (state.failAll) return { data: null, error: { name: "e", message: "boom" } };
      return { data: { id: "x" }, error: null };
    },
  };
});

vi.mock("@/lib/email", () => ({
  getResend: () => ({ emails: { send: h.send } }),
  fromAddress: () => "test@dentalcompare.co.il",
}));

const hasDb = Boolean(process.env.DATABASE_URL);

let db: typeof Db;
let GET: (req: Request) => Promise<Response>;

const created = { userIds: [] as string[], dentistIds: [] as string[], requestIds: [] as string[] };
const HOUR = 60 * 60 * 1000;

async function seedQuote(opts: { createdAt: Date; notifiedAt?: Date | null }) {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: {
      clerkUserId: `qn_${sfx}`,
      fullName: "דנה כהן",
      email: `qn_${sfx}@example.com`,
      // User.phone is unique now — each seeded user needs its own number.
      phone: `+9725${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, "0")}`,
    },
  });
  const dentist = await db.dentist.create({
    data: {
      clinicName: "מרפאה",
      dentistName: "ד״ר",
      email: `qd_${sfx}@example.com`,
      phone: "03",
      city: "תל אביב",
      address: "רחוב 1",
      experienceYears: 3,
      specialties: [],
      treatments: [],
      insurerAffiliations: [],
    },
  });
  const request = await db.request.create({
    data: { userId: user.id, treatmentFileUrl: "t", xrayFileUrl: "x", status: "SENT" },
  });
  const rd = await db.requestDentist.create({
    data: {
      requestId: request.id,
      dentistId: dentist.id,
      emailSent: true,
      quoteToken: randomUUID(),
    },
  });
  const quote = await db.quote.create({
    data: {
      requestDentistId: rd.id,
      amountMinor: 500000,
      currency: "ILS",
      createdAt: opts.createdAt,
      patientNotifiedAt: opts.notifiedAt ?? null,
    },
  });
  created.userIds.push(user.id);
  created.dentistIds.push(dentist.id);
  created.requestIds.push(request.id);
  return { quote, user };
}

function call(secret = "test-secret") {
  return GET(
    new Request("http://x/api/cron/retry-notifications", {
      headers: { authorization: `Bearer ${secret}` },
    }),
  );
}

describe.skipIf(!hasDb)("retry-notifications cron (integration, real DB)", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ GET } = await import("./route"));
    process.env.CRON_SECRET = "test-secret";
  }, DB_TIMEOUT);

  beforeEach(() => {
    h.state.sends = [];
    h.state.failAll = false;
  });

  afterEach(async () => {
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it("rejects a call without the cron secret", async () => {
    const res = await GET(new Request("http://x/api/cron/retry-notifications"));
    expect(res.status).toBe(401);
  });

  it("retries an un-notified quote older than an hour and marks it notified", async () => {
    const { quote, user } = await seedQuote({ createdAt: new Date(Date.now() - 2 * HOUR) });

    const res = await call();
    const body = await res.json();

    expect(h.state.sends.some((s) => s.to === user.email)).toBe(true);
    expect(body.sent).toBeGreaterThanOrEqual(1);
    const after = await db.quote.findUnique({
      where: { id: quote.id },
      select: { patientNotifiedAt: true },
    });
    expect(after?.patientNotifiedAt).not.toBeNull();
  });

  it("leaves the quote un-notified when the retry send fails", async () => {
    h.state.failAll = true;
    const { quote } = await seedQuote({ createdAt: new Date(Date.now() - 2 * HOUR) });

    await call();

    const after = await db.quote.findUnique({
      where: { id: quote.id },
      select: { patientNotifiedAt: true },
    });
    expect(after?.patientNotifiedAt).toBeNull(); // stays claimable for the next run
  });

  it("skips fresh quotes (< 1h) and already-notified ones", async () => {
    const fresh = await seedQuote({ createdAt: new Date() });
    const done = await seedQuote({
      createdAt: new Date(Date.now() - 2 * HOUR),
      notifiedAt: new Date(),
    });

    await call();

    expect(h.state.sends.find((s) => s.to === fresh.user.email)).toBeUndefined();
    expect(h.state.sends.find((s) => s.to === done.user.email)).toBeUndefined();
  });
});
