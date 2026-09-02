"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

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
      request: { select: { userId: true } },
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
  revalidatePath(`/request/${rd.requestId}`);
  return { ok: true };
}
