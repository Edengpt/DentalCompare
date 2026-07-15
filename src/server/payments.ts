"use server";

import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isPaymentsTestMode } from "@/lib/payments-mode";
import { createOneTimePaymentPage, isPayPlusConfigured } from "@/lib/payplus";
import { PRICING } from "@/lib/constants";
import { appUrl } from "@/lib/app-url";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Starts payment for the flat request fee via PayPlus, recording a PENDING
 * Payment row and returning the hosted PayPlus page URL to redirect the patient
 * to. The Payment row is created BEFORE the PayPlus call so its id can be woven
 * into more_info ("req_<paymentId>") and the success return URL.
 *
 * Enforces the PRD pre-payment gates: the request must belong to the caller, be
 * PENDING, have both files uploaded, and have at least one dentist selected.
 */
export async function createCheckoutSession(requestId: string): Promise<CheckoutResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: "יש להתחבר כדי להמשיך" };

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true, email: true, fullName: true },
  });
  if (!user) return { ok: false, error: "המשתמש לא סונכרן עדיין — רעננו ונסו שוב" };

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      userId: true,
      status: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      _count: { select: { requestDentists: true } },
    },
  });
  if (!request || request.userId !== user.id) {
    return { ok: false, error: "הבקשה לא נמצאה" };
  }
  if (request.status === "PAID") {
    return { ok: false, error: "הבקשה כבר שולמה ונשלחה" };
  }
  if (request.status !== "PENDING") {
    return { ok: false, error: "לא ניתן לשלם על בקשה זו" };
  }
  if (!request.treatmentFileUrl || !request.xrayFileUrl) {
    return { ok: false, error: "יש להעלות תוכנית טיפול וצילום לפני התשלום" };
  }
  if (request._count.requestDentists < 1) {
    return { ok: false, error: "יש לבחור לפחות רופא אחד לפני התשלום" };
  }

  const base = appUrl();

  // Test mode: skip the real provider, record a PENDING payment with a synthetic
  // provider ref, and send the user straight to the success page (which fulfills).
  if (isPaymentsTestMode()) {
    const payment = await db.payment.create({
      data: {
        userId: user.id,
        requestId: request.id,
        amountAgorot: PRICING.flatFeeILS * 100,
        providerRef: `test_${randomUUID()}`,
        status: "PENDING",
      },
      select: { id: true },
    });
    return {
      ok: true,
      url: `${base}/request/${request.id}/success?payment=${payment.id}`,
    };
  }

  // Real payments require PayPlus to be configured. Never silently fall through
  // to a free path in production (that is what Step 2 hardened against).
  if (!isPayPlusConfigured()) {
    return { ok: false, error: "התשלומים אינם זמינים כרגע — נסו שוב מאוחר יותר" };
  }

  // Create the PENDING Payment first so we have a paymentId for more_info; the
  // real provider ref (PayPlus page_request_uid) is filled in after the call.
  const payment = await db.payment.create({
    data: {
      userId: user.id,
      requestId: request.id,
      amountAgorot: PRICING.flatFeeILS * 100,
      providerRef: `pending_${randomUUID()}`,
      status: "PENDING",
    },
    select: { id: true },
  });

  try {
    const { url, pageRequestUid } = await createOneTimePaymentPage({
      paymentId: payment.id,
      requestId: request.id,
      amountILS: PRICING.flatFeeILS,
      patientName: user.fullName,
      email: user.email,
    });

    await db.payment.update({
      where: { id: payment.id },
      data: { providerRef: pageRequestUid },
    });

    return { ok: true, url };
  } catch (err) {
    console.error("PayPlus createOneTimePaymentPage failed:", err);
    // Roll back the dangling PENDING payment so retries start clean.
    await db.payment.delete({ where: { id: payment.id } }).catch(() => {});
    return { ok: false, error: "יצירת התשלום נכשלה — נסו שוב" };
  }
}
