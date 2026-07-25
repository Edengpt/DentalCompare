import type { NextConfig } from "next";

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

export default nextConfig;
