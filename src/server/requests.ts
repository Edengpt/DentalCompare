"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { REQUEST_LIMITS } from "@/lib/constants";
import { visibleSubscriptionFilter } from "@/lib/subscription";
import { fulfillRequest } from "@/server/fulfillment";

export type SaveDentistsResult = { ok: true } | { ok: false; error: string };
export type SubmitRequestResult = { ok: true; sentTo: number } | { ok: false; error: string };

/**
 * Persists the dentists a patient selected for a given request as RequestDentist
 * rows. Replaces any previous selection (the picker is the single source of
 * truth). Enforces the PRD business rules: request must belong to the caller,
 * both files must be uploaded, and 1–3 active dentists must be chosen.
 *
 * Editing is only allowed while the request is still DRAFT — once it has been
 * submitted and the emails have gone out, the selection is frozen (PRD: "לא ניתן
 * לשלוח פעמיים את אותה בקשה").
 */
export async function saveRequestDentists(
  requestId: string,
  dentistIds: string[],
): Promise<SaveDentistsResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: "יש להתחבר כדי להמשיך" };

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "המשתמש לא סונכרן עדיין — רעננו ונסו שוב" };

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      userId: true,
      status: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
    },
  });
  if (!request || request.userId !== user.id) {
    return { ok: false, error: "הבקשה לא נמצאה" };
  }

  if (request.status !== "DRAFT") {
    return { ok: false, error: "לא ניתן לערוך בקשה שכבר נשלחה" };
  }

  if (!request.treatmentFileUrl || !request.xrayFileUrl) {
    return { ok: false, error: "יש להעלות תוכנית טיפול וצילום לפני בחירת הרופאים" };
  }

  // Dedupe and validate count.
  const uniqueIds = [...new Set(dentistIds)];
  if (uniqueIds.length < REQUEST_LIMITS.minDentists) {
    return { ok: false, error: "יש לבחור לפחות רופא אחד" };
  }
  if (uniqueIds.length > REQUEST_LIMITS.maxDentists) {
    return { ok: false, error: `ניתן לבחור עד ${REQUEST_LIMITS.maxDentists} רופאים בלבד` };
  }

  // Make sure every chosen dentist actually exists and is active.
  const validCount = await db.dentist.count({
    where: { id: { in: uniqueIds }, isActive: true },
  });
  if (validCount !== uniqueIds.length) {
    return { ok: false, error: "חלק מהרופאים שנבחרו אינם זמינים יותר" };
  }

  // Replace the selection atomically.
  await db.$transaction([
    db.requestDentist.deleteMany({ where: { requestId } }),
    db.requestDentist.createMany({
      data: uniqueIds.map((dentistId) => ({ requestId, dentistId })),
    }),
  ]);

  return { ok: true };
}

/**
 * Submits a request and delivers it to the selected clinics. This replaces the
 * removed checkout action as the single trigger for the whole delivery pipeline
 * — submission is free for the patient (PRD 4.1), so there is no payment gate.
 *
 * The gates that remain are quality gates, and they are enforced here on the
 * server rather than only in the UI: without them the removal of the fee just
 * means clinics get flooded with junk and churn (PRD 4.2).
 */
export async function submitRequest(requestId: string): Promise<SubmitRequestResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: "יש להתחבר כדי להמשיך" };

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true, phoneVerifiedAt: true },
  });
  if (!user) return { ok: false, error: "המשתמש לא סונכרן עדיין — רעננו ונסו שוב" };

  // Qualification gate 1: verified phone (PRD 4.2).
  if (!user.phoneVerifiedAt) {
    return { ok: false, error: "יש לאמת את מספר הטלפון לפני שליחת הבקשה" };
  }

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      userId: true,
      status: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      requestDentists: { select: { dentistId: true } },
    },
  });
  if (!request || request.userId !== user.id) {
    return { ok: false, error: "הבקשה לא נמצאה" };
  }
  if (request.status !== "DRAFT" && request.status !== "FAILED") {
    return { ok: false, error: "הבקשה כבר נשלחה" };
  }

  // Qualification gate 2: proof of clinical intent (PRD 4.2).
  if (!request.treatmentFileUrl || !request.xrayFileUrl) {
    return { ok: false, error: "יש להעלות תוכנית טיפול וצילום לפני השליחה" };
  }

  const selectedIds = request.requestDentists.map((rd) => rd.dentistId);
  if (selectedIds.length === 0) {
    return { ok: false, error: "יש לבחור לפחות רופא אחד" };
  }

  // Re-check eligibility at send time. The directory already filters by the
  // visibility gate, but a subscription can lapse between picking and sending —
  // without this an unsubscribed clinic would receive a lead it didn't pay for.
  const eligible = await db.dentist.findMany({
    where: {
      id: { in: selectedIds },
      isActive: true,
      subscription: visibleSubscriptionFilter(),
    },
    select: { id: true },
  });
  const eligibleIds = new Set(eligible.map((d) => d.id));

  if (eligibleIds.size === 0) {
    return { ok: false, error: "המרפאות שנבחרו אינן זמינות כרגע — בחרו מרפאות אחרות" };
  }

  // Drop the now-ineligible recipients so fulfillment never emails them.
  const dropped = selectedIds.filter((id) => !eligibleIds.has(id));
  if (dropped.length > 0) {
    await db.requestDentist.deleteMany({
      where: { requestId, dentistId: { in: dropped } },
    });
  }

  await db.request.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

  const result = await fulfillRequest(requestId);
  if (!result.ok) return { ok: false, error: result.error };

  return { ok: true, sentTo: eligibleIds.size };
}
