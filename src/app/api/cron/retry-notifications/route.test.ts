import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.fn() spies (not plain closures) so tests can assert exactly which
// function was called, with what args, and can override the resolved value
// per-test (e.g. simulate a failed send) — vi.mock factories are hoisted
// above regular const declarations, so the spies must be created via
// vi.hoisted() to be visible inside them.
const mocks = vi.hoisted(() => ({
  sendNewQuoteEmail: vi.fn(async () => true),
  sendQuoteApprovedEmail: vi.fn(async () => true),
  sendQuoteRejectedEmail: vi.fn(async () => true),
  sendTreatmentStartedEmail: vi.fn(async () => true),
  sendCompletionRequestedEmail: vi.fn(async () => true),
  sendTreatmentCompletedEmail: vi.fn(async () => true),
}));

vi.mock("@/server/quote-notifications", () => ({
  sendNewQuoteEmail: mocks.sendNewQuoteEmail,
}));
vi.mock("@/server/quote-decision-notifications", () => ({
  sendQuoteApprovedEmail: mocks.sendQuoteApprovedEmail,
  sendQuoteRejectedEmail: mocks.sendQuoteRejectedEmail,
  sendTreatmentStartedEmail: mocks.sendTreatmentStartedEmail,
  sendCompletionRequestedEmail: mocks.sendCompletionRequestedEmail,
  sendTreatmentCompletedEmail: mocks.sendTreatmentCompletedEmail,
}));

const dbMock = {
  quote: {
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
  },
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

/** Chains five findMany results, one per block, in the order route.ts calls
 *  them: new-quote, decision, treatment-started, completion-requested,
 *  completed. Any block not under test gets an empty array. */
function queueFindMany(rows: {
  newQuote?: unknown[];
  decision?: unknown[];
  started?: unknown[];
  completionRequested?: unknown[];
  completed?: unknown[];
}) {
  dbMock.quote.findMany
    .mockResolvedValueOnce(rows.newQuote ?? [])
    .mockResolvedValueOnce(rows.decision ?? [])
    .mockResolvedValueOnce(rows.started ?? [])
    .mockResolvedValueOnce(rows.completionRequested ?? [])
    .mockResolvedValueOnce(rows.completed ?? []);
}

describe("retry-notifications cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.quote.findMany.mockResolvedValue([]);
    mocks.sendNewQuoteEmail.mockResolvedValue(true);
    mocks.sendQuoteApprovedEmail.mockResolvedValue(true);
    mocks.sendQuoteRejectedEmail.mockResolvedValue(true);
    mocks.sendTreatmentStartedEmail.mockResolvedValue(true);
    mocks.sendCompletionRequestedEmail.mockResolvedValue(true);
    mocks.sendTreatmentCompletedEmail.mockResolvedValue(true);
    process.env.CRON_SECRET = "test-secret";
  });

  it("rejects a request without the correct bearer token", async () => {
    const { GET } = await import("@/app/api/cron/retry-notifications/route");
    const res = await GET(new Request("http://x", { headers: { authorization: "Bearer wrong" } }));
    expect(res.status).toBe(401);
  });

  it("queries all five new notification columns, not just patientNotifiedAt", async () => {
    const { GET } = await import("@/app/api/cron/retry-notifications/route");
    await GET(new Request("http://x", { headers: { authorization: "Bearer test-secret" } }));

    const queriedFields = dbMock.quote.findMany.mock.calls.map((c) => Object.keys(c[0].where));
    const flat = queriedFields.flat();
    for (const field of [
      "patientNotifiedAt",
      "decisionNotifiedAt",
      "treatmentStartedNotifiedAt",
      "completionRequestedNotifiedAt",
      "completedNotifiedAt",
    ]) {
      expect(flat).toContain(field);
    }
  });

  it("decision block: an APPROVED quote sends the approved email (not rejected) and stamps decisionNotifiedAt", async () => {
    queueFindMany({
      decision: [
        {
          id: "q-approved",
          status: "APPROVED",
          requestDentist: { dentist: { email: "clinic@x.com", locale: "he", clinicName: "Clinic X" } },
        },
      ],
    });

    const { GET } = await import("@/app/api/cron/retry-notifications/route");
    await GET(new Request("http://x", { headers: { authorization: "Bearer test-secret" } }));

    expect(mocks.sendQuoteApprovedEmail).toHaveBeenCalledWith({
      to: "clinic@x.com",
      clinicName: "Clinic X",
      locale: "he",
    });
    expect(mocks.sendQuoteRejectedEmail).not.toHaveBeenCalled();
    expect(dbMock.quote.update).toHaveBeenCalledWith({
      where: { id: "q-approved" },
      data: { decisionNotifiedAt: expect.any(Date) },
    });
  });

  it("decision block: a REJECTED quote sends the rejected email (not approved) and stamps decisionNotifiedAt", async () => {
    queueFindMany({
      decision: [
        {
          id: "q-rejected",
          status: "REJECTED",
          requestDentist: { dentist: { email: "clinic@x.com", locale: "he", clinicName: "Clinic X" } },
        },
      ],
    });

    const { GET } = await import("@/app/api/cron/retry-notifications/route");
    await GET(new Request("http://x", { headers: { authorization: "Bearer test-secret" } }));

    expect(mocks.sendQuoteRejectedEmail).toHaveBeenCalledWith({
      to: "clinic@x.com",
      clinicName: "Clinic X",
      locale: "he",
    });
    expect(mocks.sendQuoteApprovedEmail).not.toHaveBeenCalled();
    expect(dbMock.quote.update).toHaveBeenCalledWith({
      where: { id: "q-rejected" },
      data: { decisionNotifiedAt: expect.any(Date) },
    });
  });

  it("treatment-started, completion-requested, and completed blocks each send and stamp their own column", async () => {
    queueFindMany({
      started: [
        {
          id: "q-started",
          requestDentist: {
            requestId: "req-1",
            dentist: { clinicName: "Clinic X" },
            request: { user: { fullName: "Dana", email: "patient1@x.com", locale: "he" } },
          },
        },
      ],
      completionRequested: [
        {
          id: "q-completion-requested",
          requestDentist: {
            requestId: "req-2",
            dentist: { clinicName: "Clinic X" },
            request: { user: { fullName: "Dana", email: "patient2@x.com", locale: "he" } },
          },
        },
      ],
      completed: [
        {
          id: "q-completed",
          requestDentist: { dentist: { email: "clinic@x.com", locale: "he", clinicName: "Clinic X" } },
        },
      ],
    });

    const { GET } = await import("@/app/api/cron/retry-notifications/route");
    await GET(new Request("http://x", { headers: { authorization: "Bearer test-secret" } }));

    expect(mocks.sendTreatmentStartedEmail).toHaveBeenCalledWith({
      to: "patient1@x.com",
      patientName: "Dana",
      clinicName: "Clinic X",
      requestId: "req-1",
      locale: "he",
    });
    expect(dbMock.quote.update).toHaveBeenCalledWith({
      where: { id: "q-started" },
      data: { treatmentStartedNotifiedAt: expect.any(Date) },
    });

    expect(mocks.sendCompletionRequestedEmail).toHaveBeenCalledWith({
      to: "patient2@x.com",
      patientName: "Dana",
      clinicName: "Clinic X",
      requestId: "req-2",
      locale: "he",
    });
    expect(dbMock.quote.update).toHaveBeenCalledWith({
      where: { id: "q-completion-requested" },
      data: { completionRequestedNotifiedAt: expect.any(Date) },
    });

    expect(mocks.sendTreatmentCompletedEmail).toHaveBeenCalledWith({
      to: "clinic@x.com",
      clinicName: "Clinic X",
      locale: "he",
    });
    expect(dbMock.quote.update).toHaveBeenCalledWith({
      where: { id: "q-completed" },
      data: { completedNotifiedAt: expect.any(Date) },
    });

    expect(dbMock.quote.update).toHaveBeenCalledTimes(3);
  });

  it("does not stamp *NotifiedAt when the send fails, leaving the row claimable on the next run", async () => {
    queueFindMany({
      started: [
        {
          id: "q-started-failed",
          requestDentist: {
            requestId: "req-3",
            dentist: { clinicName: "Clinic X" },
            request: { user: { fullName: "Dana", email: "patient3@x.com", locale: "he" } },
          },
        },
      ],
    });
    mocks.sendTreatmentStartedEmail.mockResolvedValueOnce(false);

    const { GET } = await import("@/app/api/cron/retry-notifications/route");
    await GET(new Request("http://x", { headers: { authorization: "Bearer test-secret" } }));

    expect(mocks.sendTreatmentStartedEmail).toHaveBeenCalledTimes(1);
    expect(dbMock.quote.update).not.toHaveBeenCalled();
  });
});
