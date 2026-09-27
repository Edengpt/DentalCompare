import { describe, expect, it } from "vitest";
import { clinicReviewStage } from "./clinic-review-stage";

const doc = (rejected: boolean) => ({ rejectedAt: rejected ? new Date() : null });

describe("clinicReviewStage", () => {
  it("has nothing to show once the clinic is approved", () => {
    expect(clinicReviewStage({ approvedAt: new Date(), documents: [doc(false)] })).toBeNull();
  });

  it("is under review while every document stands", () => {
    expect(clinicReviewStage({ approvedAt: null, documents: [doc(false), doc(false)] })).toBe(
      "reviewing",
    );
  });

  it("waits on the clinic as soon as one document was sent back", () => {
    expect(clinicReviewStage({ approvedAt: null, documents: [doc(false), doc(true)] })).toBe(
      "needsDocument",
    );
  });
});
