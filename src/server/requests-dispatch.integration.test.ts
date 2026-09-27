import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { submitRequest as SubmitFn } from "@/server/requests";

/**
 * Sending returns before the clinics are emailed.
 *
 * Each email carries the treatment plan and the x-ray as attachments, so
 * delivering three of them used to hold the patient on a spinner for seconds.
 * The request is committed first and delivery runs after the response — the
 * success page watches it land.
 */

const authState = { clerkUserId: "" };
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: authState.clerkUserId }) }));

// `after` only exists inside a live request. Here it queues the callback so the
// test can decide when "after the response" is.
const scheduled: Array<() => unknown> = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (cb: () => unknown) => void scheduled.push(cb),
}));

const fulfilled: string[] = [];
vi.mock("@/server/fulfillment", () => ({
  fulfillRequest: async (id: string) => {
    fulfilled.push(id);
    return { ok: true, emailsSent: 1, alreadySent: 0 };
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);

let db: typeof Db;
let submitRequest: typeof SubmitFn;
const created = { userIds: [] as string[], dentistIds: [] as string[], requestIds: [] as string[] };

function phone() {
  return `+9725${Math.floor(Math.random() * 1e8)
    .toString()
    .padStart(8, "0")}`;
}

async function seedReadyRequest() {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `dsp_${sfx}@example.com`,
      phone: phone(),
      city: "Tel Aviv",
      address: "1 Main St",
      experienceYears: 10,
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
    },
  });
  const user = await db.user.create({
    data: {
      clerkUserId: `dsp_${sfx}`,
      fullName: "Test Patient",
      email: `dspu_${sfx}@example.com`,
      phone: phone(),
    },
  });
  const request = await db.request.create({
    data: {
      userId: user.id,
      treatmentFileUrl: "https://blob/t",
      xrayFileUrl: "https://blob/x",
      status: "DRAFT",
      consentAt: new Date(),
      requestDentists: { create: { dentistId: dentist.id } },
    },
  });
  created.dentistIds.push(dentist.id);
  created.userIds.push(user.id);
  created.requestIds.push(request.id);
  authState.clerkUserId = user.clerkUserId;
  return request;
}

describe.skipIf(!hasDb)("submitRequest dispatch timing", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ submitRequest } = await import("@/server/requests"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    scheduled.length = 0;
    fulfilled.length = 0;
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it("answers once the request is committed, before any clinic is emailed", async () => {
    const request = await seedReadyRequest();

    const result = await submitRequest(request.id);

    expect(result).toEqual({ ok: true, sentTo: 1 });
    expect(fulfilled).toEqual([]);
    const row = await db.request.findUnique({ where: { id: request.id } });
    expect(row?.status).toBe("SUBMITTED");
  });

  it("hands delivery to after the response", async () => {
    const request = await seedReadyRequest();

    await submitRequest(request.id);
    expect(scheduled).toHaveLength(1);
    await scheduled[0]!();

    expect(fulfilled).toEqual([request.id]);
  });
});
