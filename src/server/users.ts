import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Returns the Postgres User row for the currently signed-in Clerk user,
 * creating it on first call if the webhook hasn't fired yet (or in local
 * dev where the webhook isn't reachable). Safe to call repeatedly.
 */
export async function getOrCreateUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const existing = await db.user.findUnique({ where: { clerkUserId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;
  if (!primaryEmail) return null;

  const primaryPhone = clerkUser.phoneNumbers.find(
    (p) => p.id === clerkUser.primaryPhoneNumberId,
  )?.phoneNumber;

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || primaryEmail;

  return db.user.create({
    data: {
      clerkUserId,
      email: primaryEmail,
      phone: primaryPhone ?? "",
      fullName,
    },
  });
}
