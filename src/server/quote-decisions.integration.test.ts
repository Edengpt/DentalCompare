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
import type { submitQuote as SubmitQuoteFn } from "@/server/quotes";

const authState = { clerkUserId: "" };
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: authState.clerkUserId }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/quote-notifications", () => ({ sendNewQuoteEmail: async () => true }));

// The notification senders hit Resend for real; this suite is about the state
// transitions and who gets notified, not about the sending itself.
const notified: string[] = [];
vi.mock("@/server/quote-decision-notifications", () => ({
  sendQuoteApprovedEmail: async () => {
    notified.push("approved");
    return true;
  },
  sendQuoteRejectedEmail: async () => {
    notified.push("rejected");
    return true;
  },
  sendTreatmentStartedEmail: async () => {
    notified.push("started");
    return true;
  },
  sendCompletionRequestedEmail: async () => {
    notified.push("completion_requested");
    return true;
  },
  sendTreatmentCompletedEmail: async () => {
    notified.push("completed");
    return true;
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);
let db: typeof Db;
let approveQuote: typeof ApproveFn;
let rejectQuote: typeof RejectFn;
let markTreatmentStarted: typeof MarkTreatmentStartedFn;
let requestCompletionConfirmation: typeof RequestCompletionFn;
let confirmCompletion: typeof ConfirmCompletionFn;
let submitQuote: typeof SubmitQuoteFn;
const created = { dentistIds: [] as string[], userIds: [] as string[], requestIds: [] as string[] };

async function seedDentist(sfx: string) {
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `qd_${sfx}@example.com`,
      phone: `+9725${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, "0")}`,
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
  const rdA = await db.requestDentist.create({
    data: { requestId: request.id, dentistId: dentistA.id },
  });
  const rdB = await db.requestDentist.create({
    data: { requestId: request.id, dentistId: dentistB.id },
  });
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
    ({
      approveQuote,
      rejectQuote,
      markTreatmentStarted,
      requestCompletionConfirmation,
      confirmCompletion,
    } = await import("@/server/quote-decisions"));
    ({ submitQuote } = await import("@/server/quotes"));
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

  it("refuses a decision from a real, synced patient who just isn't this request's owner (no info leak vs. nonexistent)", async () => {
    const { rdA } = await seedRequestWithTwoQuotes();

    // A second real, synced User row — this exercises `rd.request.userId !==
    // user.id` inside loadOwnedRequestDentist, distinct from the
    // "someone-else-entirely" case above (which has no User row at all and
    // trips the earlier userNotSynced check instead).
    const sfx = randomUUID().slice(0, 8);
    const otherUser = await db.user.create({
      data: {
        clerkUserId: `qp_other_${sfx}`,
        fullName: "Not The Owner",
        email: `qp_other_${sfx}@example.com`,
      },
    });
    created.userIds.push(otherUser.id);
    authState.clerkUserId = otherUser.clerkUserId;

    const result = await approveQuote(rdA.id);
    const nonexistent = await approveQuote(randomUUID());

    expect(result.ok).toBe(false);
    expect(nonexistent.ok).toBe(false);
    expect(result).toEqual(nonexistent); // same error string — no leak between "not yours" and "doesn't exist"
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("PENDING_DECISION");
  });

  it("only the owning clinic can mark treatment started (refuses a different clinic's quote)", async () => {
    const { rdA, rdB, dentistA } = await seedRequestWithTwoQuotes();
    await approveQuote(rdA.id);

    await db.dentist.update({
      where: { id: dentistA.id },
      data: { clerkUserId: `clinic_${dentistA.id}` },
    });
    authState.clerkUserId = `clinic_${dentistA.id}`;

    // rdB belongs to dentistB, not the signed-in dentistA — this fails at
    // the ownership check inside loadOwnedByClinic, never reaching the
    // status guard (that is covered separately below).
    const wrongClinic = await markTreatmentStarted(rdB.id);
    expect(wrongClinic.ok).toBe(false);
    const b = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdB.id } });
    expect(b.status).toBe("REJECTED"); // untouched by the refused call

    const result = await markTreatmentStarted(rdA.id);
    expect(result.ok).toBe(true);
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("IN_TREATMENT");
    expect(a.treatmentStartedAt).not.toBeNull();
  });

  it("refuses to mark treatment started on the owning clinic's own quote while it is still PENDING_DECISION", async () => {
    const { rdA, dentistA } = await seedRequestWithTwoQuotes();
    // Never approved — rdA's quote is still PENDING_DECISION.
    await db.dentist.update({
      where: { id: dentistA.id },
      data: { clerkUserId: `clinic_${dentistA.id}` },
    });
    authState.clerkUserId = `clinic_${dentistA.id}`;

    const result = await markTreatmentStarted(rdA.id);

    expect(result.ok).toBe(false);
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.status).toBe("PENDING_DECISION");
  });

  it("walks approved through completion, with the patient confirming the final step", async () => {
    const { rdA, user, dentistA } = await seedRequestWithTwoQuotes();
    await approveQuote(rdA.id);

    await db.dentist.update({
      where: { id: dentistA.id },
      data: { clerkUserId: `clinic_${dentistA.id}` },
    });
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

    await db.dentist.update({
      where: { id: dentistA.id },
      data: { clerkUserId: `clinic_${dentistA.id}` },
    });
    authState.clerkUserId = `clinic_${dentistA.id}`;
    await markTreatmentStarted(rdA.id);

    authState.clerkUserId = user.clerkUserId;
    const result = await confirmCompletion(rdA.id);

    expect(result.ok).toBe(false);
  });

  it("notifies the clinic on approval and stamps decisionNotifiedAt", async () => {
    const { rdA } = await seedRequestWithTwoQuotes();

    await approveQuote(rdA.id);

    expect(notified).toContain("approved");
    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    expect(a.decisionNotifiedAt).not.toBeNull();
  });

  it("notifies every auto-rejected clinic too", async () => {
    const { rdA, rdB } = await seedRequestWithTwoQuotes();

    await approveQuote(rdA.id);

    expect(notified.filter((n) => n === "rejected")).toHaveLength(1);
    const b = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdB.id } });
    expect(b.decisionNotifiedAt).not.toBeNull();
  });

  // Finding 1: a request can never end with two APPROVED (or later) quotes,
  // even when a third clinic is invited (or submits) after the request has
  // already been decided. This is the invariant the spec requires
  // (docs/superpowers/specs/2026-09-02-quote-status-design.md §1.1) and no
  // single task ever exercised it end to end.
  it("a request can never end with two APPROVED quotes — a late clinic C can neither submit nor be approved after A already won", async () => {
    const { rdA, rdB, request, user } = await seedRequestWithTwoQuotes();

    // Patient approves A; B is auto-rejected. The request is now decided.
    const approvedA = await approveQuote(rdA.id);
    expect(approvedA.ok).toBe(true);

    // Clinic C is invited late (or was already invited) and only now submits
    // its quote — after the request has already been decided.
    const sfx = randomUUID().slice(0, 8);
    const dentistC = await seedDentist(`${sfx}c`);
    const token = randomUUID();
    const rdC = await db.requestDentist.create({
      data: { requestId: request.id, dentistId: dentistC.id, quoteToken: token },
    });

    const submitResult = await submitQuote({
      token,
      items: [{ category: "SURGICAL", treatment: "IMPLANT", quantity: 1, unitPriceMajor: 3000 }],
    });
    expect(submitResult.ok).toBe(false);
    const cAfterSubmit = await db.quote.findUnique({ where: { requestDentistId: rdC.id } });
    expect(cAfterSubmit).toBeNull(); // never created

    // Even if C's quote existed anyway (e.g. it was submitted before A was
    // decided and just never got auto-rejected because it wasn't PENDING at
    // sweep time — belt and suspenders), approving it must still fail.
    const quoteC = await db.quote.create({
      data: { requestDentistId: rdC.id, amountMinor: 300000, currency: "ILS" },
    });

    authState.clerkUserId = user.clerkUserId;
    const approveC = await approveQuote(rdC.id);
    expect(approveC.ok).toBe(false);

    const a = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdA.id } });
    const b = await db.quote.findUniqueOrThrow({ where: { requestDentistId: rdB.id } });
    const c = await db.quote.findUniqueOrThrow({ where: { id: quoteC.id } });
    expect(a.status).toBe("APPROVED");
    expect(b.status).toBe("REJECTED");
    expect(c.status).toBe("PENDING_DECISION"); // never became APPROVED
  });
});
