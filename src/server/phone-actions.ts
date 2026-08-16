"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalizeIsraeliMobile } from "@/lib/phone";
import { audit } from "@/lib/audit";

export type SyncPhoneResult = { ok: true } | { ok: false; error: string };

/**
 * Mirrors Clerk's phone-verification verdict into our User row.
 *
 * Clerk is the source of truth: this re-reads the profile server-side rather
 * than trusting anything the client sends, so a caller can't mark themselves
 * verified by posting a number. Called right after the OTP succeeds so the user
 * isn't left waiting on a webhook that may never reach a dev machine.
 */
export async function syncVerifiedPhone(): Promise<SyncPhoneResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: "יש להתחבר כדי להמשיך" };

  const clerkUser = await currentUser();
  if (!clerkUser) return { ok: false, error: "לא הצלחנו לקרוא את פרטי המשתמש" };

  const entry = clerkUser.phoneNumbers.find((p) => p.id === clerkUser.primaryPhoneNumberId);
  if (!entry || entry.verification?.status !== "verified") {
    return { ok: false, error: "המספר עדיין לא אומת" };
  }

  const phone = normalizeIsraeliMobile(entry.phoneNumber);
  if (!phone) {
    return { ok: false, error: "יש לאמת מספר נייד ישראלי" };
  }

  // The unique index is the real defence against one person opening unlimited
  // accounts — surface the clash as a clear message instead of a 500.
  const taken = await db.user.findFirst({
    where: { phone, clerkUserId: { not: clerkUserId } },
    select: { id: true },
  });
  if (taken) {
    return { ok: false, error: "המספר הזה כבר משויך לחשבון אחר" };
  }

  const existing = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true, phoneVerifiedAt: true },
  });
  if (!existing) return { ok: false, error: "המשתמש לא סונכרן עדיין — רעננו ונסו שוב" };

  await db.user.update({
    where: { clerkUserId },
    data: {
      phone,
      // Keep the original timestamp if this is a re-sync of an already-verified
      // number, so it records first verification.
      ...(existing.phoneVerifiedAt ? {} : { phoneVerifiedAt: new Date() }),
    },
  });

  if (!existing.phoneVerifiedAt) {
    await audit({
      actor: "system",
      action: "user.phone_verified",
      entity: "User",
      entityId: existing.id,
    });
  }

  return { ok: true };
}
