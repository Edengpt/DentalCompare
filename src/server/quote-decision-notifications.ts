import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import {
  quoteApprovedEmailHtml,
  quoteRejectedEmailHtml,
  treatmentStartedEmailHtml,
  completionRequestedEmailHtml,
  treatmentCompletedEmailHtml,
} from "@/server/emails/templates";
import { appUrl } from "@/lib/app-url";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

async function send(to: string, subject: string, html: string, label: string): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({ from: fromAddress(), to, subject, html });
    if (error) {
      console.error(`Resend error for ${label} ${to}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send ${label} email to ${to}:`, err);
    return false;
  }
}

/** Clinic "the patient approved your quote" notification. */
export async function sendQuoteApprovedEmail(args: {
  to: string;
  clinicName: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const html = quoteApprovedEmailHtml({
    locale: args.locale,
    t,
    clinicName: args.clinicName,
    link: `${appUrl()}/${args.locale}/clinics/dashboard`,
  });
  return send(args.to, t.subjectNewQuote, html, "quote-approved");
}

/** Clinic "the patient rejected your quote" notification. */
export async function sendQuoteRejectedEmail(args: {
  to: string;
  clinicName: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const html = quoteRejectedEmailHtml({
    locale: args.locale,
    t,
    clinicName: args.clinicName,
    link: `${appUrl()}/${args.locale}/clinics/dashboard`,
  });
  return send(args.to, t.quoteRejectedHeading, html, "quote-rejected");
}

/** Patient "your treatment has started" notification. */
export async function sendTreatmentStartedEmail(args: {
  to: string;
  patientName: string | null;
  clinicName: string;
  requestId: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const html = treatmentStartedEmailHtml({
    locale: args.locale,
    t,
    patientName: args.patientName,
    clinicName: args.clinicName,
    link: `${appUrl()}/${args.locale}/request/${args.requestId}`,
  });
  return send(args.to, t.treatmentStartedHeading, html, "treatment-started");
}

/** Patient "please confirm the treatment is complete" notification. */
export async function sendCompletionRequestedEmail(args: {
  to: string;
  patientName: string | null;
  clinicName: string;
  requestId: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const html = completionRequestedEmailHtml({
    locale: args.locale,
    t,
    patientName: args.patientName,
    clinicName: args.clinicName,
    link: `${appUrl()}/${args.locale}/request/${args.requestId}`,
  });
  return send(args.to, t.completionRequestedHeading, html, "completion-requested");
}

/** Clinic "the patient confirmed treatment is complete" notification. */
export async function sendTreatmentCompletedEmail(args: {
  to: string;
  clinicName: string;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const html = treatmentCompletedEmailHtml({
    locale: args.locale,
    t,
    clinicName: args.clinicName,
    link: `${appUrl()}/${args.locale}/clinics/dashboard`,
  });
  return send(args.to, t.treatmentCompletedHeading, html, "treatment-completed");
}
