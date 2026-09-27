import { describe, expect, it } from "vitest";
import {
  clinicLeadStage,
  decidedElsewhere,
  isChosen,
  LEAD_TABS,
  type LeadTab,
} from "./clinic-lead-stage";

const inTab = (
  tab: LeadTab,
  status: Parameters<typeof clinicLeadStage>[0]["status"],
  decided = false,
) => LEAD_TABS[tab].includes(clinicLeadStage({ status, decidedElsewhere: decided }).stage);

describe("clinicLeadStage", () => {
  it("asks for a quote while the request is still open", () => {
    expect(clinicLeadStage({ status: null, decidedElsewhere: false })).toMatchObject({
      stage: "needsQuote",
      tone: "action",
    });
    expect(inTab("action", null)).toBe(true);
  });

  it("closes an unanswered request once the patient chose another clinic", () => {
    expect(clinicLeadStage({ status: null, decidedElsewhere: true }).stage).toBe("missed");
    expect(inTab("action", null, true)).toBe(false);
    expect(inTab("closed", null, true)).toBe(true);
  });

  it("files a sent quote under sent", () => {
    expect(inTab("sent", "PENDING_DECISION")).toBe(true);
    expect(inTab("action", "PENDING_DECISION")).toBe(false);
  });

  it("treats being chosen as both something to act on and the start of treatment", () => {
    expect(clinicLeadStage({ status: "APPROVED", decidedElsewhere: false }).tone).toBe("action");
    expect(inTab("action", "APPROVED")).toBe(true);
    expect(inTab("treatment", "APPROVED")).toBe(true);
  });

  it("keeps treatment in progress and the wait for the patient under treatment", () => {
    expect(inTab("treatment", "IN_TREATMENT")).toBe(true);
    expect(inTab("treatment", "COMPLETION_REQUESTED")).toBe(true);
    expect(inTab("action", "COMPLETION_REQUESTED")).toBe(false);
  });

  it("closes completed and declined quotes", () => {
    expect(inTab("closed", "COMPLETED")).toBe(true);
    expect(inTab("closed", "REJECTED")).toBe(true);
  });

  it("puts every stage in 'all'", () => {
    for (const status of [null, "PENDING_DECISION", "APPROVED", "REJECTED", "COMPLETED"] as const) {
      expect(inTab("all", status)).toBe(true);
    }
  });
});

describe("decidedElsewhere", () => {
  const row = (id: string, status: "PENDING_DECISION" | "APPROVED" | "REJECTED" | null) => ({
    id,
    quote: status ? { status } : null,
  });

  it("is true only when another clinic's quote was chosen", () => {
    expect(decidedElsewhere("me", [row("me", null), row("b", "APPROVED")])).toBe(true);
    expect(decidedElsewhere("me", [row("me", null), row("b", "PENDING_DECISION")])).toBe(false);
  });

  it("does not count the clinic's own approval", () => {
    expect(decidedElsewhere("me", [row("me", "APPROVED"), row("b", "REJECTED")])).toBe(false);
  });
});

describe("isChosen", () => {
  it("covers approval through completion, and nothing before or beside it", () => {
    expect(
      ["APPROVED", "IN_TREATMENT", "COMPLETION_REQUESTED", "COMPLETED"].every((s) =>
        isChosen(s as never),
      ),
    ).toBe(true);
    expect(isChosen("PENDING_DECISION")).toBe(false);
    expect(isChosen("REJECTED")).toBe(false);
  });
});
