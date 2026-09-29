"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { asLocale } from "@/i18n/config";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { del } from "@vercel/blob";
import {
  sendPaymentSetupEmail,
  sendFreeClinicLiveEmail,
  sendDocumentsRejectedEmail,
  sendClinicRejectedEmail,
} from "@/server/subscription-notifications";
import { audit } from "@/lib/audit";
import { trialEndFrom } from "@/lib/subscription";
import { getSubscriptionPricing } from "@/lib/subscription-pricing";
import { documentTokenExpiry, isClinicDocumentBlobUrl } from "@/lib/clinic-documents";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function toggleDentistActive(dentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const admin = await requireAdmin();

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: { isActive: true },
  });
  if (!dentist) return { ok: false, error: e.dentistNotFound };

  const nextActive = !dentist.isActive;
  await db.dentist.update({
    where: { id: dentistId },
    data: { isActive: nextActive },
  });

  await audit({
    actor: admin.email,
    action: "dentist.toggle_active",
    entity: "Dentist",
    entityId: dentistId,
    metadata: { isActive: nextActive },
  });

  revalidatePath("/admin/dentists");
  return { ok: true };
}

export async function approveClinic(dentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const admin = await requireAdmin();

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: {
      id: true,
      email: true,
      contactName: true,
      clinicName: true,
      locale: true,
      subscription: {
        select: { id: true, setupToken: true, status: true, trialDays: true, tier: true },
      },
    },
  });
  if (!dentist) return { ok: false, error: e.clinicNotFound };
  if (!dentist.subscription) {
    return { ok: false, error: e.clinicNoSubscription };
  }

  // The trial length the clinic actually agreed to at registration — not
  // whatever SubscriptionPricing.trialDays says right now. An admin changing
  // the setting after this clinic registered must not silently change what it
  // gets: it saw and agreed to dentist.subscription.trialDays, not today's value.
  //
  // Approval starts the free trial (PRD 4.4). The clock starts here, not at
  // registration: the clinic can't evaluate lead quality until it's actually
  // live in the directory, so trial days before approval would be worthless.
  const approvedAt = new Date();
  // The free tier has no trial and nothing to bill: it goes straight to ACTIVE
  // with no token and no period end, which the renewal cron already skips (the
  // same shape as an admin-created complimentary subscription).
  const isFree = dentist.subscription.tier === "FREE";
  await db.$transaction([
    // updateMany, not update: update throws when nothing matches, and
    // re-approving an already-approved clinic has to be a no-op on the stamps
    // rather than an error. The `approvedAt: null` guard is what makes it one —
    // a second approval must not re-date a licence check any more than it hands
    // out a fresh 60 free days.
    db.dentist.updateMany({
      where: { id: dentistId, approvedAt: null },
      data: {
        isActive: true,
        submittedBySelf: false,
        approvedAt,
        // One decision, two facts. Separate columns because the first is
        // answered to a regulator and the second to an accountant.
        licenceVerifiedAt: approvedAt,
        licenceVerifiedBy: admin.email,
      },
    }),
    // Only a PENDING subscription enters the trial — re-approving a clinic must
    // not hand an ACTIVE or CANCELED one a fresh 60 free days.
    db.clinicSubscription.updateMany({
      where: { id: dentist.subscription.id, status: "PENDING" },
      data: isFree
        ? { status: "ACTIVE" }
        : {
            status: "TRIALING",
            trialEndsAt: trialEndFrom(approvedAt, dentist.subscription.trialDays),
          },
    }),
  ]);

  // The guard above skips the whole row for a clinic approved earlier —
  // isActive included — so a re-approval still has to restore the listing.
  await db.dentist.update({ where: { id: dentistId }, data: { isActive: true } });

  const approvalEmail = {
    email: dentist.email,
    contactName: dentist.contactName,
    clinicName: dentist.clinicName,
    locale: asLocale(dentist.locale),
  };
  if (isFree) {
    await sendFreeClinicLiveEmail(approvalEmail);
  } else {
    await sendPaymentSetupEmail({ ...approvalEmail, setupToken: dentist.subscription.setupToken });
  }

  await audit({
    actor: admin.email,
    action: "clinic.approve",
    entity: "Dentist",
    entityId: dentistId,
    metadata: {
      clinicName: dentist.clinicName,
      tier: dentist.subscription.tier,
      trialEndsAt: isFree
        ? null
        : trialEndFrom(approvedAt, dentist.subscription.trialDays).toISOString(),
    },
  });

  revalidatePath("/admin/clinics");
  revalidatePath("/admin/dentists");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Asks a clinic for a better copy of one or more documents.
 *
 * Not a rejection: rejectClinic below deletes a clinic that should not be here
 * at all, while this one is registered, waiting, and one readable photograph
 * from approval. Nothing about its status changes — it stays unlisted and
 * unverified, because a document nobody could read is not a licence anyone saw.
 */
export async function requestBetterDocuments(
  dentistId: string,
  rejections: { documentId: string; reason: string }[],
): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const admin = await requireAdmin();

  if (rejections.length === 0) return { ok: false, error: e.documentPickOne };

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: { id: true, email: true, clinicName: true, locale: true },
  });
  if (!dentist) return { ok: false, error: e.clinicNotFound };

  // Scoped to THIS clinic. Without dentistId in the where, an admin could
  // reject another clinic's document and email the wrong people about it.
  const docs = await db.clinicDocument.findMany({
    where: { dentistId, id: { in: rejections.map((r) => r.documentId) } },
    select: { id: true, kind: true },
  });
  if (docs.length !== rejections.length) return { ok: false, error: e.documentNotFound };

  const now = new Date();
  // A fresh token every round. The clinic is sent a link and it has to be the
  // link that works; reusing one that may already have expired sends a dead
  // link and produces another round of silence.
  const token = randomUUID();

  await db.$transaction([
    ...rejections.map((r) =>
      db.clinicDocument.update({
        where: { id: r.documentId },
        data: { rejectedAt: now, rejectionReason: r.reason.trim() || null },
      }),
    ),
    db.dentist.update({
      where: { id: dentistId },
      data: { documentToken: token, documentTokenExpiresAt: documentTokenExpiry(now) },
    }),
  ]);

  const kindById = new Map(docs.map((d) => [d.id, d.kind]));
  await sendDocumentsRejectedEmail({
    email: dentist.email,
    clinicName: dentist.clinicName,
    locale: asLocale(dentist.locale),
    token,
    items: rejections.map((r) => ({
      kind: kindById.get(r.documentId) ?? "",
      reason: r.reason.trim(),
    })),
  });

  await audit({
    actor: admin.email,
    action: "clinic.documents_rejected",
    entity: "Dentist",
    entityId: dentistId,
    metadata: { documents: rejections.map((r) => r.documentId) },
  });

  revalidatePath("/admin/clinics");
  return { ok: true };
}

/**
 * Rejects a clinic that has not been approved: tells it, then removes it.
 *
 * In that order, and with its licence documents taken out of the private store
 * first. Those files are the most sensitive thing a clinic handed over, and a
 * deleted clinic row would leave them in storage with nothing pointing at them.
 * If they cannot be deleted the rejection stops before anything else happens —
 * nothing half-done, the clinic not yet told — so the admin can simply retry.
 *
 * The email cannot be retried later (the clinic is gone), so whether it went
 * out is recorded in the audit log beside the reason.
 */
export async function rejectClinic(dentistId: string, reason?: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const admin = await requireAdmin();
  const why = reason?.trim() || null;

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: {
      isActive: true,
      email: true,
      clinicName: true,
      locale: true,
      documents: { select: { blobUrl: true } },
    },
  });
  if (!dentist) return { ok: false, error: e.clinicNotFound };
  // Guard: never delete a live (isActive) dentist. Deliberately not gated on
  // submittedBySelf too — see pendingClinicsWhere in lib/clinic-approval.ts
  // for why that flag isn't a reliable signal of what's pending.
  if (dentist.isActive) {
    return { ok: false, error: e.onlyPendingCanBeRejected };
  }

  for (const doc of dentist.documents) {
    try {
      await del(doc.blobUrl);
    } catch (err) {
      console.error(`rejectClinic: could not delete document for ${dentistId}:`, err);
      return { ok: false, error: e.deleteFailed };
    }
  }

  const emailed = await sendClinicRejectedEmail({
    email: dentist.email,
    clinicName: dentist.clinicName,
    locale: asLocale(dentist.locale),
    reason: why,
  });

  await db.dentist.delete({ where: { id: dentistId } });

  await audit({
    actor: admin.email,
    action: "clinic.reject",
    entity: "Dentist",
    entityId: dentistId,
    metadata: { clinicName: dentist.clinicName, email: dentist.email, reason: why, emailed },
  });

  revalidatePath("/admin/clinics");
  revalidatePath("/admin/dentists");
  revalidatePath("/admin");
  return { ok: true };
}

function splitCsv(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createDentist(formData: FormData): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const admin = await requireAdmin();

  const clinicName = String(formData.get("clinicName") ?? "").trim();
  const dentistName = String(formData.get("dentistName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const experienceYears = Number(formData.get("experienceYears") ?? 0);

  if (!clinicName || !dentistName || !email || !phone || !city || !address) {
    return { ok: false, error: e.requiredFields };
  }
  if (!email.includes("@")) {
    return { ok: false, error: e.invalidEmail };
  }
  if (!Number.isFinite(experienceYears) || experienceYears < 0) {
    return { ok: false, error: e.invalidExperience };
  }

  const existing = await db.dentist.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: e.dentistEmailTaken };

  // This is the path used for a clinic recruited by phone, so it is the one
  // that gets used most in the early weeks. Letting it create a live clinic
  // with no document would make "every listed clinic has had its licence seen"
  // false on day one — and after publicDentistWhere requires the stamp, it
  // would create clinics that never appear at all, with no error anywhere.
  const docKinds = formData.getAll("documentKind").filter((v): v is string => typeof v === "string");
  const docUrls = formData.getAll("documentUrl").filter((v): v is string => typeof v === "string");
  const docTypes = formData.getAll("documentType").filter((v): v is string => typeof v === "string");
  const documents = docKinds
    .map((kind, i) => ({ kind, url: docUrls[i] ?? "", contentType: docTypes[i] ?? "" }))
    .filter((d) => d.url !== "");

  if (documents.length === 0) return { ok: false, error: e.documentRequired };
  if (documents.some((d) => !isClinicDocumentBlobUrl(d.url))) {
    return { ok: false, error: e.invalidDocument };
  }

  const pricing = await getSubscriptionPricing("PAYPLUS", "BASIC");

  const now = new Date();
  const dentistId = await db.$transaction(async (tx) => {
    const dentist = await tx.dentist.create({
      data: {
        clinicName,
        dentistName,
        email,
        phone,
        city,
        address,
        experienceYears: Math.floor(experienceYears),
        specialties: splitCsv(formData.get("specialties")),
        treatments: splitCsv(formData.get("treatments")),
        insurerAffiliations: splitCsv(formData.get("insurerAffiliations")),
        isActive: true,
        // The admin is looking at the document while filling this form, so
        // approval and verification are the same moment on this path too.
        approvedAt: now,
        licenceVerifiedAt: now,
        licenceVerifiedBy: admin.email,
      },
      select: { id: true },
    });

    await tx.clinicDocument.createMany({
      data: documents.map((d) => ({
        dentistId: dentist.id,
        kind: d.kind,
        blobUrl: d.url,
        contentType: d.contentType,
      })),
    });

    // Complimentary subscription: ACTIVE with no recurringToken or currentPeriodEnd
    // so the renewal cron (which requires BOTH non-null) will never charge this clinic.
    await tx.clinicSubscription.create({
      data: {
        dentistId: dentist.id,
        plan: "MONTHLY",
        priceMinor: pricing.monthlyPriceMinor,
        currency: pricing.currency,
        trialDays: pricing.trialDays,
        trialRequestCap: pricing.trialRequestCap,
        monthlyRequestCap: pricing.monthlyRequestCap,
        tier: "BASIC",
        setupToken: randomUUID(),
        status: "ACTIVE",
        currentPeriodEnd: null,
        recurringToken: null,
      },
    });

    return dentist.id;
  });

  await audit({
    actor: admin.email,
    action: "dentist.create",
    entity: "Dentist",
    entityId: dentistId,
    metadata: { clinicName, email },
  });

  revalidatePath("/admin/dentists");
  revalidatePath("/admin/subscriptions");
  return { ok: true };
}
