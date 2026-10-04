import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("server-only", () => ({}));

describe("lemonsqueezy helpers", () => {
  beforeEach(() => {
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "test-secret";
  });

  it("accepts a correctly signed body and rejects anything else", async () => {
    const { verifyLemonSqueezySignature } = await import("./lemonsqueezy");
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    const good = createHmac("sha256", "test-secret").update(body).digest("hex");
    expect(verifyLemonSqueezySignature(body, good)).toBe(true);
    expect(verifyLemonSqueezySignature(body + " ", good)).toBe(false);
    expect(verifyLemonSqueezySignature(body, null)).toBe(false);
    expect(verifyLemonSqueezySignature(body, "00")).toBe(false);
  });

  it("maps statuses so a cancelled clinic stays listed until its period ends", async () => {
    const { mapLemonSqueezyStatus } = await import("./lemonsqueezy");
    expect(mapLemonSqueezyStatus("on_trial")).toBe("TRIALING");
    expect(mapLemonSqueezyStatus("active")).toBe("ACTIVE");
    expect(mapLemonSqueezyStatus("cancelled")).toBe("ACTIVE");
    expect(mapLemonSqueezyStatus("past_due")).toBe("PAST_DUE");
    expect(mapLemonSqueezyStatus("expired")).toBe("CANCELED");
  });

  it("stays off unless explicitly enabled, even with keys present", async () => {
    const { isLemonSqueezyEnabled } = await import("./lemonsqueezy");
    Object.assign(process.env, {
      LEMONSQUEEZY_API_KEY: "k",
      LEMONSQUEEZY_STORE_ID: "1",
      LEMONSQUEEZY_VARIANT_MONTHLY: "2",
      LEMONSQUEEZY_VARIANT_YEARLY: "3",
    });
    delete process.env.LEMONSQUEEZY_ENABLED;
    expect(isLemonSqueezyEnabled()).toBe(false);
    process.env.LEMONSQUEEZY_ENABLED = "true";
    expect(isLemonSqueezyEnabled()).toBe(true);
    delete process.env.LEMONSQUEEZY_ENABLED;
  });
});
