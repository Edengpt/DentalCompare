"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { REQUEST_LIMITS } from "@/lib/constants";

export type SaveDentistsResult = { ok: true } | { ok: false; error: string };

/**
 * Persists the dentists a patient selected for a given request as RequestDentist
 * rows. Replaces any previous selection (the picker is the single source of
 * truth). Enforces the PRD business rules: request must belong to the caller,
 * both files must be uploaded, and 1–10 active dentists must be chosen.
 *
 * Editing is only allowed while the request is still PENDING — once it has been
 * paid for and the emails have gone out, the selection is frozen (PRD: "לא ניתן
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

  if (request.status !== "PENDING") {
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
