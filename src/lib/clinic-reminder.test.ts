import { describe, it, expect } from "vitest";
import { isClinicReminderDue } from "./clinic-reminder";

const sentAt = new Date("2026-10-01T10:00:00Z");
const rd = {
  emailSent: true,
  sentAt,
  hasQuote: false,
  disputedAt: null,
  clinicReminderSentAt: null,
};
const nextDay = new Date("2026-10-02T11:00:00Z");

describe("isClinicReminderDue", () => {
  it("nudges a clinic that has not quoted after a day", () => {
    expect(isClinicReminderDue(rd, false, nextDay)).toBe(true);
  });

  it("waits the full day", () => {
    expect(isClinicReminderDue(rd, false, new Date("2026-10-02T09:00:00Z"))).toBe(false);
  });

  it("stays quiet once there is a quote, a dispute, or an earlier reminder", () => {
    expect(isClinicReminderDue({ ...rd, hasQuote: true }, false, nextDay)).toBe(false);
    expect(isClinicReminderDue({ ...rd, disputedAt: sentAt }, false, nextDay)).toBe(false);
    expect(isClinicReminderDue({ ...rd, clinicReminderSentAt: nextDay }, false, nextDay)).toBe(
      false,
    );
  });

  it("never nudges after the patient chose another clinic, or before the email went out", () => {
    expect(isClinicReminderDue(rd, true, nextDay)).toBe(false);
    expect(isClinicReminderDue({ ...rd, emailSent: false }, false, nextDay)).toBe(false);
  });
});
