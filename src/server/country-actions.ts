"use server";

import { revalidatePath } from "next/cache";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { audit } from "@/lib/audit";
import { parseCountryInput, type CountryField, type RawCountryInput } from "@/lib/country-input";

/**
 * Admin management of the Country table.
 *
 * src/lib/countries.ts promises that adding a country is an admin action rather
 * than a release. Until this file existed that promise was only half kept: the
 * table was read from everywhere and written to nowhere but the seed, so a new
 * market meant hand-editing production Postgres. These actions are the other
 * half.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

function raw(formData: FormData): RawCountryInput {
  const read = (name: string) => String(formData.get(name) ?? "");
  return {
    code: read("code"),
    nameEn: read("nameEn"),
    currency: read("currency"),
    callingCode: read("callingCode"),
    defaultLocale: read("defaultLocale"),
    insurers: read("insurers"),
    requiredDocs: read("requiredDocs"),
  };
}

/**
 * Names the field the admin has to go back and fix.
 *
 * A bare "invalid input" on a seven-field form is a guessing game, and the
 * fields most likely to be wrong (a currency that isn't ISO 4217, a calling
 * code copied with its plus) look correct at a glance.
 */
function fieldLabel(t: Dictionary, field: CountryField): string {
  const labels: Record<CountryField, string> = {
    code: t.admin.fieldCode,
    nameEn: t.admin.fieldNameEn,
    currency: t.admin.fieldCurrency,
    callingCode: t.admin.fieldCallingCode,
    defaultLocale: t.admin.fieldDefaultLocale,
    insurers: t.admin.fieldInsurers,
    requiredDocs: t.admin.fieldRequiredDocs,
  };
  return labels[field];
}

export async function createCountry(formData: FormData): Promise<ActionResult> {
  const t = await getDictionary(await getRequestLocale());
  const admin = await requireAdmin();

  const parsed = parseCountryInput(raw(formData));
  if (!parsed.ok) {
    return {
      ok: false,
      error: format(t.errors.countryInvalidField, { field: fieldLabel(t, parsed.field) }),
    };
  }

  const existing = await db.country.findUnique({
    where: { code: parsed.value.code },
    select: { code: true },
  });
  if (existing) return { ok: false, error: t.errors.countryCodeTaken };

  // Always a draft. Activation is a second, deliberate click once the admin has
  // seen the row rendered — see the isActive comment in schema.prisma.
  await db.country.create({ data: { ...parsed.value, isActive: false } });

  await audit({
    actor: admin.email,
    action: "country.create",
    entity: "Country",
    entityId: parsed.value.code,
    metadata: { ...parsed.value },
  });

  revalidatePath("/admin/countries");
  return { ok: true };
}

export async function updateCountry(formData: FormData): Promise<ActionResult> {
  const t = await getDictionary(await getRequestLocale());
  const admin = await requireAdmin();

  const parsed = parseCountryInput(raw(formData));
  if (!parsed.ok) {
    return {
      ok: false,
      error: format(t.errors.countryInvalidField, { field: fieldLabel(t, parsed.field) }),
    };
  }

  const { code, ...rest } = parsed.value;
  const existing = await db.country.findUnique({ where: { code }, select: { code: true } });
  if (!existing) return { ok: false, error: t.errors.countryNotFound };

  // The code is the primary key and half the foreign keys in the schema, so it
  // is read as an identifier here and never written.
  await db.country.update({ where: { code }, data: rest });

  await audit({
    actor: admin.email,
    action: "country.update",
    entity: "Country",
    entityId: code,
    metadata: { ...rest },
  });

  revalidatePath("/admin/countries");
  return { ok: true };
}

export async function toggleCountryActive(code: string): Promise<ActionResult> {
  const t = await getDictionary(await getRequestLocale());
  const admin = await requireAdmin();

  const country = await db.country.findUnique({ where: { code } });
  if (!country) return { ok: false, error: t.errors.countryNotFound };

  const nextActive = !country.isActive;

  if (nextActive) {
    // Re-validate the stored row rather than trusting that it came from the
    // form above: the seed writes here too, and so does anyone with psql. Same
    // parser, so "valid enough to create" and "valid enough to show users"
    // cannot drift apart.
    const parsed = parseCountryInput({
      code: country.code,
      nameEn: country.nameEn,
      currency: country.currency,
      callingCode: country.callingCode,
      defaultLocale: country.defaultLocale,
      insurers: country.insurers.join(","),
      requiredDocs: country.requiredDocs.join(","),
    });
    if (!parsed.ok) return { ok: false, error: t.errors.countryIncomplete };
  } else {
    // Switching off the last active country empties getActiveCountries(), and
    // with it the country picker that clinic registration requires — the form
    // then rejects every submission with "pick a country" and no country to
    // pick. Nothing throws, so this is the only place it can be caught.
    const otherActive = await db.country.count({
      where: { isActive: true, code: { not: code } },
    });
    if (otherActive === 0) return { ok: false, error: t.errors.countryLastActive };
  }

  await db.country.update({ where: { code }, data: { isActive: nextActive } });

  await audit({
    actor: admin.email,
    action: "country.toggle_active",
    entity: "Country",
    entityId: code,
    metadata: { isActive: nextActive },
  });

  revalidatePath("/admin/countries");
  return { ok: true };
}
