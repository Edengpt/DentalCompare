"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { db } from "@/lib/db";
import { PATIENT_CONSENT_VERSION } from "@/lib/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Records that the patient agreed, and to what.
 *
 * A treatment plan and an x-ray are health data, and this is the lawful basis
 * for sending them anywhere. Both halves are stored: without the timestamp
 * there is no consent, and without the version there is no way to show what was
 * consented to — which is the same thing as having none.
 *
 * Same shape as the clinic's agreedToTermsAt / termsVersion, deliberately: one
 * pattern for "somebody agreed to a specific text at a specific moment".
 */
export async function recordConsent(requestId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: e.signInRequired };

  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) return { ok: false, error: e.userNotSynced };

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, consentAt: true },
  });
  if (!request || request.userId !== user.id) return { ok: false, error: e.requestNotFound };

  // Consent already given is left exactly as it is. It belongs to the wording
  // it was given to and the moment it was given; rewriting either is what would
  // make it unprovable. Re-ticking the box is not a new agreement.
  if (request.consentAt) return { ok: true };

  await db.request.update({
    where: { id: request.id },
    data: { consentAt: new Date(), consentVersion: PATIENT_CONSENT_VERSION },
  });

  revalidatePath(`/request/${request.id}/upload`);
  return { ok: true };
}
