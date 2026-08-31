import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type {
  saveRequestDentists as SaveFn,
  submitRequest as SubmitFn,
} from "@/server/requests";

/**
 * The licence gate, asserted where it actually matters.
 *
 * `publicDentistWhere()` is already pinned against the directory. But the
 * directory is not the only door: a patient posts clinic IDs, and the last
 * gate before x-rays and treatment plans leave the building is the eligibility
 * re-check in submitRequest. A clinic hidden from the directory that can still
 * be selected and still receive the files makes "every clinic here has had its
 * licence seen" a claim rather than a rule.
 */

const authState = { clerkUserId: "" };
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: authState.clerkUserId }) }));

// fulfillRequest sends real email; this suite is about who is allowed to be a
// recipient, not about the sending itself.
const fulfilled: string[] = [];
vi.mock("@/server/fulfillment", () => ({
  fulfillRequest: async (id: string) => {
    fulfilled.push(id);
    return { ok: true, sent: 0 };
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);

let db: typeof Db;
let saveRequestDentists: typeof SaveFn;
let submitRequest: typeof SubmitFn;

const created = { userIds: [] as string[], dentistIds: [] as string[], requestIds: [] as string[] };

/** A clinic that is complete in every way except, optionally, the licence stamp. */
async function seedClinic(opts: { verified: boolean }) {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `lic_${sfx}@example.com`,
      phone: `+9725${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, "0")}`,
      city: "Tel Aviv",
      address: "1 Main St",
      experienceYears: 10,
      isActive: true,
      licenceVerifiedAt: opts.verified ? new Date() : null,
      licenceVerifiedBy: opts.verified ? "admin@example.com" : null,
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

async function seedPatientWithRequest() {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: {
      clerkUserId: `lic_${sfx}`,
      fullName: "Test Patient",
      email: `licu_${sfx}@example.com`,
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
      status: "DRAFT",
      consentAt: new Date(),
    },
  });
  created.requestIds.push(request.id);

  authState.clerkUserId = user.clerkUserId;
  return { user, request };
}

describe.skipIf(!hasDb)("the licence gate on the patient's path", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ saveRequestDentists, submitRequest } = await import("@/server/requests"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    fulfilled.length = 0;
    if (created.requestIds.length)
      await db.auditLog
        .deleteMany({ where: { entityId: { in: created.requestIds } } })
        .catch(() => {});
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  // The picker only ever offers verified clinics, but the id travels from the
  // browser. Nothing on the server re-derives it from the directory.
  it("refuses a selection containing a clinic whose licence was never checked", async () => {
    const { request } = await seedPatientWithRequest();
    const unverified = await seedClinic({ verified: false });

    const result = await saveRequestDentists(request.id, [unverified.id]);

    expect(result.ok).toBe(false);
    const rows = await db.requestDentist.count({ where: { requestId: request.id } });
    expect(rows).toBe(0);
  });

  it("still accepts a verified clinic", async () => {
    const { request } = await seedPatientWithRequest();
    const verified = await seedClinic({ verified: true });

    const result = await saveRequestDentists(request.id, [verified.id]);

    expect(result.ok).toBe(true);
    const rows = await db.requestDentist.count({ where: { requestId: request.id } });
    expect(rows).toBe(1);
  });

  // The one that matters most: this is the last point before an x-ray and a
  // treatment plan leave for a clinic. A stamp revoked after selection has to
  // drop the recipient here, exactly as a lapsed subscription already does.
  it("drops a clinic that lost its licence stamp between selection and sending", async () => {
    const { request } = await seedPatientWithRequest();
    const keeps = await seedClinic({ verified: true });
    const loses = await seedClinic({ verified: true });

    expect((await saveRequestDentists(request.id, [keeps.id, loses.id])).ok).toBe(true);

    await db.dentist.update({
      where: { id: loses.id },
      data: { licenceVerifiedAt: null, licenceVerifiedBy: null },
    });

    const result = await submitRequest(request.id);
    expect(result.ok).toBe(true);

    const recipients = await db.requestDentist.findMany({
      where: { requestId: request.id },
      select: { dentistId: true },
    });
    expect(recipients.map((r) => r.dentistId)).toEqual([keeps.id]);
  });

  // With no eligible recipient left, the files must not go anywhere at all.
  it("refuses to send when the only chosen clinic lost its stamp", async () => {
    const { request } = await seedPatientWithRequest();
    const loses = await seedClinic({ verified: true });

    expect((await saveRequestDentists(request.id, [loses.id])).ok).toBe(true);
    await db.dentist.update({ where: { id: loses.id }, data: { licenceVerifiedAt: null } });

    const result = await submitRequest(request.id);

    expect(result.ok).toBe(false);
    expect(fulfilled).toEqual([]);
  });
});
