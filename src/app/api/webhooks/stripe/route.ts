import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { fulfillPaidSession } from "@/server/fulfillment";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const result = await fulfillPaidSession(session.id);
        if (!result.ok) {
          console.error(`Fulfillment failed for ${session.id}:`, result.error);
        } else {
          console.log(`✓ Fulfilled ${session.id}: ${result.emailsSent} emails sent`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`Stripe webhook handler error for ${event.type}:`, err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
