import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

const { activateSubscriptionBySetupToken, logEvent } = vi.hoisted(() => ({
  activateSubscriptionBySetupToken: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("@/server/subscriptions", () => ({ activateSubscriptionBySetupToken }));
vi.mock("@/lib/log", () => ({ logEvent }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

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
    activateSubscriptionBySetupToken.mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
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
  });

  // Patients are never charged (PRD 4.1). A patient-shaped IPN can now only be a
  // replay of a pre-pivot transaction, so it must be acknowledged (or PayPlus
  // keeps retrying) while having no side effects — and it must be visible.
  it("acknowledges a legacy patient IPN without side effects, and logs it", async () => {
    const body = JSON.stringify({
      transaction: { uid: "t", status_code: "000" },
      data: { more_info: "req_pay_1" },
    });
    const res = await POST(reqFor(body));
    expect(res.status).toBe(200);
    expect(activateSubscriptionBySetupToken).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      "warn",
      "payplus.webhook.unexpected_patient_payment",
      expect.objectContaining({ transactionUid: "t" }),
    );
  });

  it("rejects a bad signature with 401", async () => {
    const body = JSON.stringify({
      transaction: { uid: "t", status_code: "000" },
      data: { more_info: "sub_setup_9" },
    });
    const res = await POST(reqFor(body, "deadbeef"));
    expect(res.status).toBe(401);
    expect(activateSubscriptionBySetupToken).not.toHaveBeenCalled();
  });

  it("rejects a junk payload with 400", async () => {
    const res = await POST(reqFor("not-json"));
    expect(res.status).toBe(400);
  });
});
