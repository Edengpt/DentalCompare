"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { asLocale } from "@/i18n/config";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { sendPaymentSetupEmail } from "@/server/subscription-notifications";
import { audit } from "@/lib/audit";
import { trialEndFrom } from "@/lib/subscription";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";

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
      subscription: { select: { id: true, setupToken: true, status: true } },
    },
  });
  if (!dentist) return { ok: false, error: e.clinicNotFound };
  if (!dentist.subscription) {
    return { ok: false, error: e.clinicNoSubscription };
  }

  // Approval starts the free trial (PRD 4.4). The clock starts here, not at
  // registration: the clinic can't evaluate lead quality until it's actually
  // live in the directory, so trial days before approval would be worthless.
  const approvedAt = new Date();
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
      data: { status: "TRIALING", trialEndsAt: trialEndFrom(approvedAt) },
    }),
  ]);

  // The guard above skips the whole row for a clinic approved earlier —
  // isActive included — so a re-approval still has to restore the listing.
  await db.dentist.update({ where: { id: dentistId }, data: { isActive: true } });

  await sendPaymentSetupEmail({
    email: dentist.email,
    contactName: dentist.contactName,
    clinicName: dentist.clinicName,
    setupToken: dentist.subscription.setupToken,
    locale: asLocale(dentist.locale),
  });

  await audit({
    actor: admin.email,
    action: "clinic.approve",
    entity: "Dentist",
    entityId: dentistId,
    metadata: {
      clinicName: dentist.clinicName,
      trialEndsAt: trialEndFrom(approvedAt).toISOString(),
    },
  });

  revalidatePath("/admin/clinics");
  revalidatePath("/admin/dentists");
  revalidatePath("/admin");
  return { ok: true };
}

/** Reject (delete) a self-registered clinic that has not yet been approved. */
export async function rejectClinic(dentistId: string): Promise<ActionResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const admin = await requireAdmin();

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: { isActive: true, submittedBySelf: true },
  });
  if (!dentist) return { ok: false, error: e.clinicNotFound };
  // Guard: only delete still-pending self-registrations, never a live dentist.
  if (dentist.isActive || !dentist.submittedBySelf) {
    return { ok: false, error: e.onlyPendingCanBeRejected };
  }

  await db.dentist.delete({ where: { id: dentistId } });

  await audit({
    actor: admin.email,
    action: "clinic.reject",
    entity: "Dentist",
    entityId: dentistId,
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
      },
      select: { id: true },
    });

    // Complimentary subscription: ACTIVE with no recurringToken or currentPeriodEnd
    // so the renewal cron (which requires BOTH non-null) will never charge this clinic.
    await tx.clinicSubscription.create({
      data: {
        dentistId: dentist.id,
        plan: "MONTHLY",
        priceMinor: SUBSCRIPTION_PLANS.MONTHLY.priceMinor,
        currency: SUBSCRIPTION_PLANS.MONTHLY.currency,
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
