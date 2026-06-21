import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const navLinks = [
  { href: "#how", label: "איך זה עובד" },
  { href: "#benefits", label: "יתרונות" },
  { href: "#testimonials", label: "מטופלים" },
  { href: "#faq", label: "שאלות נפוצות" },
];

export function Header() {
  return (
    <header className="bg-background/80 border-border/60 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex" aria-label="ראשי">
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

        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="text-muted-foreground hover:text-foreground hidden text-sm font-medium transition-colors md:inline-block"
          >
            כניסה
          </Link>
          <Link
            href="/sign-up"
            className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-full px-5 text-sm")}
          >
            התחילו עכשיו
          </Link>
        </div>
      </div>
    </header>
  );
}
