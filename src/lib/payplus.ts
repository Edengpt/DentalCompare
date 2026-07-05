import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = () => process.env.PAYPLUS_API_BASE ?? "";

export function isPayPlusConfigured(): boolean {
  return Boolean(
    process.env.PAYPLUS_API_KEY &&
      process.env.PAYPLUS_SECRET_KEY &&
      process.env.PAYPLUS_PAYMENT_PAGE_UID &&
      process.env.PAYPLUS_API_BASE,
  );
}

function authHeader(): string {
  // PayPlus expects credentials as a JSON string in the Authorization header.
  return JSON.stringify({
    api_key: process.env.PAYPLUS_API_KEY,
    secret_key: process.env.PAYPLUS_SECRET_KEY,
  });
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

/**
 * Generates a hosted PayPlus payment page for the first subscription charge,
 * configured to tokenize the card for future recurring charges. Returns the URL
 * to redirect the clinic to and the page-request uid for reference.
 */
export async function createSubscriptionPaymentPage(args: {
  subscriptionId: string;
  setupToken: string;
  amountILS: number;
  clinicName: string;
  email: string;
  planLabelHe: string;
}): Promise<{ url: string; pageRequestUid: string }> {
  const base = appUrl();
  const res = await fetch(`${BASE()}/PaymentPages/generateLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      payment_page_uid: process.env.PAYPLUS_PAYMENT_PAGE_UID,
      charge_method: 1, // immediate charge
      create_token: true, // tokenize the card for recurring charges
      amount: args.amountILS,
      currency_code: "ILS",
      sendEmailApproval: false,
      customer: { email: args.email, customer_name: args.clinicName },
      items: [{ name: `מנוי DentalCompare (${args.planLabelHe})`, quantity: 1, price: args.amountILS }],
      // setupToken round-trips back to us in the IPN + return URL so we can match.
      more_info: args.setupToken,
      refURL_success: `${base}/clinics/billing/return?token=${args.setupToken}&status=success`,
      refURL_failure: `${base}/clinics/billing/return?token=${args.setupToken}&status=failure`,
      refURL_callback: `${base}/api/webhooks/payplus`,
    }),
  });

  if (!res.ok) {
    throw new Error(`PayPlus generateLink failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { payment_page_link?: string; page_request_uid?: string };
  };
  const url = json.data?.payment_page_link;
  const pageRequestUid = json.data?.page_request_uid ?? "";
  if (!url) throw new Error("PayPlus generateLink returned no link");
  return { url, pageRequestUid };
}

/** Charges a previously stored card token for a renewal period. */
export async function chargeByToken(args: {
  recurringToken: string;
  payplusCustomerUid?: string | null;
  amountILS: number;
  description: string;
}): Promise<{ ok: true; transactionUid: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE()}/Transactions/Charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({
        payment_page_uid: process.env.PAYPLUS_PAYMENT_PAGE_UID,
        token: args.recurringToken,
        customer_uid: args.payplusCustomerUid ?? undefined,
        amount: args.amountILS,
        currency_code: "ILS",
        more_info: args.description,
      }),
    });
    const json = (await res.json()) as {
      results?: { status?: string; code?: string };
      data?: { transaction_uid?: string; transaction?: { uid?: string } };
    };
    const approved = json.results?.status === "success" || json.results?.code === "0";
    const txn = json.data?.transaction_uid ?? json.data?.transaction?.uid;
    if (!res.ok || !approved || !txn) {
      return { ok: false, error: `PayPlus charge declined (${json.results?.code ?? res.status})` };
    }
    return { ok: true, transactionUid: txn };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "charge error" };
  }
}

export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.PAYPLUS_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseWebhook(rawBody: string): {
  transactionUid: string;
  statusCode: string;
  approved: boolean;
  setupToken?: string;
  recurringToken?: string;
  customerUid?: string;
} {
  const json = JSON.parse(rawBody) as {
    transaction?: { uid?: string; status_code?: string };
    data?: { setup_token?: string; more_info?: string; token?: string; customer_uid?: string };
  };
  const statusCode = json.transaction?.status_code ?? "";
  return {
    transactionUid: json.transaction?.uid ?? "",
    statusCode,
    approved: statusCode === "000",
    setupToken: json.data?.setup_token ?? json.data?.more_info,
    recurringToken: json.data?.token,
    customerUid: json.data?.customer_uid,
  };
}
