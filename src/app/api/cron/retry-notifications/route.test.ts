import { describe, it, expect, vi, beforeEach } from "vitest";

const sent: string[] = [];
vi.mock("@/server/quote-notifications", () => ({
  sendNewQuoteEmail: async () => {
    sent.push("new_quote");
    return true;
  },
}));
vi.mock("@/server/quote-decision-notifications", () => ({
  sendQuoteApprovedEmail: async () => {
    sent.push("approved");
    return true;
  },
  sendQuoteRejectedEmail: async () => {
    sent.push("rejected");
    return true;
  },
  sendTreatmentStartedEmail: async () => {
    sent.push("started");
    return true;
  },
  sendCompletionRequestedEmail: async () => {
    sent.push("completion_requested");
    return true;
  },
  sendTreatmentCompletedEmail: async () => {
    sent.push("completed");
    return true;
  },
}));

const dbMock = {
  quote: {
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
  },
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("retry-notifications cron", () => {
  beforeEach(() => {
    sent.length = 0;
    vi.clearAllMocks();
    dbMock.quote.findMany.mockResolvedValue([]);
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
});
