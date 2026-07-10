import "server-only";

/**
 * Whether the app is running in payments test mode — the full request flow runs
 * end-to-end without a real payment provider (needed while onboarding PayPlus).
 *
 * SECURITY: test mode requires BOTH an explicit opt-in flag AND a non-production
 * environment. It is NEVER a silent default — the previous implementation turned
 * test mode on whenever a provider key was missing, which meant a production
 * deploy without payment config would let every patient request through for free.
 * With this logic, production never enters test mode regardless of configuration;
 * a misconfigured production deploy fails loudly instead of charging nothing.
 */
export function isPaymentsTestMode(): boolean {
  return process.env.PAYMENTS_TEST_MODE === "true" && process.env.NODE_ENV !== "production";
}
