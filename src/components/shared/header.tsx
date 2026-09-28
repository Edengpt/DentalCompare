"use client";

import { LocaleLink as Link } from "@/i18n/locale-link";
import { Show, UserButton } from "@clerk/nextjs";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { useT } from "@/i18n/provider";

export function Header() {
  const t = useT();

  // The dentist directory (/dentists) is intentionally NOT linked here — it's an
  // in-journey step (choosing clinics to compare), not a destination a visitor
  // should browse before starting a request.
  const navLinks = [
    { href: "/#how", label: t.nav.howItWorks },
    { href: "/#faq", label: t.nav.faq },
    { href: "/clinics/join", label: t.nav.clinicsJoin },
  ];

  const quietLink =
    "text-cream/80 hover:text-cream hidden text-sm font-medium transition-colors md:inline-block";

  // Navy on every page: the band the homepage hero continues, and the one
  // constant a patient sees from the first screen to the last.
  return (
    <header className="bg-teal-deep sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Logo variant="inverted" />

        <nav className="hidden items-center gap-8 md:flex" aria-label={t.nav.ariaLabel}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-cream/80 hover:text-cream text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <LanguageSwitcher inverted />

          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="border-cream/60 text-cream hover:bg-cream hover:text-teal-deep inline-flex h-9 items-center rounded-lg border px-4 text-sm font-semibold transition-colors"
            >
              {t.nav.signIn}
            </Link>
          </Show>

          <Show when="signed-in">
            <Link href="/dashboard" className={quietLink}>
              {t.nav.dashboard}
            </Link>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9",
                },
              }}
            />
          </Show>
        </div>
      </div>
    </header>
  );
}
