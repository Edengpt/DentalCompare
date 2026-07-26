import Link from "next/link";
import { Logo } from "./logo";
import { SITE_CONFIG } from "@/lib/constants";

const linkGroups = [
  {
    title: "המוצר",
    links: [
      { href: "#how", label: "איך זה עובד" },
      { href: "#benefits", label: "יתרונות" },
      { href: "#faq", label: "שאלות נפוצות" },
    ],
  },
  {
    title: "חברה",
    links: [
      { href: "/about", label: "אודות" },
      { href: "/contact", label: "צרו קשר" },
      { href: "/clinics/join", label: "הצטרפות מרפאות" },
    ],
  },
  {
    title: "משפטי",
    links: [
      { href: "/terms", label: "תנאי שימוש" },
      { href: "/privacy", label: "מדיניות פרטיות" },
      { href: "/cookies", label: "מדיניות עוגיות" },
      { href: "/refunds", label: "ביטולים והחזרים" },
      { href: "/accessibility", label: "הצהרת נגישות" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-border/60 bg-background border-t">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo />
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              הדרך השקופה לקבל מספר הצעות מחיר לטיפול שיניים. ללא שיחות טלפון, ללא לחץ.
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
            © {new Date().getFullYear()} {SITE_CONFIG.name}. כל הזכויות שמורות.
          </p>
          <p className="text-muted-foreground text-xs">
            עוצב ופותח באהבה בישראל ✦ {SITE_CONFIG.supportEmail}
          </p>
        </div>
      </div>
    </footer>
  );
}
