import "server-only";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

/**
 * The reader's language for code that has no [locale] route parameter.
 *
 * API routes live outside src/app/[locale]/, so they can't take the locale from
 * the path. The proxy writes NEXT_LOCALE on every page visit, which makes it the
 * best signal available here — and it is the same value the page the caller came
 * from was rendered in.
 */
export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value && isLocale(value) ? value : defaultLocale;
}
