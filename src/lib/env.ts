import { z } from "zod";

/**
 * Startup check of the environment, run once from `instrumentation.ts`.
 *
 * Two tiers, because they fail differently:
 * - CORE: the site cannot serve a single page correctly without these (database,
 *   sign-in, file storage and its encryption, links in emails, cron auth). Missing one in production
 *   aborts startup, so a bad deploy shows up as a failed instance at once
 *   instead of as a patient's lost upload a week later.
 * - FEATURES: each switches one feature on (payments, AI explanation, error
 *   monitoring). The code already degrades without them, so a gap is a warning.
 *
 * Only the Vercel production environment is strict. Preview deployments, CI and
 * local dev get warnings, so a missing secret never blocks a branch build.
 */

const nonEmpty = z.string().trim().min(1);

const CORE = z.object({
  DATABASE_URL: nonEmpty.regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
  CLERK_SECRET_KEY: nonEmpty.startsWith("sk_", "must start with sk_"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: nonEmpty.startsWith("pk_", "must start with pk_"),
  CLERK_WEBHOOK_SIGNING_SECRET: nonEmpty,
  NEXT_PUBLIC_APP_URL: z.url(),
  BLOB_READ_WRITE_TOKEN: nonEmpty,
  LOGO_BLOB_READ_WRITE_TOKEN: nonEmpty,
  CRON_SECRET: nonEmpty,
  RESEND_API_KEY: nonEmpty,
  ADMIN_EMAILS: nonEmpty,
  // Medical files are encrypted at rest with this key (src/lib/file-crypto.ts).
  // Without it, uploads would be stored in the clear.
  FILE_ENCRYPTION_KEY: nonEmpty.refine(
    (v) => Buffer.from(v, "base64").length === 32,
    "must be 32 bytes, base64-encoded",
  ),
});

/** A feature is on only when every variable it needs is set. */
const FEATURES: Record<string, readonly string[]> = {
  "PayPlus payments (Israeli clinics)": [
    "PAYPLUS_API_KEY",
    "PAYPLUS_SECRET_KEY",
    "PAYPLUS_PAYMENT_PAGE_UID",
    "PAYPLUS_WEBHOOK_SECRET",
  ],
  "Stripe payments (international clinics)": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  "AI treatment explanation": ["ANTHROPIC_API_KEY"],
  "Sentry error monitoring": ["NEXT_PUBLIC_SENTRY_DSN"],
};

type Env = Record<string, string | undefined>;

export type EnvReport = {
  /** CORE variables that are missing or malformed, with the reason. */
  errors: string[];
  /** Features left off, half-configured, or pointed at a sandbox. */
  warnings: string[];
};

const isSet = (env: Env, key: string) => Boolean(env[key]?.trim());

export function checkEnv(env: Env, production: boolean): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const core = CORE.safeParse(env);
  if (!core.success) {
    const seen = new Set<string>();
    for (const issue of core.error.issues) {
      const key = String(issue.path[0]);
      if (seen.has(key)) continue; // one line per variable
      seen.add(key);
      errors.push(isSet(env, key) ? `${key}: ${issue.message}` : `${key}: missing`);
    }
  }

  for (const [feature, keys] of Object.entries(FEATURES)) {
    const missing = keys.filter((k) => !isSet(env, k));
    if (missing.length === keys.length)
      warnings.push(`${feature} is off (${keys.join(", ")} not set)`);
    else if (missing.length)
      warnings.push(`${feature} is half-configured: missing ${missing.join(", ")}`);
  }

  if (production) {
    const appUrl = env.NEXT_PUBLIC_APP_URL ?? "";
    if (appUrl && !appUrl.startsWith("https://")) {
      warnings.push("NEXT_PUBLIC_APP_URL is not https:// — links in emails would be insecure");
    }
    if (env.PAYPLUS_API_BASE?.includes("restapidev")) {
      warnings.push("PAYPLUS_API_BASE points at the PayPlus sandbox in production");
    }
    if (env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
      warnings.push("STRIPE_SECRET_KEY is a test key in production");
    }
  }

  return { errors, warnings };
}

/**
 * Logs the report and, in Vercel production, throws on a CORE gap. Values are
 * never printed — only variable names.
 */
export function assertEnv(env: Env = process.env): void {
  const production = env.VERCEL_ENV === "production";
  const { errors, warnings } = checkEnv(env, production);

  for (const w of warnings)
    console.warn(JSON.stringify({ level: "warn", event: "env.warning", detail: w }));

  if (errors.length === 0) return;
  const message = `Invalid environment configuration:\n  - ${errors.join("\n  - ")}`;
  if (production) throw new Error(message);
  console.warn(JSON.stringify({ level: "warn", event: "env.invalid", errors }));
}
