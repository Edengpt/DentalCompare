import { describe, expect, it } from "vitest";
import { requestBadge, type BadgeInput } from "./request-badge";

const sent = (over: Partial<BadgeInput> = {}): BadgeInput => ({
  status: "SENT",
  recipients: 3,
  quotes: [],
  ...over,
});

describe("requestBadge", () => {
  it("names the unfinished and the broken states before anything else", () => {
    expect(requestBadge(sent({ status: "DRAFT" })).key).toBe("draft");
    expect(requestBadge(sent({ status: "SUBMITTED" })).key).toBe("sending");
    expect(requestBadge(sent({ status: "FAILED" })).key).toBe("failed");
  });

  it("waits for clinics while no quote has come back", () => {
    const b = requestBadge(sent());
    expect(b).toMatchObject({ key: "waitingClinics", tone: "waiting", past: false });
  });

  it("asks for a decision the moment one quote is pending, even with clinics still out", () => {
    const b = requestBadge(sent({ quotes: ["PENDING_DECISION"] }));
    expect(b).toMatchObject({ key: "decisionNeeded", tone: "action", past: false });
  });

  it("reports the approval once one quote is chosen, over the auto-rejected rest", () => {
    expect(requestBadge(sent({ quotes: ["APPROVED", "REJECTED", "REJECTED"] })).key).toBe(
      "approved",
    );
  });

  it("follows the chosen quote through treatment", () => {
    expect(requestBadge(sent({ quotes: ["IN_TREATMENT", "REJECTED"] })).key).toBe("inTreatment");
    expect(requestBadge(sent({ quotes: ["COMPLETION_REQUESTED", "REJECTED"] }))).toMatchObject({
      key: "confirmCompletion",
      tone: "action",
    });
  });

  it("files a finished treatment under past requests", () => {
    expect(requestBadge(sent({ quotes: ["COMPLETED", "REJECTED"] }))).toMatchObject({
      key: "completed",
      past: true,
    });
  });

  it("closes a request only when every clinic answered and every quote was declined", () => {
    expect(requestBadge(sent({ recipients: 2, quotes: ["REJECTED", "REJECTED"] }))).toMatchObject({
      key: "closed",
      past: true,
    });
    // One clinic has yet to answer, so the request is still alive.
    expect(requestBadge(sent({ recipients: 3, quotes: ["REJECTED", "REJECTED"] })).key).toBe(
      "waitingClinics",
    );
  });
});
