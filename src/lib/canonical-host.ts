/**
 * The site's address. dentalcompare.co.il came first and still resolves here;
 * dentalcomparing.com is the address for a worldwide audience.
 */
export const CANONICAL_HOST = "dentalcomparing.com";

const LEGACY_HOSTS = new Set(["dentalcompare.co.il", "www.dentalcompare.co.il"]);

/**
 * Where a request to a legacy address should go, or null to serve it here.
 *
 * Done in the proxy rather than as a Vercel domain redirect so /api/* is left
 * alone: payment and auth webhooks, and cron calls, are registered against the
 * old address and do not follow redirects. Everything a person opens moves.
 */
export function legacyRedirect(url: URL): URL | null {
  if (!LEGACY_HOSTS.has(url.hostname.toLowerCase())) return null;
  if (url.pathname.startsWith("/api/")) return null;
  const target = new URL(url.toString());
  target.protocol = "https:";
  target.hostname = CANONICAL_HOST;
  target.port = "";
  return target;
}
