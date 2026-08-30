"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { isClinicDocumentBlobUrl, isDocumentTokenLive } from "@/lib/clinic-documents";
import { audit } from "@/lib/audit";

export type ReplaceResult = { ok: true } | { ok: false; error: string };

/**
 * What the replacement page is allowed to know about a clinic.
 *
 * Deliberately no blobUrl. The token is a bearer credential sitting in an inbox:
 * it is enough to GIVE us a document, and it must never become a key for reading
 * the ones already held. Returns null for an expired token too, so the page has
 * one thing to check rather than two.
 */
export async function getClinicByDocumentToken(token: string) {
  if (!token) return null;
  const clinic = await db.dentist.findUnique({
    where: { documentToken: token },
    select: {
      id: true,
      clinicName: true,
      documentTokenExpiresAt: true,
      documents: {
        where: { rejectedAt: { not: null } },
        orderBy: { kind: "asc" },
        select: { id: true, kind: true, rejectionReason: true },
      },
    },
  });
  if (!clinic) return null;
  if (!isDocumentTokenLive(clinic.documentTokenExpiresAt, new Date())) return null;
  return clinic;
}

/**
 * Accepts a replacement for a document an admin refused.
 *
 * Unauthenticated by design — the clinic has no account, and the token in its
 * inbox is the only thing it has. Three checks stand in for a session: the token
 * must still be live, the document must belong to that token's clinic, and the
 * URL must be one our own upload route produced.
 */
export async function replaceClinicDocuments(formData: FormData): Promise<ReplaceResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;

  const token = String(formData.get("token") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const url = String(formData.get("documentUrl") ?? "");
  const contentType = String(formData.get("documentType") ?? "");

  if (!token) return { ok: false, error: e.documentLinkInvalid };

  const clinic = await db.dentist.findUnique({
    where: { documentToken: token },
    select: { id: true, documentTokenExpiresAt: true },
  });
  if (!clinic) return { ok: false, error: e.documentLinkInvalid };
  if (!isDocumentTokenLive(clinic.documentTokenExpiresAt, new Date())) {
    return { ok: false, error: e.documentLinkExpired };
  }
  if (!isClinicDocumentBlobUrl(url)) return { ok: false, error: e.invalidDocument };

  // Scoped to this token's clinic: holding one clinic's link must not let
  // anyone overwrite another clinic's licence.
  const existing = await db.clinicDocument.findFirst({
    where: { id: documentId, dentistId: clinic.id },
    select: { id: true, blobUrl: true },
  });
  if (!existing) return { ok: false, error: e.documentNotFound };

  await db.clinicDocument.update({
    where: { id: existing.id },
    data: {
      blobUrl: url,
      contentType,
      uploadedAt: new Date(),
      rejectedAt: null,
      rejectionReason: null,
    },
  });

  // The superseded file has no reader left. Best-effort on purpose: a failure
  // here leaves an orphan, which is better than failing a replacement that has
  // already landed in the database.
  void del(existing.blobUrl).catch(() => {});

  await audit({
    actor: "clinic",
    action: "clinic.document_replaced",
    entity: "Dentist",
    entityId: clinic.id,
    metadata: { documentId: existing.id },
  });

  revalidatePath("/admin/clinics");
  return { ok: true };
}
