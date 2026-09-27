import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type * as Decisions from "@/server/quote-decisions";

/**
 * The treatment lifecycle as both sides drive it: either may mark the start,
 * and the patient may answer a completion request with "still ongoing".
 */

const authState = { clerkUserId: "" };
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: authState.clerkUserId }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Records who each email went to, by kind — the point of the actor field is
// that "started" reaches the other side.
const notified: string[] = [];
const record = (kind: string) => async () => {
  notified.push(kind);
  return true;
};
vi.mock("@/server/quote-decision-notifications", () => ({
  sendQuoteApprovedEmail: record("approved"),
  sendQuoteRejectedEmail: record("rejected"),
  sendTreatmentStartedEmail: record("started:to-patient"),
  sendTreatmentStartedByPatientEmail: record("started:to-clinic"),
  sendCompletionRequestedEmail: record("completion-requested:to-patient"),
  sendCompletionDeclinedEmail: record("completion-declined:to-clinic"),
  sendTreatmentCompletedEmail: record("completed:to-clinic"),
}));

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let actions: typeof Decisions;
const created = { dentistIds: [] as string[], userIds: [] as string[], requestIds: [] as string[] };

/** A request whose quote from one clinic the patient has already approved. */
async function seedApproved() {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { clerkUserId: `lp_${sfx}`, fullName: "T", email: `lp_${sfx}@example.com` },
  });
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `lc_${sfx}@example.com`,
      phone: "+972501234567",
      city: "Tel Aviv",
      address: "1 Main St",
      experienceYears: 5,
      clerkUserId: `lclinic_${sfx}`,
    },
  });
  const request = await db.request.create({
    data: { userId: user.id, treatmentFileUrl: "https://blob/t", xrayFileUrl: "https://blob/x" },
  });
  const rd = await db.requestDentist.create({
    data: { requestId: request.id, dentistId: dentist.id },
  });
  await db.quote.create({
    data: {
      requestDentistId: rd.id,
      amountMinor: 100000,
      currency: "ILS",
      status: "APPROVED",
      decidedAt: new Date(),
    },
  });
  created.userIds.push(user.id);
  created.dentistIds.push(dentist.id);
  created.requestIds.push(request.id);
  authState.clerkUserId = user.clerkUserId;
  return { rd, patient: user.clerkUserId, clinic: dentist.clerkUserId! };
}

const quoteOf = (rdId: string) => db.quote.findUniqueOrThrow({ where: { requestDentistId: rdId } });

describe.skipIf(!hasDb)("treatment lifecycle", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    actions = await import("@/server/quote-decisions");
  }, DB_TIMEOUT);

  afterEach(async () => {
    notified.length = 0;
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it("lets the patient mark the start, and tells the clinic", async () => {
    const { rd } = await seedApproved();

    const result = await actions.markTreatmentStartedByPatient(rd.id);

    expect(result.ok).toBe(true);
    const q = await quoteOf(rd.id);
    expect(q.status).toBe("IN_TREATMENT");
    expect(q.treatmentStartedBy).toBe("PATIENT");
    expect(q.treatmentStartedAt).not.toBeNull();
    expect(q.treatmentStartedNotifiedAt).not.toBeNull();
    expect(notified).toEqual(["started:to-clinic"]);
  });

  it("records the clinic as the one who started when the clinic marks it", async () => {
    const { rd, clinic } = await seedApproved();
    authState.clerkUserId = clinic;

    await actions.markTreatmentStarted(rd.id);

    const q = await quoteOf(rd.id);
    expect(q.treatmentStartedBy).toBe("CLINIC");
    expect(notified).toEqual(["started:to-patient"]);
  });

  it("lets only one side start it — the second press is refused", async () => {
    const { rd, clinic } = await seedApproved();
    await actions.markTreatmentStartedByPatient(rd.id);

    authState.clerkUserId = clinic;
    const second = await actions.markTreatmentStarted(rd.id);

    expect(second.ok).toBe(false);
    expect((await quoteOf(rd.id)).treatmentStartedBy).toBe("PATIENT");
  });

  it("refuses a patient who does not own the request", async () => {
    const { rd } = await seedApproved();
    authState.clerkUserId = "someone_else";

    const result = await actions.markTreatmentStartedByPatient(rd.id);

    expect(result.ok).toBe(false);
    expect((await quoteOf(rd.id)).status).toBe("APPROVED");
  });

  it("refuses to start a quote that was never approved", async () => {
    const { rd } = await seedApproved();
    await db.quote.update({
      where: { requestDentistId: rd.id },
      data: { status: "PENDING_DECISION" },
    });

    const result = await actions.markTreatmentStartedByPatient(rd.id);

    expect(result.ok).toBe(false);
  });

  it("sends a completion request back to treatment when the patient says it is still ongoing", async () => {
    const { rd, patient, clinic } = await seedApproved();
    await actions.markTreatmentStartedByPatient(rd.id);
    authState.clerkUserId = clinic;
    await actions.requestCompletionConfirmation(rd.id);
    notified.length = 0;

    authState.clerkUserId = patient;
    const result = await actions.declineCompletion(rd.id);

    expect(result.ok).toBe(true);
    const q = await quoteOf(rd.id);
    expect(q.status).toBe("IN_TREATMENT");
    expect(q.completionDeclinedAt).not.toBeNull();
    expect(q.completionDeclinedNotifiedAt).not.toBeNull();
    // Cleared, so a second request by the clinic is a fresh one — with its
    // own email to the patient and its own retry if that email fails.
    expect(q.completionRequestedAt).toBeNull();
    expect(q.completionRequestedNotifiedAt).toBeNull();
    expect(notified).toEqual(["completion-declined:to-clinic"]);

    authState.clerkUserId = clinic;
    expect((await actions.requestCompletionConfirmation(rd.id)).ok).toBe(true);
  });

  it("refuses 'still ongoing' when the clinic has not asked", async () => {
    const { rd } = await seedApproved();
    await actions.markTreatmentStartedByPatient(rd.id);

    const result = await actions.declineCompletion(rd.id);

    expect(result.ok).toBe(false);
    expect((await quoteOf(rd.id)).status).toBe("IN_TREATMENT");
  });
});
