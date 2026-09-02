"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { REQUEST_LIMITS } from "@/lib/constants";
import { publicDentistWhere } from "@/lib/dentist-public";
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
  const e = (await getDictionary(await getRequestLocale())).errors;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: e.signInRequired };

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: e.userNotSynced };

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
    return { ok: false, error: e.requestNotFound };
  }

  if (request.status !== "DRAFT") {
    return { ok: false, error: e.requestLocked };
  }

  if (!request.treatmentFileUrl || !request.xrayFileUrl) {
    return { ok: false, error: e.filesRequiredBeforeDentists };
  }

  // Dedupe and validate count.
  const uniqueIds = [...new Set(dentistIds)];
  if (uniqueIds.length < REQUEST_LIMITS.minDentists) {
    return { ok: false, error: e.pickAtLeastOne };
  }
  if (uniqueIds.length > REQUEST_LIMITS.maxDentists) {
    return { ok: false, error: format(e.tooManyDentists, { max: REQUEST_LIMITS.maxDentists }) };
  }

  // Every chosen clinic must be one the directory would have offered — the same
  // gate, not a looser one. The ids travel from the browser, and `isActive`
  // alone would accept a clinic whose subscription lapsed or whose licence was
  // never checked: both are invisible in the picker but nothing re-derives the
  // selection from it on the way back.
  const validCount = await db.dentist.count({
    where: { ...publicDentistWhere(), id: { in: uniqueIds } },
  });
  if (validCount !== uniqueIds.length) {
    return { ok: false, error: e.dentistsUnavailable };
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
 * The remaining gate is the upload requirement, enforced here on the server
 * rather than only in the UI. That one is the strong filter: someone who
 * obtained and uploaded a signed treatment plan and an x-ray has already been
 * diagnosed and is shopping for a price.
 *
 * Phone verification is deliberately NOT a gate. It sat at the worst point in
 * the funnel — after the patient had done all the work — and added little on top
 * of the upload requirement. It's offered as a nudge instead, and the clinic is
 * told whether the number was verified so it can judge for itself.
 */
export async function submitRequest(requestId: string): Promise<SubmitRequestResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: e.signInRequired };

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true, phone: true },
  });
  if (!user) return { ok: false, error: e.userNotSynced };

  // A lead with no phone number at all is worthless to a clinic — calling back
  // is the entire workflow. Verified or not, there has to be a number.
  if (!user.phone) {
    return {
      ok: false,
      error: e.phoneRequiredBeforeSend,
    };
  }

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      userId: true,
      status: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      consentAt: true,
      requestDentists: { select: { dentistId: true } },
    },
  });
  if (!request || request.userId !== user.id) {
    return { ok: false, error: e.requestNotFound };
  }
  if (request.status !== "DRAFT" && request.status !== "FAILED") {
    return { ok: false, error: e.requestAlreadySent };
  }

  // Qualification gate: proof of clinical intent (PRD 4.2).
  if (!request.treatmentFileUrl || !request.xrayFileUrl) {
    return { ok: false, error: e.filesRequiredBeforeSend };
  }

  // Without consent there is no lawful basis to send health data to anyone.
  // A gate rather than a warning, and checked here rather than only in the UI:
  // this is the last point before the files actually leave.
  if (!request.consentAt) {
    return { ok: false, error: e.consentRequired };
  }

  const selectedIds = request.requestDentists.map((rd) => rd.dentistId);
  if (selectedIds.length === 0) {
    return { ok: false, error: e.pickAtLeastOne };
  }

  // Re-check eligibility at send time against the full directory gate. A
  // subscription can lapse between picking and sending — and so can a licence
  // stamp, which an admin can revoke. This is the last point before an x-ray
  // and a treatment plan leave for a clinic, so it has to ask the same question
  // the directory asks, not a subset of it.
  const eligible = await db.dentist.findMany({
    where: { ...publicDentistWhere(), id: { in: selectedIds } },
    select: { id: true },
  });
  const eligibleIds = new Set(eligible.map((d) => d.id));

  if (eligibleIds.size === 0) {
    return { ok: false, error: e.clinicsUnavailable };
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
