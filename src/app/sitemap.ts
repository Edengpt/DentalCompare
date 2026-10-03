import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/constants";
import { locales, intlLocale } from "@/i18n/config";

/**
 * The public pages a search engine should index, once per language, each
 * listing its translations so they are understood as one page in several
 * languages rather than as duplicates. Everything behind sign-in, and the
 * per-request and per-clinic token pages, are left out on purpose.
 */
const PUBLIC_PATHS = [
  "",
  "/clinics/join",
  "/terms",
  "/privacy",
  "/cookies",
  "/refunds",
  "/accessibility",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_CONFIG.url;
  return PUBLIC_PATHS.flatMap((path) =>
    locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path === "/clinics/join" ? 0.8 : 0.3,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [intlLocale[l], `${base}/${l}${path}`])),
      },
    })),
  );
}
