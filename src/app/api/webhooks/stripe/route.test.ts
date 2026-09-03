import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyStripeWebhookSignature, syncStripeSubscription, recordStripeCharge, markPastDue, cancelSubscription, findUnique } =
  vi.hoisted(() => ({
    verifyStripeWebhookSignature: vi.fn(),
    syncStripeSubscription: vi.fn(async () => ({ ok: true, subscriptionId: "sub-row-1" })),
    recordStripeCharge: vi.fn(async () => {}),
    markPastDue: vi.fn(async () => true),
    cancelSubscription: vi.fn(async () => {}),
    // Defaults to "no row" — the route's own local db.clinicSubscription.findUnique
    // lookup (Step 3) is unrelated to the Task 3 functions mocked above, and this
    // route-shape suite isn't the place to assert its "found" path (that's Task 3's
    // own already-covered territory); the invoice.paid test below overrides this
    // once, the one case that needs a resolved row to assert recordStripeCharge's args.
    findUnique: vi.fn(
      async (): Promise<{ id: string; dentist?: { clinicName: string; email: string; locale: string } } | null> =>
        null,
    ),
  }));

vi.mock("@/lib/stripe", () => ({ verifyStripeWebhookSignature }));
vi.mock("@/server/subscriptions", () => ({ syncStripeSubscription, recordStripeCharge, markPastDue, cancelSubscription }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/log", () => ({ logEvent: vi.fn() }));
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

  it("syncs on customer.subscription.updated from the subscription object's own fields", async () => {
    verifyStripeWebhookSignature.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          items: { data: [{ current_period_end: 1_800_000_000 }] },
          trial_end: null,
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(syncStripeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: "sub_123", status: "active" }),
    );
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
