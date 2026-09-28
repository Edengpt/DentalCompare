"use client";

import { LocaleLink as Link } from "@/i18n/locale-link";
import { Show, UserButton } from "@clerk/nextjs";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { useT } from "@/i18n/provider";

// The dentist directory (/dentists) is intentionally NOT linked here — it's an
// in-journey step (choosing clinics to compare), not a destination a visitor
// should browse before starting a request.
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

  return (
    <header className="bg-background/80 border-border/60 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex" aria-label={t.nav.ariaLabel}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-medium transition-colors md:inline-block"
            >
              {t.nav.signIn}
            </Link>
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-lg px-5 text-sm")}
            >
              {t.nav.getStarted}
            </Link>
          </Show>

          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-medium transition-colors md:inline-block"
            >
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
