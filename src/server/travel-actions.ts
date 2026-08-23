"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Where the patient lives, and how far they would travel for this treatment.
 *
 * The country goes on the user because it is a property of the person; the
 * travel scope goes on the request because it is a property of the treatment —
 * the same patient will fly for two implants and not for a filling. Both are
 * written together only because they are asked on the same screen.
 */
export async function saveTravelChoice(formData: FormData): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: e.signInRequired };

  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) return { ok: false, error: e.userNotSynced };

  const requestId = String(formData.get("requestId") ?? "");
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, status: true },
  });
  // A request belonging to someone else and a request that does not exist get
  // the same answer, so neither confirms the other's existence.
  if (!request || request.userId !== user.id) return { ok: false, error: e.requestNotFound };
  if (request.status !== "DRAFT") return { ok: false, error: e.requestLocked };

  const activeCodes = new Set(
    (await db.country.findMany({ where: { isActive: true }, select: { code: true } })).map(
      (c) => c.code,
    ),
  );

  // The country decides which currency prices are shown in and which privacy
  // regime applies. A value invented in the form does not get to decide that.
  const countryCode = String(formData.get("countryCode") ?? "");
  if (!activeCodes.has(countryCode)) return { ok: false, error: e.mustPickCountry };

  const scopeRaw = String(formData.get("travelScope") ?? "");
  const travelScope =
    scopeRaw === "SELECTED" || scopeRaw === "ANY" || scopeRaw === "LOCAL" ? scopeRaw : "LOCAL";

  // Destinations are meaningless unless the patient said they would travel to
  // particular places, so every other scope stores none rather than carrying a
  // stale list that nothing reads.
  const destinations =
    travelScope === "SELECTED"
      ? [
          ...new Set(
            formData
              .getAll("destinations")
              .filter((v): v is string => typeof v === "string")
              .filter((code) => activeCodes.has(code)),
          ),
        ]
      : [];

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { countryCode } }),
    db.request.update({
      where: { id: request.id },
      data: { travelScope, destinationCountries: destinations },
    }),
  ]);

  revalidatePath(`/request/${request.id}/dentists`);
  return { ok: true };
}
