"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Languages } from "lucide-react";
import { locales, localeNames, isLocale } from "@/i18n/config";
import { useLocale } from "@/i18n/provider";

/**
 * Switches language while staying on the same page.
 *
 * It swaps the first path segment rather than linking to the other locale's
 * home page: someone reading the refunds policy who switches to English wants
 * the refunds policy in English, not to be dropped back at the landing page.
 *
 * Uses next/link directly, not LocaleLink — the href already carries the target
 * locale, and prefixing it again would produce /en/he/….
 */
export function LanguageSwitcher() {
  const current = useLocale();
  const pathname = usePathname();

  const swapLocale = (target: string) => {
    const segments = pathname.split("/");
    // segments[0] is "" because the path starts with "/".
    if (isLocale(segments[1] ?? "")) {
      segments[1] = target;
      return segments.join("/");
    }
    return `/${target}${pathname}`;
  };

  const other = locales.filter((l) => l !== current);

  return (
    <div className="flex items-center gap-1">
      <Languages className="text-muted-foreground h-4 w-4" aria-hidden="true" />
      {other.map((locale) => (
        <Link
          key={locale}
          href={swapLocale(locale)}
          hrefLang={locale}
          // The label is in the target language, never translated — a reader who
          // can't read the current language still has to recognise their own.
          lang={locale}
          className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
        >
          {localeNames[locale]}
        </Link>
      ))}
    </div>
  );
}
