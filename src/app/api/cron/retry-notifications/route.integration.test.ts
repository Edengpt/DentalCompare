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

async function seedQuote(opts: {
  createdAt: Date;
  notifiedAt?: Date | null;
  /** Extra quote columns — lifecycle state for the treatment blocks. */
  quote?: Record<string, unknown>;
}) {
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
      ...opts.quote,
    },
  });
  created.userIds.push(user.id);
  created.dentistIds.push(dentist.id);
  created.requestIds.push(request.id);
  return { quote, user, dentist };
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

  it("reminds once about unopened quotes, in one email per request", async () => {
    const DAY = 24 * HOUR;
    const old = new Date(Date.now() - 4 * DAY);
    const { quote, user } = await seedQuote({ createdAt: old, notifiedAt: old });
    // A second clinic's quote on the same request.
    const rd = await db.requestDentist.findUniqueOrThrow({ where: { id: quote.requestDentistId } });
    const other = await db.dentist.create({
      data: {
        clinicName: "מרפאה 2",
        dentistName: "ד״ר",
        email: `qd2_${randomUUID().slice(0, 8)}@example.com`,
        phone: "03",
        city: "חיפה",
        address: "רחוב 2",
        experienceYears: 3,
      },
    });
    created.dentistIds.push(other.id);
    const rd2 = await db.requestDentist.create({
      data: { requestId: rd.requestId, dentistId: other.id, emailSent: true, quoteToken: randomUUID() },
    });
    await db.quote.create({
      data: {
        requestDentistId: rd2.id,
        amountMinor: 400000,
        currency: "ILS",
        createdAt: old,
        patientNotifiedAt: old,
      },
    });

    await call();
    const reminders = h.state.sends.filter((m) => m.to === user.email);
    expect(reminders).toHaveLength(1);

    h.state.sends = [];
    await call();
    expect(h.state.sends.filter((m) => m.to === user.email)).toHaveLength(0);
  });

  it("does not remind a patient who already opened the request", async () => {
    const DAY = 24 * HOUR;
    const old = new Date(Date.now() - 4 * DAY);
    const { quote, user } = await seedQuote({ createdAt: old, notifiedAt: old });
    const rd = await db.requestDentist.findUniqueOrThrow({ where: { id: quote.requestDentistId } });
    await db.request.update({
      where: { id: rd.requestId },
      data: { patientViewedAt: new Date(Date.now() - DAY) },
    });

    await call();
    expect(h.state.sends.filter((m) => m.to === user.email)).toHaveLength(0);
  });

  it("nudges a clinic once when it has not quoted a day after the request", async () => {
    // A request with two clinics: one quoted, one silent for two days.
    const twoDaysAgo = new Date(Date.now() - 48 * HOUR);
    const { quote } = await seedQuote({ createdAt: twoDaysAgo, notifiedAt: twoDaysAgo });
    const rd = await db.requestDentist.findUniqueOrThrow({ where: { id: quote.requestDentistId } });
    const silent = await db.dentist.create({
      data: {
        clinicName: "שקטה",
        dentistName: "ד״ר",
        email: `silent_${randomUUID().slice(0, 8)}@example.com`,
        phone: "03",
        city: "חיפה",
        address: "רחוב 3",
        experienceYears: 3,
      },
    });
    created.dentistIds.push(silent.id);
    await db.requestDentist.create({
      data: {
        requestId: rd.requestId,
        dentistId: silent.id,
        emailSent: true,
        sentAt: twoDaysAgo,
        quoteToken: randomUUID(),
      },
    });

    await call();
    expect(h.state.sends.filter((m) => m.to === silent.email)).toHaveLength(1);

    h.state.sends = [];
    await call();
    expect(h.state.sends.filter((m) => m.to === silent.email)).toHaveLength(0);
  });

  it("does not nudge a clinic once the patient chose another one", async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * HOUR);
    const { quote } = await seedQuote({
      createdAt: twoDaysAgo,
      notifiedAt: twoDaysAgo,
      quote: { status: "APPROVED", decidedAt: twoDaysAgo },
    });
    const rd = await db.requestDentist.findUniqueOrThrow({ where: { id: quote.requestDentistId } });
    const silent = await db.dentist.create({
      data: {
        clinicName: "שקטה",
        dentistName: "ד״ר",
        email: `silent_${randomUUID().slice(0, 8)}@example.com`,
        phone: "03",
        city: "חיפה",
        address: "רחוב 3",
        experienceYears: 3,
      },
    });
    created.dentistIds.push(silent.id);
    await db.requestDentist.create({
      data: {
        requestId: rd.requestId,
        dentistId: silent.id,
        emailSent: true,
        sentAt: twoDaysAgo,
        quoteToken: randomUUID(),
      },
    });

    await call();
    expect(h.state.sends.filter((m) => m.to === silent.email)).toHaveLength(0);
  });

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

  // Either side may mark a treatment started; the retry must reach the OTHER
  // side, never echo the news back to the one who pressed the button.
  it("retries a patient-marked start to the clinic, not to the patient", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * HOUR);
    const { quote, user, dentist } = await seedQuote({
      createdAt: twoHoursAgo,
      notifiedAt: twoHoursAgo,
      quote: {
        status: "IN_TREATMENT",
        treatmentStartedAt: twoHoursAgo,
        treatmentStartedBy: "PATIENT",
      },
    });

    await call();

    const recipients = h.state.sends.map((m) => m.to);
    expect(recipients).toContain(dentist.email);
    expect(recipients).not.toContain(user.email);
    const after = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(after.treatmentStartedNotifiedAt).not.toBeNull();
  });

  it("retries a clinic-marked start (or a legacy one with no actor) to the patient", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * HOUR);
    const { user, dentist } = await seedQuote({
      createdAt: twoHoursAgo,
      notifiedAt: twoHoursAgo,
      quote: { status: "IN_TREATMENT", treatmentStartedAt: twoHoursAgo },
    });

    await call();

    const recipients = h.state.sends.map((m) => m.to);
    expect(recipients).toContain(user.email);
    expect(recipients).not.toContain(dentist.email);
  });

  it("retries a 'still ongoing' answer to the clinic and stamps it", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * HOUR);
    const { quote, dentist } = await seedQuote({
      createdAt: twoHoursAgo,
      notifiedAt: twoHoursAgo,
      quote: {
        status: "IN_TREATMENT",
        treatmentStartedAt: twoHoursAgo,
        treatmentStartedNotifiedAt: twoHoursAgo,
        completionDeclinedAt: twoHoursAgo,
      },
    });

    await call();

    expect(h.state.sends.map((m) => m.to)).toContain(dentist.email);
    const after = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(after.completionDeclinedNotifiedAt).not.toBeNull();
  });
});
