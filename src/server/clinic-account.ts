import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Which clinic the signed-in account speaks for, or null.
 *
 * A clinic exists long before anyone signs in for it: the public registration
 * form creates it, or an admin recruiting by phone does, and in both cases
 * there is no account yet. So the link is made on first sign-in and then
 * stamped, rather than being created alongside the clinic.
 *
 * **Only ever on a verified address.** A clinic's contact address is published
 * on its own directory listing, so if an unverified address were enough,
 * claiming someone else's clinic would be one sign-up form away. Possession of
 * the mailbox is the entire proof — the same rule `getOrCreateUser` uses to
 * relink a patient across a Clerk instance swap.
 */
export async function getClinicForCurrentUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  // The stamp is the link once it exists, and it is checked first on purpose:
  // a clinic may change its contact address afterwards, and a second clinic
  // registering the old one must not inherit the account.
  const stamped = await db.dentist.findUnique({ where: { clerkUserId } });
  if (stamped) return stamped;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const entry = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
  if (!entry || entry.verification?.status !== "verified") return null;

  const match = await db.dentist.findUnique({
    where: { email: entry.emailAddress },
    select: { id: true, clerkUserId: true },
  });
  // An unclaimed clinic only. A row already stamped with a different account
  // belongs to that account, whatever address it happens to carry now.
  if (!match || match.clerkUserId) return null;

  return db.dentist.update({ where: { id: match.id }, data: { clerkUserId } });
}
