import { describe, it, expect, vi, afterEach } from "vitest";
import { logEvent } from "./log";

describe("logEvent", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits a single JSON line with level, event and fields on the error channel", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    logEvent("error", "payplus.webhook.fulfillment_failed", { paymentId: "p1", error: "boom" });

    expect(err).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(err.mock.calls[0][0] as string);
    expect(parsed).toEqual({
      level: "error",
      event: "payplus.webhook.fulfillment_failed",
      paymentId: "p1",
      error: "boom",
    });
  });

  it("routes info/warn to their own console channels", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logEvent("info", "x");
    logEvent("warn", "y");
    expect(log).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
