"use client";

import { LocaleLink as Link } from "@/i18n/locale-link";
import { SITE_CONFIG } from "@/lib/constants";
import { useT } from "@/i18n/provider";

export function Footer() {
  const t = useT();

  const linkGroups = [
    {
      title: t.footer.groupPatients,
      links: [
        { href: "/#how", label: t.footer.howItWorks },
        { href: "/#faq", label: t.footer.faq },
        // Protected: a signed-out visitor goes through sign-in first.
        { href: "/request/new", label: t.footer.getQuotes },
      ],
    },
    {
      title: t.footer.groupClinics,
      links: [
        { href: "/clinics/join", label: t.footer.clinicsJoin },
        // The way back in for a clinic that already registered. The route is
        // protected, so a signed-out clinic is sent through sign-in and lands
        // here — which is the whole of "a clinic has a login" from its side.
        { href: "/clinics/dashboard", label: t.footer.clinicsArea },
      ],
    },
    {
      title: t.footer.groupInfo,
      links: [
        { href: "/terms", label: t.footer.terms },
        { href: "/privacy", label: t.footer.privacy },
        { href: "/cookies", label: t.footer.cookies },
        { href: "/refunds", label: t.footer.refunds },
        { href: "/accessibility", label: t.footer.accessibility },
      ],
    },
  ];

  return (
    <footer className="bg-sand">
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="font-display text-teal text-xl font-bold">
              DentalCompare
            </Link>
            <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
              {t.footer.tagline}
            </p>
          </div>

          {linkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-foreground mb-3 text-sm font-bold">{group.title}</h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-teal text-sm underline-offset-4 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border mt-10 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:justify-between">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} {SITE_CONFIG.name}. {t.footer.rights}
          </p>
          <a
            href={`mailto:${SITE_CONFIG.supportEmail}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {SITE_CONFIG.supportEmail}
          </a>
        </div>
      </div>
    </footer>
  );
}
