import { LocaleLink as Link } from "@/i18n/locale-link";

type LogoProps = {
  className?: string;
  variant?: "default" | "inverted";
};

export function Logo({ className, variant = "default" }: LogoProps) {
  const colorClass = variant === "inverted" ? "text-cream" : "text-ink";

  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2.5 ${colorClass} ${className ?? ""}`}
      aria-label="DentalCompare"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-500 group-hover:rotate-[12deg]"
        aria-hidden="true"
      >
        <path
          d="M16 3.5C12 3.5 10 5.5 8 5.5C5.5 5.5 3.5 7.5 3.5 11C3.5 15 5 19.5 7 24C8.5 27.5 10 29 11.5 28.5C12.8 28.1 13 26 14 24C15 22.5 17 22.5 18 24C19 26 19.2 28.1 20.5 28.5C22 29 23.5 27.5 25 24C27 19.5 28.5 15 28.5 11C28.5 7.5 26.5 5.5 24 5.5C22 5.5 20 3.5 16 3.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="13" r="1.5" fill="currentColor" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight">DentalCompare</span>
    </Link>
  );
}
