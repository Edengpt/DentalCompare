"use server";

import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getStripe, isPaymentsTestMode } from "@/lib/stripe";
import { PRICING } from "@/lib/constants";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

/**
 * Creates a Stripe Checkout session for the flat request fee and records a
 * PENDING Payment row keyed by the session id. Returns the hosted checkout URL
 * for the client to redirect to.
 *
 * Enforces the PRD pre-payment gates: the request must belong to the caller, be
 * PENDING, have both files uploaded, and have at least one dentist selected.
 */
export async function createCheckoutSession(requestId: string): Promise<CheckoutResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: "יש להתחבר כדי להמשיך" };

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true, email: true },
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
  // session id, and send the user straight to the success page (which fulfills).
  if (isPaymentsTestMode()) {
    const sessionId = `test_${randomUUID()}`;
    await db.payment.create({
      data: {
        userId: user.id,
        requestId: request.id,
        amountAgorot: PRICING.flatFeeILS * 100,
        providerRef: sessionId,
        status: "PENDING",
      },
    });
    return {
      ok: true,
      url: `${base}/request/${request.id}/success?session_id=${sessionId}`,
    };
  }

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PRICING.currency,
          unit_amount: PRICING.flatFeeILS * 100, // agorot
          product_data: {
            name: "DentalCompare — שליחת בקשת הצעת מחיר",
            description: `שליחת הבקשה ל-${request._count.requestDentists} רופאים`,
          },
        },
      },
    ],
    metadata: { requestId: request.id, userId: user.id },
    success_url: `${base}/request/${request.id}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/request/${request.id}/confirm`,
  });

  if (!session.url) {
    return { ok: false, error: "יצירת התשלום נכשלה — נסו שוב" };
  }

  await db.payment.create({
    data: {
      userId: user.id,
      requestId: request.id,
      amountAgorot: PRICING.flatFeeILS * 100,
      providerRef: session.id,
      status: "PENDING",
    },
  });

  return { ok: true, url: session.url };
}
