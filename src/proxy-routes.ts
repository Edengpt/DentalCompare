/**
 * Route patterns that require an authenticated user.
 *
 * Kept in their own module, apart from proxy.ts, so proxy-routes.test.ts can
 * assert on them without importing Clerk into the node test environment.
 *
 * **Every pattern carries an optional locale prefix, and that is load-bearing.**
 * Once pages live under src/app/[locale]/, the live path is `/he/admin` rather
 * than `/admin`. A pattern written without the prefix simply stops matching —
 * `auth.protect()` is never called, and the admin area is served to anyone who
 * asks. Nothing throws, the build succeeds, and the page renders normally, so
 * the only thing standing between that and production is the test beside this
 * file. Add a locale, add it here.
 */
export const PROTECTED_PATTERNS = [
  "/(he|en)?/dashboard(.*)",
  "/(he|en)?/request(.*)",
  "/(he|en)?/verify-phone(.*)",
  "/(he|en)?/admin(.*)",
  // The clinic's own area. Deliberately narrow: /clinics/join, /clinics/billing
  // and /clinics/documents are reached by clinics that have no account at all,
  // and protecting /clinics(.*) would lock out the very clinic being asked to
  // set up payment or replace a document.
  "/(he|en)?/clinics/dashboard(.*)",
  // API routes are never locale-prefixed — they live outside src/app/[locale]/.
  "/api/requests(.*)",
  "/api/admin(.*)",
] as const;
