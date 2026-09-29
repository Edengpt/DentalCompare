import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Rubik } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { heIL, enUS, ruRU, frFR, deDE, zhCN, trTR } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/get-dictionary";
import { defaultLocale, dir, intlLocale, isLocale, locales, type Locale } from "@/i18n/config";
import "@clerk/ui/themes/shadcn.css";
import "../globals.css";

/**
 * This IS the root layout — it owns <html> and <body>.
 *
 * It lives under [locale] rather than at src/app/ because `lang` and `dir` have
 * to come from the route parameter. A root layout one level up would have to
 * hardcode them, which is exactly the assumption being removed. Next supports
 * nesting the root layout in the dynamic segment for this reason.
 */

// One face for everything, Hebrew and Latin alike. Headings used to be set in
// a serif (Frank Ruhl Libre); globals.css now points --font-serif at this too,
// so every `font-display` heading follows without touching its markup.
const rubik = Rubik({
  variable: "--font-sans",
  // latin-ext for Turkish (ğ, ş, ı) and Cyrillic for Russian. Rubik has no
  // Chinese glyphs; those fall back to the system's CJK face, which is what
  // Chinese readers expect anyway.
  subsets: ["hebrew", "latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const clerkLocalizations = { he: heIL, en: enUS, ru: ruRU, fr: frFR, de: deDE, zh: zhCN, tr: trTR };

/** Pre-render both locales rather than resolving them per request. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);

  return {
    metadataBase: new URL("https://dentalcompare.co.il"),
    title: { default: t.meta.title, template: "%s | DentalCompare" },
    description: t.meta.description,
    // Tells search engines these are translations of one another rather than
    // duplicate pages. x-default points at the default locale.
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [intlLocale[l], `/${l}`])),
        "x-default": `/${defaultLocale}`,
      },
    },
    openGraph: {
      type: "website",
      locale: intlLocale[locale].replace("-", "_"),
      siteName: "DentalCompare",
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // A path like /de/... reaches here with an unsupported segment. 404 rather
  // than fall back silently, so a broken link stays visible.
  if (!isLocale(locale)) notFound();

  const typedLocale = locale as Locale;
  const dictionary = await getDictionary(typedLocale);

  return (
    <html
      lang={typedLocale}
      dir={dir[typedLocale]}
      className={`${rubik.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ClerkProvider
          localization={clerkLocalizations[typedLocale]}
          appearance={{ theme: shadcn }}
        >
          {/* The dictionary is already loaded on the server; the provider hands
              client components their strings without a second fetch, and only
              this locale's copy ever reaches the browser. */}
          <I18nProvider locale={typedLocale} dictionary={dictionary}>
            {children}
            <Toaster position="top-center" richColors closeButton />
          </I18nProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
