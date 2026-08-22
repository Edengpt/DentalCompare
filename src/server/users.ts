import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

/**
 * The primary phone on a Clerk profile plus whether Clerk verified it. The
 * number is returned either way — it's the clinic's only route to the patient,
 * so an unverified number still beats none.
 */
function phoneOf(clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  const entry = clerkUser.phoneNumbers.find((p) => p.id === clerkUser.primaryPhoneNumberId);
  if (!entry) return { phone: null, verified: false };
  return {
    phone: normalizePhone(entry.phoneNumber) ?? entry.phoneNumber,
    verified: entry.verification?.status === "verified",
  };
}

/**
 * Returns the Postgres User row for the currently signed-in Clerk user,
 * creating it on first call if the webhook hasn't fired yet (or in local
 * dev where the webhook isn't reachable). Safe to call repeatedly.
 *
 * Also reconciles phone verification on every call, so a user who verifies a
 * number in the Clerk widget isn't stuck behind the submission gate waiting for
 * a webhook that may never arrive in dev.
 */
export async function getOrCreateUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;
  if (!primaryEmail) return null;

  const { phone, verified } = phoneOf(clerkUser);

  // Null rather than the email address. Sign-up may not ask for a name at all
  // (it is a Clerk dashboard setting), and an email in a field the dentist
  // reads as the patient's name is worse than admitting we don't have one.
  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || null;

  const existing = await db.user.findUnique({ where: { clerkUserId } });
  if (!existing) {
    return db.user.create({
      data: {
        clerkUserId,
        email: primaryEmail,
        phone,
        phoneVerifiedAt: verified ? new Date() : null,
        fullName,
      },
    });
  }

  // Only write when something actually changed, so a page render doesn't issue a
  // pointless UPDATE on every request.
  const needsStamp = verified && !existing.phoneVerifiedAt;
  const needsClear = !verified && Boolean(existing.phoneVerifiedAt);
  const phoneChanged = (existing.phone ?? null) !== phone;
  if (!needsStamp && !needsClear && !phoneChanged) return existing;

  return db.user.update({
    where: { clerkUserId },
    data: {
      phone,
      ...(needsStamp ? { phoneVerifiedAt: new Date() } : {}),
      ...(needsClear ? { phoneVerifiedAt: null } : {}),
    },
  });
}
