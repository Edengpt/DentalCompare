import "server-only";
import { Resend } from "resend";
import { SITE_CONFIG } from "./constants";

let client: Resend | null = null;

/**
 * Lazily-instantiated Resend client — instantiated on first use rather than at
 * import time so the app stays bootable when email isn't configured yet.
 */
export function getResend(): Resend {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  client = new Resend(key);
  return client;
}

export function fromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL ??
    `DentalCompare <requests@${SITE_CONFIG.url.replace(/^https?:\/\//, "")}>`
  );
}
