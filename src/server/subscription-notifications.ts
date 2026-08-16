import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import {
  paymentSetupEmailHtml,
  paymentFailedEmailHtml,
  trialEndingEmailHtml,
} from "@/server/emails/templates";
import { appUrl } from "@/lib/app-url";

export async function sendPaymentSetupEmail(args: {
  email: string;
  contactName: string | null;
  clinicName: string;
  setupToken: string;
}): Promise<boolean> {
  const link = `${appUrl()}/clinics/billing/${args.setupToken}`;
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.email,
      subject: "אישור מרפאה — הפעלת מנוי DentalCompare",
      html: paymentSetupEmailHtml({
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
  priceILS: number;
  planLabelHe: string;
}): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.email,
      subject:
        args.daysRemaining <= 2
          ? "תקופת ההתנסות מסתיימת — החיוב הראשון בקרוב"
          : `נותרו ${args.daysRemaining} ימי התנסות ב-DentalCompare`,
      html: trialEndingEmailHtml({
        clinicName: args.clinicName,
        daysRemaining: args.daysRemaining,
        priceILS: args.priceILS,
        planLabelHe: args.planLabelHe,
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
}): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.email,
      subject: "חיוב המנוי נכשל — DentalCompare",
      html: paymentFailedEmailHtml({ clinicName: args.clinicName }),
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
