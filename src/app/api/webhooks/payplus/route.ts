import { NextResponse } from "next/server";
import { getSignatureHeader, verifyWebhookSignature, parseWebhook } from "@/lib/payplus";
import { activateSubscriptionBySetupToken } from "@/server/subscriptions";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";

export const runtime = "nodejs";

/**
 * PayPlus IPN endpoint. Clinic subscriptions are the only thing that reaches a
 * payment provider now — the patient one-time payment was removed with the
 * free-patient pivot (PRD 4.1), so this webhook never touches Request entities
 * and never triggers patient email delivery. That trigger is submitRequest().
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
    // Patients are never charged. A payload of this kind can only be a replay of
    // a pre-pivot transaction or a misrouted call — acknowledge it so PayPlus
    // stops retrying, but do nothing and make the anomaly visible.
    logEvent("warn", "payplus.webhook.unexpected_patient_payment", {
      transactionUid: parsed.transactionUid,
    });
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
