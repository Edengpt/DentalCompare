"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { sendPaymentSetupEmail } from "@/server/subscription-notifications";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function toggleDentistActive(dentistId: string): Promise<ActionResult> {
  await requireAdmin();

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: { isActive: true },
  });
  if (!dentist) return { ok: false, error: "הרופא לא נמצא" };

  await db.dentist.update({
    where: { id: dentistId },
    data: { isActive: !dentist.isActive },
  });

  revalidatePath("/admin/dentists");
  return { ok: true };
}

export async function approveClinic(dentistId: string): Promise<ActionResult> {
  await requireAdmin();

  const dentist = await db.dentist.findUnique({
    where: { id: dentistId },
    select: {
      id: true,
      email: true,
      contactName: true,
      clinicName: true,
      subscription: { select: { setupToken: true } },
    },
  });
  if (!dentist) return { ok: false, error: "המרפאה לא נמצאה" };
  if (!dentist.subscription) {
    return { ok: false, error: "למרפאה אין מנוי משויך — לא ניתן לאשר" };
  }

  await db.dentist.update({
    where: { id: dentistId },
    data: { isActive: true, submittedBySelf: false },
  });

  await sendPaymentSetupEmail({
    email: dentist.email,
    contactName: dentist.contactName,
    clinicName: dentist.clinicName,
    setupToken: dentist.subscription.setupToken,
  });

  revalidatePath("/admin/clinics");
  revalidatePath("/admin/dentists");
  revalidatePath("/admin");
  return { ok: true };
}

/** Reject (delete) a self-registered clinic that has not yet been approved. */
export async function rejectClinic(dentistId: string): Promise<ActionResult> {
  await requireAdmin();

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
  await requireAdmin();

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

  await db.dentist.create({
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
    },
  });

  revalidatePath("/admin/dentists");
  return { ok: true };
}
