import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature, parseWebhook } from "./payplus";

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

  it("parses approval + token fields from the IPN payload", () => {
    const body = JSON.stringify({
      transaction: { uid: "txn_9", status_code: "000" },
      data: { setup_token: "stk_1", token: "card_tok_1", customer_uid: "cus_1" },
    });
    const parsed = parseWebhook(body);
    expect(parsed).toEqual({
      transactionUid: "txn_9",
      statusCode: "000",
      approved: true,
      setupToken: "stk_1",
      recurringToken: "card_tok_1",
      customerUid: "cus_1",
    });
  });
});
