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
      // "sub_" prefix lets the unified webhook tell subscription vs. patient
      // payments apart (parseWebhook understands it; legacy un-prefixed values
      // still parse as subscriptions).
      more_info: `sub_${args.setupToken}`,
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

/**
 * Generates a hosted PayPlus payment page for the one-time patient request fee.
 * Unlike the subscription page it does NOT tokenize the card (no create_token) —
 * there is nothing recurring to charge. The paymentId round-trips both in the
 * success return URL (?payment=) and in more_info ("req_<paymentId>") so the
 * success page and the IPN can each locate the Payment row.
 */
export async function createOneTimePaymentPage(args: {
  paymentId: string;
  requestId: string;
  amountILS: number;
  patientName: string;
  email: string;
}): Promise<{ url: string; pageRequestUid: string }> {
  const base = appUrl();
  const res = await fetch(`${BASE()}/PaymentPages/generateLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      payment_page_uid: process.env.PAYPLUS_PAYMENT_PAGE_UID,
      charge_method: 1, // immediate charge
      amount: args.amountILS,
      currency_code: "ILS",
      sendEmailApproval: false,
      customer: { email: args.email, customer_name: args.patientName },
      items: [
        {
          name: "DentalCompare — שליחת בקשת הצעת מחיר",
          quantity: 1,
          price: args.amountILS,
        },
      ],
      more_info: `req_${args.paymentId}`,
      refURL_success: `${base}/request/${args.requestId}/success?payment=${args.paymentId}`,
      refURL_failure: `${base}/request/${args.requestId}/confirm`,
      refURL_cancel: `${base}/request/${args.requestId}/confirm`,
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

/**
 * Actively verifies a payment page's outcome with PayPlus, rather than trusting
 * a status query param on the return URL. Used by the patient success page and
 * the subscription return page to confirm a transaction was really approved.
 *
 * NOTE: confirm the exact endpoint path against the PayPlus dashboard/docs
 * before go-live — the IPN-style status lookup path is not yet verified.
 */
export async function getPageRequestStatus(
  pageRequestUid: string,
): Promise<{ approved: boolean; transactionUid: string }> {
  const res = await fetch(`${BASE()}/PaymentPages/ipn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({ page_request_uid: pageRequestUid }),
  });
  if (!res.ok) return { approved: false, transactionUid: "" };
  const json = (await res.json()) as {
    results?: { status?: string; code?: string };
    data?: {
      status_code?: string;
      transaction_uid?: string;
      transaction?: { uid?: string; status_code?: string };
    };
  };
  const statusCode = json.data?.status_code ?? json.data?.transaction?.status_code;
  const transactionUid = json.data?.transaction_uid ?? json.data?.transaction?.uid ?? "";
  const approved =
    statusCode === "000" || json.results?.status === "success" || json.results?.code === "0";
  return { approved: Boolean(approved && transactionUid), transactionUid };
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

/**
 * Reads the PayPlus IPN signature from the request headers by its canonical
 * name — replacing the previous "guess between two header names" approach.
 * Defaults to "hash" (PayPlus's documented IPN header); override with
 * PAYPLUS_WEBHOOK_HEADER once the exact name is confirmed on the dashboard.
 */
export function getSignatureHeader(headers: Headers): string | null {
  return headers.get(process.env.PAYPLUS_WEBHOOK_HEADER ?? "hash");
}

export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.PAYPLUS_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * A parsed PayPlus IPN. `kind` is derived from the `more_info` prefix so the
 * unified webhook can route the two payment types:
 *   - "req_<paymentId>"  → patient one-time request fee
 *   - "sub_<setupToken>" → clinic subscription
 *   - un-prefixed        → legacy subscription (pre-prefix), matched by setupToken
 */
export type ParsedWebhook = {
  transactionUid: string;
  statusCode: string;
  approved: boolean;
  recurringToken?: string;
  customerUid?: string;
} & (
  | { kind: "patient"; paymentId: string; setupToken?: undefined }
  | { kind: "subscription"; setupToken?: string; paymentId?: undefined }
);

export function parseWebhook(rawBody: string): ParsedWebhook {
  const json = JSON.parse(rawBody) as {
    transaction?: { uid?: string; status_code?: string };
    data?: { setup_token?: string; more_info?: string; token?: string; customer_uid?: string };
  };
  const statusCode = json.transaction?.status_code ?? "";
  const common = {
    transactionUid: json.transaction?.uid ?? "",
    statusCode,
    approved: statusCode === "000",
    recurringToken: json.data?.token,
    customerUid: json.data?.customer_uid,
  };

  const moreInfo = json.data?.more_info;
  if (moreInfo?.startsWith("req_")) {
    return { ...common, kind: "patient", paymentId: moreInfo.slice(4) };
  }
  if (moreInfo?.startsWith("sub_")) {
    return { ...common, kind: "subscription", setupToken: moreInfo.slice(4) };
  }
  // Legacy / un-prefixed: subscriptions created before the prefix scheme.
  return { ...common, kind: "subscription", setupToken: json.data?.setup_token ?? moreInfo };
}
