"use server";

import { db } from "@/lib/db";
import { COMMISSION, HMO_OPTIONS, SPECIALTIES, TREATMENTS } from "@/lib/constants";

export type RegisterClinicResult = { ok: true } | { ok: false; error: string };

/**
 * Reads a multi-select field (checkboxes that share a name) and keeps only the
 * values that belong to the allowed canonical set — so the form can never store
 * a free-typed value the rest of the app can't translate or filter on.
 */
function pickAllowed(formData: FormData, field: string, allowed: readonly string[]): string[] {
  const set = new Set(allowed);
  const chosen = formData.getAll(field).filter((v): v is string => typeof v === "string");
  return [...new Set(chosen)].filter((v) => set.has(v));
}

/**
 * Public, unauthenticated clinic self-registration. Creates a Dentist row that
 * is INACTIVE and flagged `submittedBySelf` — it stays out of the patient-facing
 * directory until an admin approves it (toggles it active). Records acceptance
 * of the commission contract (timestamp + version) for audit.
 */
export async function registerClinic(formData: FormData): Promise<RegisterClinicResult> {
  const contactName = String(formData.get("contactName") ?? "").trim();
  const dentistName = String(formData.get("dentistName") ?? "").trim();
  const clinicName = String(formData.get("clinicName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const experienceYears = Number(formData.get("experienceYears") ?? 0);
  const agreed = formData.get("agreeToTerms");

  // Optional logo: only accept a URL produced by our own blob upload endpoint.
  const logoRaw = String(formData.get("profileImageUrl") ?? "").trim();
  const profileImageUrl =
    logoRaw && /^https:\/\/[a-z0-9.-]*\.blob\.vercel-storage\.com\//i.test(logoRaw)
      ? logoRaw
      : null;

  if (!contactName || !dentistName || !clinicName || !email || !phone || !city || !address) {
    return { ok: false, error: "יש למלא את כל שדות החובה" };
  }
  if (!email.includes("@")) {
    return { ok: false, error: "כתובת אימייל לא תקינה" };
  }
  if (!Number.isFinite(experienceYears) || experienceYears < 0) {
    return { ok: false, error: "שנות ניסיון לא תקינות" };
  }
  if (agreed !== "on" && agreed !== "true") {
    return { ok: false, error: "יש לאשר את תנאי החוזה כדי להירשם" };
  }

  const existing = await db.dentist.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "כבר קיימת מרפאה רשומה עם אימייל זה" };
  }

  await db.dentist.create({
    data: {
      clinicName,
      dentistName,
      contactName,
      email,
      phone,
      city,
      address,
      experienceYears: Math.floor(experienceYears),
      specialties: pickAllowed(formData, "specialties", SPECIALTIES),
      treatments: pickAllowed(formData, "treatments", TREATMENTS),
      hmoAffiliations: pickAllowed(formData, "hmoAffiliations", HMO_OPTIONS),
      profileImageUrl,
      isActive: false,
      submittedBySelf: true,
      agreedToTermsAt: new Date(),
      termsVersion: COMMISSION.version,
    },
  });

  return { ok: true };
}
