"use server";

import { legacyMajor } from "@/lib/money";

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
  const admin = await requireAdmin();

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: { isActive: true },
  });
  if (!dentist) return { ok: false, error: "הרופא לא נמצא" };

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
  const admin = await requireAdmin();

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: {
      id: true,
      email: true,
      contactName: true,
      clinicName: true,
      subscription: { select: { id: true, setupToken: true, status: true } },
    },
  });
  if (!dentist) return { ok: false, error: "המרפאה לא נמצאה" };
  if (!dentist.subscription) {
    return { ok: false, error: "למרפאה אין מנוי משויך — לא ניתן לאשר" };
  }

  // Approval starts the free trial (PRD 4.4). The clock starts here, not at
  // registration: the clinic can't evaluate lead quality until it's actually
  // live in the directory, so trial days before approval would be worthless.
  const approvedAt = new Date();
  await db.$transaction([
    db.dentist.update({
      where: { id: dentistId },
      data: { isActive: true, submittedBySelf: false, approvedAt },
    }),
    // Only a PENDING subscription enters the trial — re-approving a clinic must
    // not hand an ACTIVE or CANCELED one a fresh 60 free days.
    db.clinicSubscription.updateMany({
      where: { id: dentist.subscription.id, status: "PENDING" },
      data: { status: "TRIALING", trialEndsAt: trialEndFrom(approvedAt) },
    }),
  ]);

  await sendPaymentSetupEmail({
    email: dentist.email,
    contactName: dentist.contactName,
    clinicName: dentist.clinicName,
    setupToken: dentist.subscription.setupToken,
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
  const admin = await requireAdmin();

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: { isActive: true, submittedBySelf: true },
  });
  if (!dentist) return { ok: false, error: "המרפאה לא נמצאה" };
  // Guard: only delete still-pending self-registrations, never a live dentist.
  if (dentist.isActive || !dentist.submittedBySelf) {
    return { ok: false, error: "ניתן לדחות רק הרשמות שטרם אושרו" };
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
    return { ok: false, error: "יש למלא את כל שדות החובה" };
  }
  if (!email.includes("@")) {
    return { ok: false, error: "כתובת אימייל לא תקינה" };
  }
  if (!Number.isFinite(experienceYears) || experienceYears < 0) {
    return { ok: false, error: "שנות ניסיון לא תקינות" };
  }

  const existing = await db.dentist.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "רופא עם אימייל זה כבר קיים" };

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
        hmoAffiliations: splitCsv(formData.get("hmoAffiliations")),
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
        // Legacy mirror, unread. Dropped in M4.
        priceILS: legacyMajor(
          SUBSCRIPTION_PLANS.MONTHLY.priceMinor,
          SUBSCRIPTION_PLANS.MONTHLY.currency,
        ),
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
