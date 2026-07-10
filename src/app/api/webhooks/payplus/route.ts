import { NextResponse } from "next/server";
import { getSignatureHeader, verifyWebhookSignature, parseWebhook } from "@/lib/payplus";
import { activateSubscriptionBySetupToken } from "@/server/subscriptions";
import { fulfillPaidSession } from "@/server/fulfillment";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Single PayPlus IPN endpoint for both payment types. parseWebhook derives the
 * kind from the more_info prefix; we dispatch patient one-time payments to
 * fulfillment and clinic subscriptions to activation.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = getSignatureHeader(req.headers);

  if (!verifyWebhookSignature(raw, signature)) {
    logEvent("warn", "payplus.webhook.bad_signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let parsed: ReturnType<typeof parseWebhook>;
  try {
    parsed = parseWebhook(raw);
  } catch {
    logEvent("warn", "payplus.webhook.bad_payload");
    return new NextResponse("Bad payload", { status: 400 });
  }

  // Only approved transactions have side effects; anything else is acknowledged.
  if (!parsed.approved) {
    return NextResponse.json({ received: true });
  }

  if (parsed.kind === "patient") {
    // more_info carries the Payment id; resolve its provider ref for fulfillment.
    const payment = await db.payment.findUnique({
      where: { id: parsed.paymentId },
      select: { providerRef: true },
    });
    if (!payment) {
      logEvent("error", "payplus.webhook.payment_not_found", { paymentId: parsed.paymentId });
    } else {
      const result = await fulfillPaidSession(payment.providerRef);
      if (!result.ok) {
        logEvent("error", "payplus.webhook.fulfillment_failed", {
          paymentId: parsed.paymentId,
          error: result.error,
        });
      } else {
        await audit({
          actor: "webhook",
          action: "request.paid",
          entity: "Payment",
          entityId: parsed.paymentId,
          metadata: { transactionUid: parsed.transactionUid, emailsSent: result.emailsSent },
        });
      }
    }
  } else if (parsed.setupToken) {
    const result = await activateSubscriptionBySetupToken({
      setupToken: parsed.setupToken,
      transactionUid: parsed.transactionUid,
      recurringToken: parsed.recurringToken,
      customerUid: parsed.customerUid,
    });
    if (!result.ok) {
      logEvent("error", "payplus.webhook.activation_failed", {
        setupToken: parsed.setupToken,
        error: result.error,
      });
    } else {
      await audit({
        actor: "webhook",
        action: "subscription.activated",
        entity: "ClinicSubscription",
        entityId: parsed.setupToken,
        metadata: { transactionUid: parsed.transactionUid },
      });
    }
  }

  return NextResponse.json({ received: true });
}
