import "server-only";
import { db } from "./db";

/**
 * Country access.
 *
 * There is deliberately no hardcoded country list anywhere in the codebase. A
 * country is a row, and adding one is an admin action rather than a release —
 * if you find yourself writing `["IL", "TR", ...]` in a component, that is the
 * bug this table exists to prevent.
 *
 * Pure helpers that don't touch the database (currency formatting, minor-unit
 * arithmetic) live in ./money, so they stay importable from client components
 * and testable without a server-only shim.
 */

/**
 * Countries live enough to offer in forms and filters.
 *
 * Always prefer this over reading Country directly: a country is created as a
 * draft (isActive = false) and stays invisible until an admin has filled in its
 * currency, insurers and required documents. Skipping the filter exposes
 * half-configured countries to users.
 */
export function getActiveCountries() {
  return db.country.findMany({ where: { isActive: true }, orderBy: { nameEn: "asc" } });
}

/** A single country by ISO 3166-1 alpha-2 code, active or not. */
export function getCountry(code: string) {
  return db.country.findUnique({ where: { code } });
}
