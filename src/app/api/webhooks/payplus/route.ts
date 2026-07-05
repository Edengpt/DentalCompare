import { NextResponse } from "next/server";
import { verifyWebhookSignature, parseWebhook } from "@/lib/payplus";
import { activateSubscriptionBySetupToken } from "@/server/subscriptions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  // PayPlus signs the IPN; confirm the exact header name against the dashboard.
  const signature = req.headers.get("hash") ?? req.headers.get("x-payplus-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let parsed: ReturnType<typeof parseWebhook>;
  try {
    parsed = parseWebhook(raw);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  if (parsed.approved && parsed.setupToken) {
    const result = await activateSubscriptionBySetupToken({
      setupToken: parsed.setupToken,
      transactionUid: parsed.transactionUid,
      recurringToken: parsed.recurringToken,
      customerUid: parsed.customerUid,
    });
    if (!result.ok) {
      console.error(`PayPlus activation failed for ${parsed.setupToken}:`, result.error);
    }
  }

  return NextResponse.json({ received: true });
}
