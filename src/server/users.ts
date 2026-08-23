import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

/**
 * The primary phone on a Clerk profile plus whether Clerk verified it. The
 * number is returned either way — it's the clinic's only route to the patient,
 * so an unverified number still beats none.
 */
/**
 * Whether Clerk has actually verified the primary email address.
 *
 * Load-bearing for the re-link below. Clerk's dashboard requires verification
 * at sign-up today (`verify_at_sign_up: true`), but that is a setting somebody
 * can change, and this code must not quietly become a way to inherit a
 * stranger's medical file by typing their address.
 */
function primaryEmailVerified(
  clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
): boolean {
  const entry = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
  return entry?.verification?.status === "verified";
}

function phoneOf(clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  const entry = clerkUser.phoneNumbers.find((p) => p.id === clerkUser.primaryPhoneNumberId);
  if (!entry) return { phone: null, verified: false };
  return {
    phone: normalizePhone(entry.phoneNumber) ?? entry.phoneNumber,
    verified: entry.verification?.status === "verified",
  };
}

/**
 * Re-attaches an existing account to a new Clerk id, when the email proves it
 * is the same person.
 *
 * Swapping a Clerk instance — a development one for a production one — issues
 * every existing person a new clerkUserId. A lookup by that id then misses, and
 * the insert that follows hits the unique index on email: the patient gets a
 * 500 on an account they can no longer reach, with their treatment plan and
 * x-ray still behind it.
 *
 * **Only ever on a verified address.** Possession of the mailbox is the entire
 * proof that this is the same person, and without that check this function
 * would be a way to inherit a stranger's medical file by typing their address.
 * Clerk requires verification at sign-up today; the guard is here so that
 * changing that dashboard setting cannot silently make this unsafe.
 *
 * Returns the re-linked row's id, or null when there was nothing to re-link.
 * Called from two places — here and the Clerk webhook — which is why it lives
 * in one function rather than twice.
 */
export async function relinkByVerifiedEmail(
  clerkUserId: string,
  email: string,
  emailVerified: boolean,
): Promise<string | null> {
  if (!emailVerified) return null;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!existing) return null;

  await db.user.update({ where: { id: existing.id }, data: { clerkUserId } });
  return existing.id;
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
    // Swapping the Clerk instance — a development one for a production one —
    // gives every existing person a new clerkUserId. Without this, the lookup
    // above misses, the create below hits the unique index on email, and the
    // patient gets a 500 on an account they cannot reach again, with their
    // treatment plan and x-ray still behind it.
    //
    // Only ever on a verified address. Possession of the mailbox is the whole
    // proof that this is the same person.
    const relinkedId = await relinkByVerifiedEmail(
      clerkUserId,
      primaryEmail,
      primaryEmailVerified(clerkUser),
    );
    if (relinkedId) {
      const row = await db.user.findUniqueOrThrow({ where: { id: relinkedId } });
      return db.user.update({
        where: { id: relinkedId },
        data: {
          phone,
          phoneVerifiedAt: verified ? new Date() : row.phoneVerifiedAt,
          // Never trade a name we already have for one the new account lacks.
          fullName: fullName ?? row.fullName,
        },
      });
    }

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
