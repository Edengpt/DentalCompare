import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import {
  paymentSetupEmailHtml,
  paymentFailedEmailHtml,
  trialEndingEmailHtml,
} from "@/server/emails/templates";
import { appUrl } from "@/lib/app-url";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

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
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const planLabel = args.plan === "MONTHLY" ? t.planMonthly : t.planYearly;
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.email,
      subject:
        args.daysRemaining <= 2
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
