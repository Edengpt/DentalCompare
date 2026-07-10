import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

const { fulfillPaidSession, activateSubscriptionBySetupToken, paymentFindUnique } = vi.hoisted(
  () => ({
    fulfillPaidSession: vi.fn(),
    activateSubscriptionBySetupToken: vi.fn(),
    paymentFindUnique: vi.fn(),
  }),
);

vi.mock("@/server/fulfillment", () => ({ fulfillPaidSession }));
vi.mock("@/server/subscriptions", () => ({ activateSubscriptionBySetupToken }));
vi.mock("@/lib/db", () => ({ db: { payment: { findUnique: paymentFindUnique } } }));

import { POST } from "./route";

const SECRET = "wh-secret";
const sign = (b: string) => createHmac("sha256", SECRET).update(b).digest("hex");
const reqFor = (body: string, sig?: string) =>
  new Request("http://x/api/webhooks/payplus", {
    method: "POST",
    headers: { hash: sig ?? sign(body) },
    body,
  });

describe("payplus webhook route", () => {
  beforeEach(() => {
    vi.stubEnv("PAYPLUS_WEBHOOK_SECRET", SECRET);
    fulfillPaidSession.mockResolvedValue({ ok: true, paid: true, emailsSent: 1, alreadySent: 0 });
    activateSubscriptionBySetupToken.mockResolvedValue({ ok: true });
    paymentFindUnique.mockResolvedValue({ providerRef: "pru_1" });
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("routes an approved patient IPN to fulfillment", async () => {
    const body = JSON.stringify({
      transaction: { uid: "t", status_code: "000" },
      data: { more_info: "req_pay_1" },
    });
    const res = await POST(reqFor(body));
    expect(res.status).toBe(200);
    expect(paymentFindUnique).toHaveBeenCalledWith({
      where: { id: "pay_1" },
      select: { providerRef: true },
    });
    expect(fulfillPaidSession).toHaveBeenCalledWith("pru_1");
    expect(activateSubscriptionBySetupToken).not.toHaveBeenCalled();
  });

  it("routes an approved subscription IPN to activation", async () => {
    const body = JSON.stringify({
      transaction: { uid: "t", status_code: "000" },
      data: { more_info: "sub_setup_9", token: "card_1", customer_uid: "cus_1" },
    });
    const res = await POST(reqFor(body));
    expect(res.status).toBe(200);
    expect(activateSubscriptionBySetupToken).toHaveBeenCalledWith(
      expect.objectContaining({
        setupToken: "setup_9",
        transactionUid: "t",
        recurringToken: "card_1",
        customerUid: "cus_1",
      }),
    );
    expect(fulfillPaidSession).not.toHaveBeenCalled();
  });

  it("rejects a bad signature with 401", async () => {
    const body = JSON.stringify({
      transaction: { uid: "t", status_code: "000" },
      data: { more_info: "req_pay_1" },
    });
    const res = await POST(reqFor(body, "deadbeef"));
    expect(res.status).toBe(401);
    expect(fulfillPaidSession).not.toHaveBeenCalled();
  });

  it("rejects a junk payload with 400", async () => {
    const res = await POST(reqFor("not-json"));
    expect(res.status).toBe(400);
  });
});
