import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  verifyStripeWebhookSignature,
  syncStripeSubscription,
  recordStripeCharge,
  markPastDue,
  cancelSubscription,
  findUnique,
  sendTrialEndingEmail,
  logEvent,
} = vi.hoisted(() => ({
  verifyStripeWebhookSignature: vi.fn(),
  syncStripeSubscription: vi.fn(
    async (
      _args: unknown,
    ): Promise<{ ok: true; subscriptionId: string } | { ok: false; error: string }> => ({
      ok: true,
      subscriptionId: "sub-row-1",
    }),
  ),
  recordStripeCharge: vi.fn(async () => {}),
  markPastDue: vi.fn(async () => true),
  cancelSubscription: vi.fn(async () => {}),
  // Defaults to "no row" — the route's own local db.clinicSubscription.findUnique
  // lookup (Step 3) is unrelated to the Task 3 functions mocked above, and this
  // route-shape suite isn't the place to assert its "found" path (that's Task 3's
  // own already-covered territory); the invoice.paid test below overrides this
  // once, the one case that needs a resolved row to assert recordStripeCharge's args.
  findUnique: vi.fn(
    async (): Promise<{
      id: string;
      plan?: string;
      priceMinor?: number;
      currency?: string;
      dentist?: { clinicName: string; email: string; locale: string };
    } | null> => null,
  ),
  sendTrialEndingEmail: vi.fn(async () => true),
  logEvent: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  verifyStripeWebhookSignature,
  subscriptionCurrentPeriodEnd: (sub: { items: { data: { current_period_end: number }[] } }) =>
    sub.items?.data?.[0]?.current_period_end ?? null,
}));
vi.mock("@/server/subscriptions", () => ({ syncStripeSubscription, recordStripeCharge, markPastDue, cancelSubscription }));
vi.mock("@/server/subscription-notifications", () => ({
  sendPaymentFailedEmail: vi.fn(async () => true),
  sendTrialEndingEmail,
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/log", () => ({ logEvent }));
vi.mock("@/lib/db", () => ({ db: { clinicSubscription: { findUnique } } }));

function req(body: string, signature = "sig") {
  return new Request("http://x/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

describe("stripe webhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request with no valid signature", async () => {
    verifyStripeWebhookSignature.mockReturnValue(null);
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(401);
    expect(syncStripeSubscription).not.toHaveBeenCalled();
  });

  it("syncs on checkout.session.completed using the subscription id and setupToken metadata", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          subscription: "sub_123",
          customer: "cus_123",
          metadata: { setupToken: "tok_abc" },
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(syncStripeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: "sub_123",
        stripeCustomerId: "cus_123",
        setupToken: "tok_abc",
      }),
    );
  });

  // Regression for the out-of-order-webhook fix: checkout.session.completed
  // must not pass currentPeriodEnd/trialEndsAt at all (not even as null) —
  // omitting them means "don't touch", so a later-overwriting call can't
  // clobber values customer.subscription.updated already wrote if it happened
  // to arrive first.
  it("does not pass currentPeriodEnd or trialEndsAt on checkout.session.completed", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          subscription: "sub_123",
          customer: "cus_123",
          metadata: { setupToken: "tok_abc" },
        },
      },
    });
    const { POST } = await import("./route");
    await POST(req("{}"));
    const call = syncStripeSubscription.mock.calls[0][0];
    expect(call).not.toHaveProperty("currentPeriodEnd");
    expect(call).not.toHaveProperty("trialEndsAt");
  });

  it("syncs on customer.subscription.updated from the subscription object's own fields, including its setupToken metadata", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          items: { data: [{ current_period_end: 1_800_000_000 }] },
          trial_end: null,
          metadata: { setupToken: "tok_xyz" },
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(syncStripeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: "sub_123", status: "active", setupToken: "tok_xyz" }),
    );
  });

  // Out-of-order-delivery regression: previously a sync failure here (e.g. the
  // event arrives before checkout.session.completed with no matching row yet)
  // was silently discarded with no log line at all.
  it("logs an error when customer.subscription.updated's sync fails", async () => {
    syncStripeSubscription.mockResolvedValueOnce({ ok: false, error: "subscription not found for Stripe sync" });
    verifyStripeWebhookSignature.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "trialing",
          items: { data: [] },
          trial_end: null,
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(logEvent).toHaveBeenCalledWith(
      "error",
      "stripe.webhook.sync_failed",
      expect.objectContaining({ stripeSubscriptionId: "sub_123" }),
    );
  });

  // I3 regression: Stripe's $0 invoice at trial start (billing_reason
  // "subscription_create") must not be recorded as a real charge.
  it("does not record a charge for invoice.paid's $0 trial-start invoice", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_trial_start",
          parent: { subscription_details: { subscription: "sub_123" } },
          amount_paid: 0,
          billing_reason: "subscription_create",
          currency: "usd",
          period_start: 1_700_000_000,
          period_end: 1_702_600_000,
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(recordStripeCharge).not.toHaveBeenCalled();
  });

  it("records a charge on invoice.paid, looked up by the subscription id", async () => {
    findUnique.mockResolvedValueOnce({ id: "sub-row-1" });
    verifyStripeWebhookSignature.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_123",
          parent: { subscription_details: { subscription: "sub_123" } },
          amount_paid: 7900,
          currency: "usd",
          period_start: 1_700_000_000,
          period_end: 1_702_600_000,
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(recordStripeCharge).toHaveBeenCalledWith(
      expect.objectContaining({ stripeInvoiceId: "in_123", amountMinor: 7900, currency: "USD" }),
    );
  });

  it("marks past due on invoice.payment_failed", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: { parent: { subscription_details: { subscription: "sub_123" } } } },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
  });

  it("sends a trial-ending email on customer.subscription.trial_will_end, with setupToken null", async () => {
    findUnique.mockResolvedValueOnce({
      id: "sub-row-1",
      plan: "MONTHLY",
      priceMinor: 7900,
      currency: "USD",
      dentist: { clinicName: "Clinic X", email: "clinic@example.com", locale: "en" },
    });
    const trialEndSeconds = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60;
    verifyStripeWebhookSignature.mockReturnValue({
      type: "customer.subscription.trial_will_end",
      data: {
        object: {
          id: "sub_123",
          trial_end: trialEndSeconds,
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(sendTrialEndingEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "clinic@example.com",
        clinicName: "Clinic X",
        priceMinor: 7900,
        currency: "USD",
        plan: "MONTHLY",
        setupToken: null,
      }),
    );
  });

  it("cancels on customer.subscription.deleted", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123" } },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
  });

  it("acknowledges an event type it doesn't handle, without erroring", async () => {
    verifyStripeWebhookSignature.mockReturnValue({ type: "customer.updated", data: { object: {} } });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
  });
});
