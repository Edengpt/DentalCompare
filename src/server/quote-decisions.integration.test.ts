import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type {
  approveQuote as ApproveFn,
  rejectQuote as RejectFn,
  markTreatmentStarted as MarkTreatmentStartedFn,
  requestCompletionConfirmation as RequestCompletionFn,
  confirmCompletion as ConfirmCompletionFn,
} from "@/server/quote-decisions";

const authState = { clerkUserId: "" };
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: authState.clerkUserId }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let approveQuote: typeof ApproveFn;
let rejectQuote: typeof RejectFn;
let markTreatmentStarted: typeof MarkTreatmentStartedFn;
let requestCompletionConfirmation: typeof RequestCompletionFn;
let confirmCompletion: typeof ConfirmCompletionFn;
const created = { dentistIds: [] as string[], userIds: [] as string[], requestIds: [] as string[] };

async function seedDentist(sfx: string) {
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `qd_${sfx}@example.com`,
      phone: `+9725${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      city: "Tel Aviv",
      address: "1 Main St",
      experienceYears: 5,
    },
  });
  created.dentistIds.push(dentist.id);
  return dentist;
}

async function seedRequestWithTwoQuotes() {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { clerkUserId: `qp_${sfx}`, fullName: "T", email: `qp_${sfx}@example.com` },
  });
  created.userIds.push(user.id);
  authState.clerkUserId = user.clerkUserId;

  const request = await db.request.create({
    data: { userId: user.id, treatmentFileUrl: "https://blob/t", xrayFileUrl: "https://blob/x" },
  });
  created.requestIds.push(request.id);

  const dentistA = await seedDentist(`${sfx}a`);
  const dentistB = await seedDentist(`${sfx}b`);
  const rdA = await db.requestDentist.create({ data: { requestId: request.id, dentistId: dentistA.id } });
  const rdB = await db.requestDentist.create({ data: { requestId: request.id, dentistId: dentistB.id } });
  const quoteA = await db.quote.create({
    data: { requestDentistId: rdA.id, amountMinor: 100000, currency: "ILS" },
  });
  const quoteB = await db.quote.create({
    data: { requestDentistId: rdB.id, amountMinor: 120000, currency: "ILS" },
  });
  return { user, request, rdA, rdB, quoteA, quoteB, dentistA };
}

describe.skipIf(!hasDb)("patient quote decisions", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ approveQuote, rejectQuote, markTreatmentStarted, requestCompletionConfirmation, confirmCompletion } =
      await import("@/server/quote-decisions"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.requestIds) await db.request.delete({ where: { id } }).catch(() => {});
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    for (const id of created.userIds) await db.user.delete({ where: { id } }).catch(() => {});
    created.requestIds = [];
    created.dentistIds = [];
    created.userIds = [];
  }, DB_TIMEOUT);

  it("approving one quote auto-rejects every other open quote in the same request", async () => {
    const { rdA, rdB } = await seedRequestWithTwoQuotes();

    const result = await approveQuote(rdA.id);

    expect(result.ok).toBe(true);
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    const b = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdB.id } });
    expect(a.status).toBe("APPROVED");
    expect(a.decidedAt).not.toBeNull();
    expect(b.status).toBe("REJECTED");
    expect(b.rejectedAuto).toBe(true);
  });

  it("refuses to approve a quote that was already decided", async () => {
    const { rdA } = await seedRequestWithTwoQuotes();
    expect((await approveQuote(rdA.id)).ok).toBe(true);

    const second = await approveQuote(rdA.id);

    expect(second.ok).toBe(false);
  });

  it("rejects a single quote independently, without touching the others", async () => {
    const { rdA, rdB } = await seedRequestWithTwoQuotes();

    const result = await rejectQuote(rdA.id);

    expect(result.ok).toBe(true);
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    const b = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdB.id } });
    expect(a.status).toBe("REJECTED");
    expect(a.rejectedAuto).toBe(false);
    expect(b.status).toBe("PENDING_DECISION");
  });

  it("refuses a decision from someone who doesn't own the request", async () => {
    const { rdA } = await seedRequestWithTwoQuotes();
    authState.clerkUserId = "someone-else-entirely";

    const result = await approveQuote(rdA.id);

    expect(result.ok).toBe(false);
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("PENDING_DECISION");
  });

  it("only the owning clinic can mark treatment started, and only once approved", async () => {
    const { rdA, rdB, dentistA } = await seedRequestWithTwoQuotes();
    await approveQuote(rdA.id);

    await db.dentist.update({ where: { id: dentistA.id }, data: { clerkUserId: `clinic_${dentistA.id}` } });
    authState.clerkUserId = `clinic_${dentistA.id}`;

    // Not yet approved — refused.
    const tooEarly = await markTreatmentStarted(rdB.id);
    expect(tooEarly.ok).toBe(false);

    const result = await markTreatmentStarted(rdA.id);
    expect(result.ok).toBe(true);
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("IN_TREATMENT");
    expect(a.treatmentStartedAt).not.toBeNull();
  });

  it("walks approved through completion, with the patient confirming the final step", async () => {
    const { rdA, user, dentistA } = await seedRequestWithTwoQuotes();
    await approveQuote(rdA.id);

    await db.dentist.update({ where: { id: dentistA.id }, data: { clerkUserId: `clinic_${dentistA.id}` } });
    authState.clerkUserId = `clinic_${dentistA.id}`;
    await markTreatmentStarted(rdA.id);

    const requested = await requestCompletionConfirmation(rdA.id);
    expect(requested.ok).toBe(true);
    let a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("COMPLETION_REQUESTED");

    authState.clerkUserId = user.clerkUserId;
    const confirmed = await confirmCompletion(rdA.id);
    expect(confirmed.ok).toBe(true);
    a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("COMPLETED");
    expect(a.completedAt).not.toBeNull();
  });

  it("refuses completion confirmation before the clinic has requested it", async () => {
    const { rdA, user, dentistA } = await seedRequestWithTwoQuotes();
    await approveQuote(rdA.id);

    await db.dentist.update({ where: { id: dentistA.id }, data: { clerkUserId: `clinic_${dentistA.id}` } });
    authState.clerkUserId = `clinic_${dentistA.id}`;
    await markTreatmentStarted(rdA.id);

    authState.clerkUserId = user.clerkUserId;
    const result = await confirmCompletion(rdA.id);

    expect(result.ok).toBe(false);
  });
});
