"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes a request and the files uploaded with it, at the patient's request.
 *
 * Until this existed there was no way for a patient to remove their own data,
 * and the uploaded files were never removed at all — not even when the Clerk
 * account was deleted, which only detached the request from its user.
 *
 * **Files first, row second, and the order is the whole design.** If the blob
 * store fails, the row survives and the patient can try again. The other way
 * round leaves an x-ray in storage with nothing pointing at it: a file nobody
 * knows exists and nobody will ever delete.
 */
export async function deleteRequest(requestId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: e.signInRequired };

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true, email: true },
  });
  if (!user) return { ok: false, error: e.userNotSynced };

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, treatmentFileUrl: true, xrayFileUrl: true },
  });
  if (!request || request.userId !== user.id) return { ok: false, error: e.requestNotFound };

  for (const url of [request.treatmentFileUrl, request.xrayFileUrl]) {
    if (!url) continue;
    try {
      await del(url);
    } catch (err) {
      // Stop rather than continue. Reporting a deletion that only half happened
      // is worse than reporting a failure the patient can retry.
      logEvent("error", "request.delete_blob_failed", { requestId, error: String(err) });
      return { ok: false, error: e.deleteFailed };
    }
  }

  // RequestDentist and Quote go with it — onDelete: Cascade in the schema.
  await db.request.delete({ where: { id: request.id } });

  await audit({
    actor: user.email,
    action: "request.deleted_by_patient",
    entity: "Request",
    entityId: requestId,
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
