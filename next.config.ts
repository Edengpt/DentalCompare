import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Baseline security headers applied to every response. These are the safe,
 * app-agnostic hardening headers — they don't interfere with Clerk, Vercel Blob,
 * or third-party scripts. A full Content-Security-Policy is intentionally NOT
 * added here yet: a strict CSP must be tuned against Clerk's script/worker/
 * connect origins and verified page-by-page, so it's tracked as a follow-up
 * rather than shipped blind (a wrong CSP silently breaks auth).
 */
const securityHeaders = [
  // Clickjacking: disallow the site being framed by other origins.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop browsers from MIME-sniffing a response away from its declared type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry ids) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for two years incl. subdomains. (No `preload` — that's a hard-
  // to-reverse commitment; add it only once ready to submit to the preload list.)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Deny powerful browser features the app doesn't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

/**
 * Baseline security headers applied to every response. These are the safe,
 * app-agnostic hardening headers — they don't interfere with Clerk, Vercel Blob,
 * or third-party scripts. A full Content-Security-Policy is intentionally NOT
 * added here yet: a strict CSP must be tuned against Clerk's script/worker/
 * connect origins and verified page-by-page, so it's tracked as a follow-up
 * rather than shipped blind (a wrong CSP silently breaks auth).
 */
const securityHeaders = [
  // Clickjacking: disallow the site being framed by other origins.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop browsers from MIME-sniffing a response away from its declared type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry ids) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for two years incl. subdomains. (No `preload` — that's a hard-
  // to-reverse commitment; add it only once ready to submit to the preload list.)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Deny powerful browser features the app doesn't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

// Only wrap with Sentry's build plugin when a DSN is configured, so an
// unconfigured build (dev or prod without Sentry) is completely unaffected.
// Once NEXT_PUBLIC_SENTRY_DSN (and optionally SENTRY_ORG/SENTRY_PROJECT +
// SENTRY_AUTH_TOKEN for source maps) are set, error monitoring activates.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
    })
  : nextConfig;
