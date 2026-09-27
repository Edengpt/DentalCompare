import { describe, expect, it } from "vitest";
import { adminReviewStage, clinicReviewStage } from "./clinic-review-stage";

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

describe("adminReviewStage", () => {
  it("flags a clinic with nothing to look at first", () => {
    expect(adminReviewStage({ isActive: false, documents: [] })).toMatchObject({
      stage: "noDocuments",
      tone: "danger",
    });
  });

  it("waits on the clinic once a document was sent back", () => {
    expect(adminReviewStage({ isActive: false, documents: [doc(true)] }).stage).toBe(
      "needsDocument",
    );
  });

  it("marks a live clinic that never had its licence stamped", () => {
    expect(adminReviewStage({ isActive: true, documents: [doc(false)] })).toMatchObject({
      stage: "missingStamp",
      tone: "action",
    });
  });

  it("is ready for review otherwise", () => {
    expect(adminReviewStage({ isActive: false, documents: [doc(false)] })).toMatchObject({
      stage: "reviewing",
      tone: "action",
    });
  });
});
