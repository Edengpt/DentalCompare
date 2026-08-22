import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SIGNING_SECRET is not set");
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(secret);

  let event: WebhookEvent;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const { id, email_addresses, phone_numbers, first_name, last_name } = event.data;
        const primaryEmail = email_addresses.find(
          (e) => e.id === event.data.primary_email_address_id,
        )?.email_address;
        const primaryPhoneEntry = phone_numbers.find(
          (p) => p.id === event.data.primary_phone_number_id,
        );

        if (!primaryEmail) {
          console.warn(`Skipping ${event.type} for ${id}: no primary email`);
          break;
        }

        // Null rather than the email — see the note on User.fullName.
        const fullName = [first_name, last_name].filter(Boolean).join(" ").trim() || null;

        // Clerk owns the SMS OTP; we mirror its verdict. Store the number either
        // way — it's the clinic's only route to the patient, so an unverified
        // number still beats none. phoneVerifiedAt is what records the verdict.
        const verified = primaryPhoneEntry?.verification?.status === "verified";
        const rawPhone = primaryPhoneEntry?.phone_number ?? null;
        const phone = rawPhone ? (normalizePhone(rawPhone) ?? rawPhone) : null;

        await db.user.upsert({
          where: { clerkUserId: id },
          update: {
            email: primaryEmail,
            fullName,
            phone,
            // Revoking is immediate; stamping is handled below so the timestamp
            // records first verification rather than drifting on every sync.
            ...(verified ? {} : { phoneVerifiedAt: null }),
          },
          create: {
            clerkUserId: id,
            email: primaryEmail,
            fullName,
            phone,
            phoneVerifiedAt: verified ? new Date() : null,
          },
        });

        if (verified) {
          await db.user.updateMany({
            where: { clerkUserId: id, phoneVerifiedAt: null },
            data: { phoneVerifiedAt: new Date() },
          });
        }

        console.log(`✓ Synced ${event.type} for ${id} (phone verified: ${verified})`);
        break;
      }

      case "user.deleted": {
        const id = event.data.id;
        if (!id) break;
        // Deleting the User row sets Payment.userId / Request.userId to null
        // (onDelete: SetNull) instead of cascading — financial and request
        // records are retained for accounting/audit, just detached from the
        // now-deleted patient.
        await db.user.deleteMany({ where: { clerkUserId: id } });
        console.log(`✓ Deleted user ${id}`);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
