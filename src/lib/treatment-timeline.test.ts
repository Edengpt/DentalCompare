import { describe, expect, it } from "vitest";
import { treatmentTimeline, type TimelineInput } from "./treatment-timeline";

const day = (d: number) => new Date(Date.UTC(2026, 8, d));

const input = (over: Partial<TimelineInput>): TimelineInput => ({
  status: "APPROVED",
  decidedAt: day(1),
  treatmentStartedAt: null,
  treatmentStartedBy: null,
  completionRequestedAt: null,
  completedAt: null,
  ...over,
});

const states = (i: TimelineInput) => treatmentTimeline(i).map((s) => `${s.key}:${s.state}`);

describe("treatmentTimeline", () => {
  it("after approval, points at the start as the next thing to happen", () => {
    expect(states(input({}))).toEqual([
      "approved:done",
      "started:current",
      "completionRequested:upcoming",
      "completed:upcoming",
    ]);
  });

  it("dates each step that happened, and only those", () => {
    const steps = treatmentTimeline(
      input({ status: "IN_TREATMENT", treatmentStartedAt: day(3), treatmentStartedBy: "PATIENT" }),
    );
    expect(steps.map((s) => s.at)).toEqual([day(1), day(3), null, null]);
    expect(steps[1]).toMatchObject({ state: "done", by: "PATIENT" });
    expect(steps[2]?.state).toBe("current");
  });

  it("waits on the patient once the clinic asks for confirmation", () => {
    expect(
      states(
        input({
          status: "COMPLETION_REQUESTED",
          treatmentStartedAt: day(3),
          completionRequestedAt: day(9),
        }),
      ),
    ).toEqual(["approved:done", "started:done", "completionRequested:done", "completed:current"]);
  });

  it("marks everything done once completed", () => {
    const steps = treatmentTimeline(
      input({
        status: "COMPLETED",
        treatmentStartedAt: day(3),
        completionRequestedAt: day(9),
        completedAt: day(10),
      }),
    );
    expect(steps.every((s) => s.state === "done")).toBe(true);
  });

  it("treats a start with no recorded actor as the clinic's", () => {
    const steps = treatmentTimeline(
      input({ status: "IN_TREATMENT", treatmentStartedAt: day(3), treatmentStartedBy: null }),
    );
    expect(steps[1]?.by).toBe("CLINIC");
  });
});
