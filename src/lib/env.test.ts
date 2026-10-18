import { describe, expect, it } from "vitest";
import { checkEnv } from "./env";

const CORE_OK = {
  DATABASE_URL: "postgresql://u:p@host/db",
  CLERK_SECRET_KEY: "sk_live_x",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
  CLERK_WEBHOOK_SIGNING_SECRET: "whsec_x",
  NEXT_PUBLIC_APP_URL: "https://dentalcomparing.com",
  BLOB_READ_WRITE_TOKEN: "t",
  LOGO_BLOB_READ_WRITE_TOKEN: "t",
  CRON_SECRET: "s",
  RESEND_API_KEY: "re_x",
  ADMIN_EMAILS: "a@b.c",
};

describe("checkEnv", () => {
  it("passes a complete core config", () => {
    expect(checkEnv(CORE_OK, true).errors).toEqual([]);
  });

  it("names a missing core variable without printing values", () => {
    const { errors } = checkEnv({ ...CORE_OK, DATABASE_URL: "" }, true);
    expect(errors).toEqual(["DATABASE_URL: missing"]);
  });

  it("rejects a malformed core variable", () => {
    const { errors } = checkEnv({ ...CORE_OK, CLERK_SECRET_KEY: "pk_live_x" }, true);
    expect(errors).toEqual(["CLERK_SECRET_KEY: must start with sk_"]);
  });

  it("warns about a half-configured feature but not an error", () => {
    const r = checkEnv({ ...CORE_OK, STRIPE_SECRET_KEY: "sk_live_x" }, true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toContain(
      "Stripe payments (international clinics) is half-configured: missing STRIPE_WEBHOOK_SECRET",
    );
  });

  it("flags sandbox/test credentials only in production", () => {
    const env = { ...CORE_OK, STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "w" };
    expect(checkEnv(env, true).warnings).toContain("STRIPE_SECRET_KEY is a test key in production");
    expect(checkEnv(env, false).warnings).not.toContain(
      "STRIPE_SECRET_KEY is a test key in production",
    );
  });
});
