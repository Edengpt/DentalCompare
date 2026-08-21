"use client";

import { LocaleLink as Link } from "@/i18n/locale-link";
import { Logo } from "./logo";
import { SITE_CONFIG } from "@/lib/constants";
import { useT } from "@/i18n/provider";

export function Footer() {
  const t = useT();

  const linkGroups = [
    {
      title: t.footer.groupProduct,
      links: [
        { href: "#how", label: t.footer.howItWorks },
        { href: "#benefits", label: t.footer.benefits },
        { href: "#faq", label: t.footer.faq },
      ],
    },
    {
      title: t.footer.groupCompany,
      links: [
        { href: "/about", label: t.footer.about },
        { href: "/contact", label: t.footer.contact },
        { href: "/clinics/join", label: t.footer.clinicsJoin },
      ],
    },
    {
      title: t.footer.groupLegal,
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
    <footer className="border-border/60 bg-background border-t">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo />
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              {t.footer.tagline}
            </p>
          </div>

          {linkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-foreground mb-4 text-sm font-semibold">{group.title}</h3>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border/60 mt-12 flex flex-col items-start justify-between gap-4 border-t pt-8 md:flex-row md:items-center">
          <p className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} {SITE_CONFIG.name}. {t.footer.rights}
          </p>
          <p className="text-muted-foreground text-xs">
            {t.footer.builtWith} ✦ {SITE_CONFIG.supportEmail}
          </p>
        </div>
      </div>
    </footer>
  );
}
