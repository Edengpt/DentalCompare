import "server-only";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

/**
 * The reader's language for code that has no [locale] route parameter.
 *
 * API routes and server actions live outside src/app/[locale]/, so they can't
 * take the locale from the path. The proxy writes NEXT_LOCALE on every page
 * visit, which makes it the best signal available here — it is the same value
 * the page the caller came from was rendered in.
 *
 * Falls back to the default when there is no request at all. That is not
 * defensive padding: several server actions are also called from cron jobs,
 * where cookies() throws because nothing is being served to anyone. There is no
 * reader to have a language, so the default is the only correct answer, and
 * throwing would take down a billing run over a display string.
 */
export async function getRequestLocale(): Promise<Locale> {
  try {
    const value = (await cookies()).get(LOCALE_COOKIE)?.value;
    return value && isLocale(value) ? value : defaultLocale;
  } catch {
    return defaultLocale;
  }
}
