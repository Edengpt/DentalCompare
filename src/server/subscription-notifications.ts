import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import {
  paymentSetupEmailHtml,
  paymentFailedEmailHtml,
  trialEndingEmailHtml,
  trialUnbilledAdminEmailHtml,
  documentsRejectedEmailHtml,
} from "@/server/emails/templates";
import { appUrl } from "@/lib/app-url";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/format";
import { defaultLocale, type Locale } from "@/i18n/config";
import { adminEmails } from "@/server/admin";
import type { BillingBlocker } from "@/lib/subscription";

export async function sendPaymentSetupEmail(args: {
  email: string;
  contactName: string | null;
  clinicName: string;
  setupToken: string;
  /** The clinic's own language, from Dentist.locale. */
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const link = `${appUrl()}/${args.locale}/clinics/billing/${args.setupToken}`;
  // The approval email is the one moment the clinic is definitely reading, so
  // it is where it learns it has an account at all — until now every route back
  // into the site was a link in an email it had to still be able to find.
  const areaLink = `${appUrl()}/${args.locale}/clinics/dashboard`;
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.email,
      subject: t.subjectPaymentSetup,
      html: paymentSetupEmailHtml({
        locale: args.locale,
        t,
        contactName: args.contactName ?? "",
        clinicName: args.clinicName,
        link,
        areaLink,
      }),
    });
    if (error) {
      console.error(`Resend error for payment setup ${args.email}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send payment setup email to ${args.email}:`, err);
    return false;
  }
}

/**
 * Warns a clinic that its free trial is ending and the first charge is coming.
 * Sent ahead of time on purpose: an unannounced first charge is the classic
 * cause of chargebacks and angry cancellations (PRD 4.4).
 */
export async function sendTrialEndingEmail(args: {
  email: string;
  clinicName: string;
  daysRemaining: number;
  priceMinor: number;
  currency: string;
  plan: "MONTHLY" | "YEARLY";
  locale: Locale;
  /**
   * The subscription's setup token, or null when a card is already stored.
   *
   * Approval starts the trial; payment setup is a separate link the clinic may
   * never have opened. Without this the warning promises to charge a card that
   * does not exist — see trialEndingEmailHtml.
   */
  setupToken: string | null;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const planLabel = args.plan === "MONTHLY" ? t.planMonthly : t.planYearly;
  const setupUrl = args.setupToken
    ? `${appUrl()}/${args.locale}/clinics/billing/${args.setupToken}`
    : null;
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.email,
      subject: setupUrl
        ? t.subjectTrialSetupNeeded
        : args.daysRemaining <= 2
          ? t.subjectTrialEndingSoon
          : format(t.subjectTrialDaysLeft, { days: args.daysRemaining }),
      html: trialEndingEmailHtml({
        locale: args.locale,
        t,
        clinicName: args.clinicName,
        daysRemaining: args.daysRemaining,
        priceMinor: args.priceMinor,
        currency: args.currency,
        planLabel,
        setupUrl,
      }),
    });
    if (error) {
      console.error(`Resend error for trial-ending ${args.email}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send trial-ending email to ${args.email}:`, err);
    return false;
  }
}

export async function sendPaymentFailedEmail(args: {
  email: string;
  clinicName: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.email,
      subject: t.subjectPaymentFailed,
      html: paymentFailedEmailHtml({ locale: args.locale, t, clinicName: args.clinicName }),
    });
    if (error) {
      console.error(`Resend error for payment-failed ${args.email}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send payment-failed email to ${args.email}:`, err);
    return false;
  }
}

/**
 * Tells the operator that a trial ended with no way to charge it.
 *
 * Returns false — without throwing — when ADMIN_EMAILS is unset, because an
 * unconfigured alert must not take the cron down with it. That is also why this
 * is the second of two channels: the admin subscriptions screen shows the same
 * fact from the database and needs no configuration at all.
 */
export async function sendTrialUnbilledAdminEmail(args: {
  clinicName: string;
  clinicEmail: string;
  reason: BillingBlocker;
}): Promise<boolean> {
  const recipients = adminEmails();
  if (recipients.length === 0) {
    console.error("No ADMIN_EMAILS configured; trial-unbilled alert not sent", {
      clinic: args.clinicName,
      reason: args.reason,
    });
    return false;
  }

  // The operator's own language, not the clinic's: this email is internal.
  const t = (await getDictionary(defaultLocale)).emails;
  const reasonLabel =
    args.reason === "no_provider"
      ? t.trialUnbilledReasonNoProvider
      : t.trialUnbilledReasonNoCard;

  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: recipients,
      subject: t.subjectTrialUnbilled,
      html: trialUnbilledAdminEmailHtml({
        locale: defaultLocale,
        t,
        clinicName: args.clinicName,
        clinicEmail: args.clinicEmail,
        reasonLabel,
      }),
    });
    if (error) {
      console.error("Resend error for trial-unbilled admin alert:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send trial-unbilled admin alert:", err);
    return false;
  }
}

/**
 * Asks a clinic for a better copy of a document an admin could not accept.
 *
 * Deliberately not framed as a rejection: the clinic has already filled in the
 * whole form and is waiting, and one readable photograph away from approval.
 */
export async function sendDocumentsRejectedEmail(args: {
  email: string;
  clinicName: string;
  locale: Locale;
  token: string;
  items: { kind: string; reason: string }[];
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const link = `${appUrl()}/${args.locale}/clinics/documents/${args.token}`;
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.email,
      subject: t.subjectDocumentsRejected,
      html: documentsRejectedEmailHtml({
        locale: args.locale,
        t,
        clinicName: args.clinicName,
        items: args.items,
        link,
      }),
    });
    if (error) {
      console.error(`Resend error for documents-rejected ${args.email}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send documents-rejected email to ${args.email}:`, err);
    return false;
  }
}
