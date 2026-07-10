import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyWebhookSignature,
  parseWebhook,
  createOneTimePaymentPage,
  getPageRequestStatus,
} from "./payplus";

const SECRET = "test-secret";
function sign(body: string) {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

describe("payplus webhook", () => {
  beforeEach(() => {
    process.env.PAYPLUS_WEBHOOK_SECRET = SECRET;
  });

  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ transaction: { uid: "t1", status_code: "000" } });
    expect(verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rejects a tampered body or missing header", () => {
    const body = JSON.stringify({ transaction: { uid: "t1" } });
    expect(verifyWebhookSignature(body, "deadbeef")).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("parses approval + token fields from the IPN payload (legacy subscription)", () => {
    const body = JSON.stringify({
      transaction: { uid: "txn_9", status_code: "000" },
      data: { setup_token: "stk_1", token: "card_tok_1", customer_uid: "cus_1" },
    });
    const parsed = parseWebhook(body);
    expect(parsed).toEqual({
      kind: "subscription",
      transactionUid: "txn_9",
      statusCode: "000",
      approved: true,
      setupToken: "stk_1",
      recurringToken: "card_tok_1",
      customerUid: "cus_1",
    });
  });

  it("routes more_info by prefix: req_ -> patient, sub_ -> subscription, none -> legacy sub", () => {
    const patient = parseWebhook(
      JSON.stringify({ transaction: { uid: "t", status_code: "000" }, data: { more_info: "req_pay_42" } }),
    );
    expect(patient.kind).toBe("patient");
    expect(patient.kind === "patient" && patient.paymentId).toBe("pay_42");

    const sub = parseWebhook(
      JSON.stringify({ transaction: { uid: "t", status_code: "000" }, data: { more_info: "sub_setup_7" } }),
    );
    expect(sub.kind).toBe("subscription");
    expect(sub.kind === "subscription" && sub.setupToken).toBe("setup_7");

    const legacy = parseWebhook(
      JSON.stringify({ transaction: { uid: "t", status_code: "000" }, data: { more_info: "bare_token" } }),
    );
    expect(legacy.kind).toBe("subscription");
    expect(legacy.kind === "subscription" && legacy.setupToken).toBe("bare_token");
  });
});

describe("payplus payment pages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("createOneTimePaymentPage posts req_-tagged more_info, no create_token, and returns url + uid", async () => {
    vi.stubEnv("PAYPLUS_PAYMENT_PAGE_UID", "page_uid_1");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { payment_page_link: "https://pay.test/abc", page_request_uid: "pru_123" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOneTimePaymentPage({
      paymentId: "pay_1",
      requestId: "req_1",
      amountILS: 49,
      patientName: "דנה",
      email: "dana@example.com",
    });

    expect(result).toEqual({ url: "https://pay.test/abc", pageRequestUid: "pru_123" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.more_info).toBe("req_pay_1");
    expect(body).not.toHaveProperty("create_token");
    expect(body.refURL_success).toBe("https://app.test/request/req_1/success?payment=pay_1");
  });

  it("getPageRequestStatus returns approved + transactionUid for an approved page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status_code: "000", transaction_uid: "txn_ok" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await getPageRequestStatus("pru_123")).toEqual({
      approved: true,
      transactionUid: "txn_ok",
    });
  });

  it("getPageRequestStatus reports not-approved when the transaction is declined", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status_code: "001", transaction_uid: "txn_no" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await getPageRequestStatus("pru_123")).toEqual({
      approved: false,
      transactionUid: "txn_no",
    });
  });
});
