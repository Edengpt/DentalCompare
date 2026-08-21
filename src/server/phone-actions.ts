"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
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
  const e = (await getDictionary(await getRequestLocale())).errors;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: e.signInRequired };

  const clerkUser = await currentUser();
  if (!clerkUser) return { ok: false, error: e.cannotReadUser };

  const entry = clerkUser.phoneNumbers.find((p) => p.id === clerkUser.primaryPhoneNumberId);
  if (!entry || entry.verification?.status !== "verified") {
    return { ok: false, error: e.phoneNotVerified };
  }

  const phone = normalizePhone(entry.phoneNumber);
  if (!phone) {
    return { ok: false, error: e.phoneInvalid };
  }

  // phone is no longer unique in the schema (verification is optional, so an
  // unverified duplicate must not lock anyone out). Two *verified* accounts on
  // one number is still wrong though, so block that case explicitly.
  const taken = await db.user.findFirst({
    where: { phone, phoneVerifiedAt: { not: null }, clerkUserId: { not: clerkUserId } },
    select: { id: true },
  });
  if (taken) {
    return { ok: false, error: e.phoneTaken };
  }

  const existing = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true, phoneVerifiedAt: true },
  });
  if (!existing) return { ok: false, error: e.userNotSynced };

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
