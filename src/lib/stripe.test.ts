import { describe, it, expect, vi } from "vitest";
import { mapStripeSubscriptionStatus, isStripeConfigured } from "./stripe";

describe("mapStripeSubscriptionStatus", () => {
  it("maps trialing to TRIALING", () => {
    expect(mapStripeSubscriptionStatus("trialing")).toBe("TRIALING");
  });
  it("maps active to ACTIVE", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("ACTIVE");
  });
  it("maps past_due to PAST_DUE", () => {
    expect(mapStripeSubscriptionStatus("past_due")).toBe("PAST_DUE");
  });
  it("maps canceled, unpaid, and incomplete_expired to CANCELED", () => {
    expect(mapStripeSubscriptionStatus("canceled")).toBe("CANCELED");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("CANCELED");
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("CANCELED");
  });
  it("maps incomplete and paused to PAST_DUE — needs attention, never silently ACTIVE", () => {
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("PAST_DUE");
    expect(mapStripeSubscriptionStatus("paused")).toBe("PAST_DUE");
  });
});

describe("isStripeConfigured", () => {
  it("is false when the env vars are missing", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(isStripeConfigured()).toBe(false);
    vi.unstubAllEnvs();
  });
  it("is true when both env vars are set", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    expect(isStripeConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});
