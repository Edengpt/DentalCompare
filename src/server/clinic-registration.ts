"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import {
  SPECIALTIES,
  TREATMENTS,
  SUBSCRIPTION_CONTRACT_VERSION,
  RATE_LIMITS,
} from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { createPendingSubscription } from "@/server/subscriptions";

async function clientIp(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

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
 * of the subscription contract (timestamp + version) for audit.
 */
export async function registerClinic(formData: FormData): Promise<RegisterClinicResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const ip = await clientIp();
  const rl = await rateLimit(
    `clinic-join:${ip}`,
    RATE_LIMITS.clinicRegister.limit,
    RATE_LIMITS.clinicRegister.windowMs,
  );
  if (!rl.allowed) {
    return { ok: false, error: e.tooManyRegistrations };
  }

  const contactName = String(formData.get("contactName") ?? "").trim();
  const dentistName = String(formData.get("dentistName") ?? "").trim();
  const clinicName = String(formData.get("clinicName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const experienceYears = Number(formData.get("experienceYears") ?? 0);
  const agreed = formData.get("agreeToTerms");
  const planRaw = String(formData.get("plan") ?? "");
  const plan = planRaw === "MONTHLY" || planRaw === "YEARLY" ? planRaw : null;

  // Optional logo: only accept a URL produced by our own blob upload endpoint.
  const logoRaw = String(formData.get("profileImageUrl") ?? "").trim();
  const profileImageUrl =
    logoRaw && /^https:\/\/[a-z0-9.-]*\.blob\.vercel-storage\.com\//i.test(logoRaw)
      ? logoRaw
      : null;

  if (!contactName || !dentistName || !clinicName || !email || !phoneRaw || !city || !address) {
    return { ok: false, error: e.requiredFields };
  }
  if (!email.includes("@")) {
    return { ok: false, error: e.invalidEmail };
  }
  if (!Number.isFinite(experienceYears) || experienceYears < 0) {
    return { ok: false, error: e.invalidExperience };
  }
  if (agreed !== "on" && agreed !== "true") {
    return { ok: false, error: e.mustAcceptTerms };
  }
  if (!plan) {
    return { ok: false, error: e.mustPickPlan };
  }

  // The country has to be one we actually operate in. Trusting the submitted
  // value would let a clinic attach itself to a draft country that has no
  // currency and no licence requirements configured.
  const countryCode = String(formData.get("countryCode") ?? "").trim();
  const country = await db.country.findFirst({
    where: { code: countryCode, isActive: true },
    select: { code: true, insurers: true, defaultLocale: true },
  });
  if (!country) {
    return { ok: false, error: e.mustPickCountry };
  }

  // Read the number against the clinic's own country, so a Hungarian clinic can
  // type its local format and still be stored as canonical E.164. Clinic phones
  // are a contact detail rather than an SMS gate, so an unparseable one is kept
  // as typed rather than blocking the registration.
  const phone = normalizePhone(phoneRaw, country.code) ?? phoneRaw;

  const existing = await db.dentist.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, error: e.clinicEmailTaken };
  }

  const setupToken = randomUUID();

  // Both writes must succeed or fail together: an orphaned Dentist with no
  // subscription would prevent the clinic from ever re-registering.
  await db.$transaction(async (tx) => {
    const dentist = await tx.dentist.create({
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
        countryCode: country.code,
        locale: country.defaultLocale,
        // Validated against THIS country's payer list, not a global constant —
        // otherwise a clinic could claim an affiliation that doesn't exist where
        // it operates.
        insurerAffiliations: pickAllowed(formData, "insurerAffiliations", country.insurers),
        profileImageUrl,
        isActive: false,
        submittedBySelf: true,
        agreedToTermsAt: new Date(),
        termsVersion: SUBSCRIPTION_CONTRACT_VERSION,
      },
      select: { id: true },
    });

    await createPendingSubscription({ dentistId: dentist.id, plan, setupToken }, tx);
  });

  return { ok: true };
}
