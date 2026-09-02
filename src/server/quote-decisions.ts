"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { asLocale } from "@/i18n/config";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getClinicForCurrentUser } from "@/server/clinic-account";
import {
  sendQuoteApprovedEmail,
  sendQuoteRejectedEmail,
  sendTreatmentStartedEmail,
  sendCompletionRequestedEmail,
  sendTreatmentCompletedEmail,
} from "@/server/quote-decision-notifications";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Loads the requestDentist row and confirms the signed-in user owns its request.
 *
 * The `ok` discriminant (rather than checking for the presence of `error`) is
 * what makes the union narrow cleanly below — TypeScript's inferred return
 * type otherwise merges the branches into one shape with `error?: undefined`
 * on the success case, and `"error" in loaded` stops excluding it.
 */
async function loadOwnedRequestDentist(requestDentistId: string) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false as const, error: "signInRequired" as const };

  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) return { ok: false as const, error: "userNotSynced" as const };

  const rd = await db.requestDentist.findUnique({
    where: { id: requestDentistId },
    select: {
      id: true,
      requestId: true,
      request: { select: { userId: true, user: { select: { fullName: true, locale: true } } } },
      dentist: { select: { id: true, email: true, locale: true, clinicName: true } },
      quote: { select: { id: true, status: true } },
    },
  });
  if (!rd || rd.request.userId !== user.id || !rd.quote) {
    return { ok: false as const, error: "quoteNotFound" as const };
  }

  return { ok: true as const, rd };
}

/**
 * The patient chooses one clinic. Every other quote still awaiting a decision
 * in the same request is rejected in the same transaction — a patient travels
 * to one clinic, not several, so "approved" only ever means one thing.
 */
export async function approveQuote(requestDentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const loaded = await loadOwnedRequestDentist(requestDentistId);
  if (!loaded.ok) return { ok: false, error: e[loaded.error] };
  const { rd } = loaded;

  // Captured before the transaction: exactly the siblings that are about to
  // flip, for the notification step (Task 6) to read back afterward.
  const siblingQuoteIds = (
    await db.quote.findMany({
      where: {
        requestDentist: { requestId: rd.requestId },
        status: "PENDING_DECISION",
        NOT: { id: rd.quote!.id },
      },
      select: { id: true },
    })
  ).map((q) => q.id);

  const approved = await db.$transaction(async (tx) => {
    const result = await tx.quote.updateMany({
      where: { id: rd.quote!.id, status: "PENDING_DECISION" },
      data: { status: "APPROVED", decidedAt: new Date() },
    });
    if (result.count === 0) return false;

    if (siblingQuoteIds.length > 0) {
      await tx.quote.updateMany({
        where: { id: { in: siblingQuoteIds }, status: "PENDING_DECISION" },
        data: { status: "REJECTED", rejectedAuto: true, decidedAt: new Date() },
      });
    }
    return true;
  });

  if (!approved) return { ok: false, error: e.quoteAlreadyDecided };

  await audit({
    actor: "patient",
    action: "quote.approved",
    entity: "Quote",
    entityId: rd.quote!.id,
    metadata: { rejectedSiblings: siblingQuoteIds },
  });

  const rejectedDentists =
    siblingQuoteIds.length > 0
      ? await db.requestDentist.findMany({
          where: { quote: { id: { in: siblingQuoteIds } } },
          select: {
            quote: { select: { id: true } },
            dentist: { select: { email: true, locale: true, clinicName: true } },
          },
        })
      : [];

  if (
    await sendQuoteApprovedEmail({
      to: rd.dentist.email,
      clinicName: rd.dentist.clinicName,
      locale: asLocale(rd.dentist.locale),
    })
  ) {
    await db.quote.update({ where: { id: rd.quote!.id }, data: { decisionNotifiedAt: new Date() } });
  }

  for (const sibling of rejectedDentists) {
    if (!sibling.quote) continue;
    const sent = await sendQuoteRejectedEmail({
      to: sibling.dentist.email,
      clinicName: sibling.dentist.clinicName,
      locale: asLocale(sibling.dentist.locale),
    });
    if (sent) {
      await db.quote.update({ where: { id: sibling.quote.id }, data: { decisionNotifiedAt: new Date() } });
    }
  }

  revalidatePath(`/request/${rd.requestId}`);
  return { ok: true };
}

/** The patient declines one quote on its own, independent of any other. */
export async function rejectQuote(requestDentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const loaded = await loadOwnedRequestDentist(requestDentistId);
  if (!loaded.ok) return { ok: false, error: e[loaded.error] };
  const { rd } = loaded;

  const result = await db.quote.updateMany({
    where: { id: rd.quote!.id, status: "PENDING_DECISION" },
    data: { status: "REJECTED", rejectedAuto: false, decidedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: e.quoteAlreadyDecided };

  await audit({ actor: "patient", action: "quote.rejected", entity: "Quote", entityId: rd.quote!.id });

  if (
    await sendQuoteRejectedEmail({
      to: rd.dentist.email,
      clinicName: rd.dentist.clinicName,
      locale: asLocale(rd.dentist.locale),
    })
  ) {
    await db.quote.update({ where: { id: rd.quote!.id }, data: { decisionNotifiedAt: new Date() } });
  }

  revalidatePath(`/request/${rd.requestId}`);
  return { ok: true };
}

/**
 * Loads the requestDentist row and confirms the signed-in account is the
 * clinic it belongs to. Same discriminated-union shape as
 * `loadOwnedRequestDentist` above, for the same reason.
 */
async function loadOwnedByClinic(requestDentistId: string) {
  const clinic = await getClinicForCurrentUser();
  if (!clinic) return { ok: false as const, error: "quoteNotFound" as const };

  const rd = await db.requestDentist.findUnique({
    where: { id: requestDentistId },
    select: {
      id: true,
      requestId: true,
      dentistId: true,
      dentist: { select: { clinicName: true } },
      request: {
        select: { id: true, user: { select: { fullName: true, email: true, locale: true } } },
      },
      quote: { select: { id: true, status: true } },
    },
  });
  if (!rd || rd.dentistId !== clinic.id || !rd.quote) {
    return { ok: false as const, error: "quoteNotFound" as const };
  }

  return { ok: true as const, rd };
}

/** The clinic marks that the patient has begun treatment. Only after APPROVED. */
export async function markTreatmentStarted(requestDentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const loaded = await loadOwnedByClinic(requestDentistId);
  if (!loaded.ok) return { ok: false, error: e[loaded.error] };
  const { rd } = loaded;

  const result = await db.quote.updateMany({
    where: { id: rd.quote!.id, status: "APPROVED" },
    data: { status: "IN_TREATMENT", treatmentStartedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: e.invalidQuoteTransition };

  await audit({ actor: "clinic", action: "quote.treatment_started", entity: "Quote", entityId: rd.quote!.id });

  if (rd.request.user) {
    const sent = await sendTreatmentStartedEmail({
      to: rd.request.user.email,
      patientName: rd.request.user.fullName,
      clinicName: rd.dentist.clinicName,
      requestId: rd.requestId,
      locale: asLocale(rd.request.user.locale),
    });
    if (sent) {
      await db.quote.update({ where: { id: rd.quote!.id }, data: { treatmentStartedNotifiedAt: new Date() } });
    }
  }

  revalidatePath("/clinics/dashboard");
  return { ok: true };
}

/** The clinic asks the patient to confirm the treatment is done. Only after IN_TREATMENT. */
export async function requestCompletionConfirmation(requestDentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const loaded = await loadOwnedByClinic(requestDentistId);
  if (!loaded.ok) return { ok: false, error: e[loaded.error] };
  const { rd } = loaded;

  const result = await db.quote.updateMany({
    where: { id: rd.quote!.id, status: "IN_TREATMENT" },
    data: { status: "COMPLETION_REQUESTED", completionRequestedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: e.invalidQuoteTransition };

  await audit({
    actor: "clinic",
    action: "quote.completion_requested",
    entity: "Quote",
    entityId: rd.quote!.id,
  });

  if (rd.request.user) {
    const sent = await sendCompletionRequestedEmail({
      to: rd.request.user.email,
      patientName: rd.request.user.fullName,
      clinicName: rd.dentist.clinicName,
      requestId: rd.requestId,
      locale: asLocale(rd.request.user.locale),
    });
    if (sent) {
      await db.quote.update({
        where: { id: rd.quote!.id },
        data: { completionRequestedNotifiedAt: new Date() },
      });
    }
  }

  revalidatePath("/clinics/dashboard");
  return { ok: true };
}

/**
 * The patient confirms treatment is actually done — a one-sided "completed"
 * from the clinic is not enough, because the clinic is the party whose
 * completion rate benefits from saying so.
 */
export async function confirmCompletion(requestDentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const loaded = await loadOwnedRequestDentist(requestDentistId);
  if (!loaded.ok) return { ok: false, error: e[loaded.error] };
  const { rd } = loaded;

  const result = await db.quote.updateMany({
    where: { id: rd.quote!.id, status: "COMPLETION_REQUESTED" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: e.invalidQuoteTransition };

  await audit({ actor: "patient", action: "quote.completed", entity: "Quote", entityId: rd.quote!.id });

  if (
    await sendTreatmentCompletedEmail({
      to: rd.dentist.email,
      clinicName: rd.dentist.clinicName,
      locale: asLocale(rd.dentist.locale),
    })
  ) {
    await db.quote.update({ where: { id: rd.quote!.id }, data: { completedNotifiedAt: new Date() } });
  }

  revalidatePath(`/request/${rd.requestId}`);
  return { ok: true };
}
