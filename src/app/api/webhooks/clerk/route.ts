import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalizeIsraeliMobile } from "@/lib/phone";

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

        const fullName = [first_name, last_name].filter(Boolean).join(" ").trim() || primaryEmail;

        // Clerk owns the SMS OTP; we mirror its verdict. Only a number Clerk has
        // actually verified counts as the qualification gate (PRD 4.2) — an
        // unverified number on the Clerk profile must not unlock submission.
        const verified = primaryPhoneEntry?.verification?.status === "verified";
        const phone = verified
          ? (normalizeIsraeliMobile(primaryPhoneEntry?.phone_number) ??
            primaryPhoneEntry?.phone_number ??
            null)
          : null;

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
