import { describe, expect, it } from "vitest";
import { scrubEvent, scrubText } from "./sentry-scrub";

describe("scrubText", () => {
  it("removes email addresses and phone numbers", () => {
    expect(scrubText("Failed to send email to dana.k@clinic.co.il:")).toBe(
      "Failed to send email to [email]:",
    );
    expect(scrubText("call +972 52-123-4567 now")).toBe("call [phone] now");
  });

  it("leaves ids, dates and status codes alone", () => {
    const s = "request 3f2a9c1e failed with status 500 on 2026-10-18";
    expect(scrubText(s)).toBe(s);
  });
});

describe("scrubEvent", () => {
  it("walks nested event fields", () => {
    const event = {
      message: "to a@b.co",
      extra: { args: ["x", { to: "c@d.io" }] },
      exception: { values: [{ value: "Resend error for e@f.com" }] },
    };
    expect(scrubEvent(event)).toEqual({
      message: "to [email]",
      extra: { args: ["x", { to: "[email]" }] },
      exception: { values: [{ value: "Resend error for [email]" }] },
    });
  });
});
