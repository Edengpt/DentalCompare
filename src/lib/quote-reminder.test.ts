import { describe, it, expect } from "vitest";
import { isQuoteReminderDue } from "./quote-reminder";

const arrived = new Date("2026-10-01T10:00:00Z");
const quote = {
  createdAt: arrived,
  status: "PENDING_DECISION",
  patientNotifiedAt: arrived,
  patientReminderSentAt: null,
};
const fourDaysLater = new Date("2026-10-05T10:00:00Z");

describe("isQuoteReminderDue", () => {
  it("reminds about a quote left unopened for three days", () => {
    expect(isQuoteReminderDue(quote, null, fourDaysLater)).toBe(true);
    // Opened the request before this quote arrived: still unseen.
    expect(isQuoteReminderDue(quote, new Date("2026-09-30T00:00:00Z"), fourDaysLater)).toBe(true);
  });

  it("stays quiet when the patient already looked", () => {
    expect(isQuoteReminderDue(quote, new Date("2026-10-02T00:00:00Z"), fourDaysLater)).toBe(false);
  });

  it("waits the full three days", () => {
    expect(isQuoteReminderDue(quote, null, new Date("2026-10-03T10:00:00Z"))).toBe(false);
  });

  it("never repeats, never pre-empts the first email, and skips decided quotes", () => {
    expect(
      isQuoteReminderDue({ ...quote, patientReminderSentAt: fourDaysLater }, null, fourDaysLater),
    ).toBe(false);
    expect(isQuoteReminderDue({ ...quote, patientNotifiedAt: null }, null, fourDaysLater)).toBe(
      false,
    );
    expect(isQuoteReminderDue({ ...quote, status: "APPROVED" }, null, fourDaysLater)).toBe(false);
  });
});
