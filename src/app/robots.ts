import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/constants";
import { locales } from "@/i18n/config";

/**
 * Crawlers may read the public pages and are pointed at the sitemap. The
 * signed-in areas, the token pages a clinic opens from an email, and the API
 * are kept out of the index — they are private, and a search result for one
 * would lead a stranger to a sign-in wall or someone else's request.
 */
const PRIVATE = [
  "/dashboard",
  "/request",
  "/verify-phone",
  "/admin",
  "/clinics/dashboard",
  "/clinics/requests",
  "/clinics/billing",
  "/clinics/documents",
  "/quote",
  "/sign-in",
  "/sign-up",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...PRIVATE.flatMap((p) => [p, ...locales.map((l) => `/${l}${p}`)])],
    },
    sitemap: `${SITE_CONFIG.url}/sitemap.xml`,
    host: SITE_CONFIG.url,
  };
}
