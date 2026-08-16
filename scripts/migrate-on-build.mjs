/**
 * Runs `prisma migrate deploy` during a Vercel PRODUCTION build only.
 *
 * Why guarded rather than unconditional: Vercel builds preview deployments too,
 * and if the Preview DATABASE_URL points at the same database as Production
 * (common in a single-database setup), an unconditional migrate would let any
 * pushed branch rewrite the live schema. Production-only keeps a stray branch
 * from touching real data.
 *
 * Why in the build at all: the code and the database schema must agree, and a
 * deploy that ships new code without migrating is exactly how a live site breaks
 * with column-not-found errors on every page.
 *
 * Locally this is a no-op — use `npm run db:migrate` instead.
 */
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env !== "production") {
  console.log(`[migrate-on-build] VERCEL_ENV=${env ?? "(unset)"} — skipping migrations.`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("[migrate-on-build] DATABASE_URL is not set in the build environment.");
  process.exit(1);
}

console.log("[migrate-on-build] production build — applying migrations…");
try {
  execSync("prisma migrate deploy", { stdio: "inherit" });
} catch {
  // Fail the build loudly. Deploying code whose schema was never applied would
  // put the site in the broken state this script exists to prevent.
  console.error("[migrate-on-build] migration failed — aborting the build.");
  process.exit(1);
}
