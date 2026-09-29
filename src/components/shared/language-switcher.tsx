"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Languages } from "lucide-react";
import { locales, localeNames, isLocale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";

/**
 * Language dropdown, staying on the same page.
 *
 * It swaps the first path segment rather than linking to the other locale's
 * home page: someone reading the refunds policy who switches to French wants
 * the refunds policy in French, not to be dropped back at the landing page.
 *
 * Uses next/link directly, not LocaleLink — the href already carries the target
 * locale, and prefixing it again would produce /en/he/….
 */
export function LanguageSwitcher() {
  const t = useT();
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

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={t.common.switchLanguage}
        className="text-cream/80 hover:text-cream data-[popup-open]:text-cream focus-visible:outline-cream inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-2"
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        {/* The label is in its own language, never translated — a reader who
            can't read the current language still has to recognise their own. */}
        <span lang={current} className="hidden sm:inline">
          {localeNames[current]}
        </span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="z-50">
          <Menu.Popup className="bg-popover text-popover-foreground ring-foreground/10 min-w-44 rounded-lg p-1 shadow-md ring-1 outline-none">
            {locales.map((locale) => {
              const active = locale === current;
              return (
                <Menu.LinkItem
                  key={locale}
                  render={<Link href={swapLocale(locale)} />}
                  hrefLang={locale}
                  lang={locale}
                  aria-current={active ? "true" : undefined}
                  className="data-[highlighted]:bg-muted flex items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm outline-none"
                >
                  <span className={active ? "font-semibold" : undefined}>
                    {localeNames[locale]}
                  </span>
                  {active && <Check className="text-teal h-4 w-4" aria-hidden="true" />}
                </Menu.LinkItem>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
