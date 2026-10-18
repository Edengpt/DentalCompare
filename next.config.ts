import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Content-Security-Policy, in two layers.
 *
 * ENFORCED: only directives that cannot break a script, a style or the PDF
 * viewer — who may frame us, where <base> may point, and upgrading stray http
 * sub-resources. (`object-src 'none'` is left out on purpose: Chrome's built-in
 * PDF viewer runs as an embedded object, and patients' and clinics' PDFs open in
 * an iframe of our own /api/files route.)
 *
 * REPORT-ONLY: the full allow-list. Browsers log violations instead of
 * blocking, so it can be tuned against Clerk, Sentry and Vercel Blob on real
 * traffic and then promoted to enforced. Violations go to Sentry once a DSN is
 * configured. A wrong enforced CSP silently breaks sign-in — hence the order.
 */
const CLERK = "https://clerk.dentalcomparing.com https://*.clerk.accounts.dev";

function sentryCspReportUri(dsn: string | undefined): string | null {
  // DSN: https://<key>@<host>/<projectId>  →  https://<host>/api/<projectId>/security/?sentry_key=<key>
  const m = dsn?.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
  return m ? `https://${m[2]}/api/${m[3]}/security/?sentry_key=${m[1]}` : null;
}

const cspEnforced = ["frame-ancestors 'self'", "base-uri 'self'", "upgrade-insecure-requests"].join(
  "; ",
);

const reportUri = sentryCspReportUri(process.env.NEXT_PUBLIC_SENTRY_DSN);
const cspReportOnly = [
  "default-src 'self'",
  // 'unsafe-inline' for Next's inline bootstrap scripts; nonces are the next step.
  `script-src 'self' 'unsafe-inline' ${CLERK} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  `connect-src 'self' ${CLERK} https://*.blob.vercel-storage.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
  `frame-src 'self' ${CLERK} https://challenges.cloudflare.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  ...(reportUri ? [`report-uri ${reportUri}`] : []),
].join("; ");

/**
 * Baseline security headers applied to every response. These are the safe,
 * app-agnostic hardening headers — they don't interfere with Clerk, Vercel Blob,
 * or third-party scripts.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: cspEnforced },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
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
