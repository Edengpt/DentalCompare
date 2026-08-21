import { formatMoney } from "@/lib/money";
import { SITE_CONFIG } from "@/lib/constants";
import { dir, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";

// Pure HTML builders for the transactional emails. Kept dependency-free and
// side-effect-free so they're easy to read, diff, and unit test; the senders in
// src/server/*-notifications.ts and fulfillment.ts compose these.
//
// Every builder takes the recipient's locale and their slice of the dictionary
// rather than reading it itself: these stay synchronous and pure, and the caller
// already knows who it is writing to. The locale drives `dir` on the wrapper —
// an English email rendered right-to-left is unreadable in a way no amount of
// correct wording fixes.

type EmailStrings = Dictionary["emails"];

/**
 * Escapes HTML-special characters. Every value that originates from user input
 * (patient/clinic names, phone, free text) MUST be passed through this before
 * interpolation, so a name like `<script>` can't inject markup into an email.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shared wrapper, so direction and typography can't drift between templates. */
function shell(locale: Locale, body: string): string {
  return `
  <div dir="${dir[locale]}" style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
${body}
  </div>`;
}

const HR = `<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />`;

/** Dentist "you were asked for a quote" email (patient fulfillment). */
export function quoteRequestEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  dentistName: string;
  patientName: string;
  patientPhone: string;
  /** Whether the patient completed SMS verification. It's optional, so say so
   *  rather than let the clinic assume every number was checked. */
  phoneVerified: boolean;
  requestId: string;
  date: string;
  quoteUrl: string;
}): string {
  const { locale, t, dentistName, patientName, patientPhone, phoneVerified, requestId, date, quoteUrl } =
    opts;
  const p = escapeHtml(patientName);
  const d = escapeHtml(dentistName);
  const phone = escapeHtml(patientPhone);
  const phoneNote = phoneVerified
    ? ` <span style="color:#0f7a5a;">${t.smsVerified}</span>`
    : ` <span style="color:#999;">${t.smsNotVerified}</span>`;

  return shell(
    locale,
    `    <h2 style="color: #0f4c4c;">${format(t.quoteRequestHeading, { patient: p })}</h2>
    <p>${format(t.greeting, { name: d })}</p>
    <p>${format(t.quoteRequestBody, { patient: p })}</p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${quoteUrl}"
         style="display: inline-block; background: #ff6b4a; color: #fff; text-decoration: none;
                font-size: 17px; font-weight: bold; padding: 16px 32px; border-radius: 999px;">
        ${t.quoteRequestCta}
      </a>
    </div>

    <ul style="padding-inline-start: 18px; color: #555; font-size: 13px;">
      <li>${t.requestNumber} ${escapeHtml(requestId.slice(0, 8))}</li>
      <li>${t.dateLabel} ${escapeHtml(date)}</li>
      <li>${t.directContact} ${phone ? `${phone}${phoneNote}` : t.seeButtonAbove}</li>
    </ul>

    ${HR}
    <p style="font-size: 12px; color: #777;">${t.autoFooter}</p>`,
  );
}

/** Patient "you received a new quote" notification. */
export function newQuoteEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  patientName: string;
  link: string;
}): string {
  const { locale, t, patientName, link } = opts;

  return shell(
    locale,
    `    <h2 style="color: #0f4c4c;">${t.newQuoteHeading}</h2>
    <p>${format(t.greeting, { name: escapeHtml(patientName) })}</p>
    <p>${t.newQuoteBody}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0f4c4c; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.newQuoteCta}
      </a>
    </div>
    ${HR}
    <p style="font-size: 12px; color: #777;">${t.autoFooter}</p>`,
  );
}

/** Clinic "approved — set up your subscription" email. */
export function paymentSetupEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  contactName: string;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, contactName, clinicName, link } = opts;

  return shell(
    locale,
    `    <h2 style="color: #0f4c4c;">${t.setupHeading}</h2>
    <p>${format(t.greeting, { name: escapeHtml(contactName) || t.clinicTeam })}</p>
    <p>${format(t.setupApproved, { clinic: `<strong>${escapeHtml(clinicName)}</strong>` })}</p>
    <p>${t.setupInstruction}</p>
    <p style="margin: 24px 0;">
      <a href="${link}" style="background:#0f4c4c;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;">
        ${t.setupCta}
      </a>
    </p>
    ${HR}
    <p style="font-size: 12px; color: #777;">
      ${t.questionsPrefix} <a href="mailto:${SITE_CONFIG.supportEmail}">${SITE_CONFIG.supportEmail}</a>
    </p>`,
  );
}

/** Clinic "your free trial is about to end" email. */
export function trialEndingEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  daysRemaining: number;
  priceMinor: number;
  currency: string;
  planLabel: string;
}): string {
  const { locale, t, clinicName, daysRemaining, priceMinor, currency, planLabel } = opts;
  // Symbol comes from the amount's currency, never a hardcoded ₪ — the notice
  // has to stay true for a clinic billed in euros. Formatted in the recipient's
  // locale so the grouping separators match the rest of the message.
  const price = formatMoney(priceMinor, currency, locale);
  const when =
    daysRemaining <= 0
      ? t.trialToday
      : daysRemaining === 1
        ? t.trialTomorrow
        : format(t.trialInDays, { days: daysRemaining });

  return shell(
    locale,
    `    <h2 style="color:#0f4c4c;">${format(t.trialHeading, { when })}</h2>
    <p>${format(t.greeting, { name: `<strong>${escapeHtml(clinicName)}</strong>` })}</p>
    <p>${format(t.trialBody, { when, plan: escapeHtml(planLabel), price: `<strong>${price}</strong>` })}</p>
    <p>${t.trialNoAction}</p>
    <p style="font-size:12px;color:#777;">${t.trialCancelPrefix} <a href="mailto:${SITE_CONFIG.supportEmail}">${SITE_CONFIG.supportEmail}</a></p>`,
  );
}

/** Clinic "your recurring charge failed" email. */
export function paymentFailedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
}): string {
  const { locale, t, clinicName } = opts;

  return shell(
    locale,
    `    <h2 style="color:#0f4c4c;">${t.chargeFailedHeading}</h2>
    <p>${format(t.chargeFailedBody, { clinic: `<strong>${escapeHtml(clinicName)}</strong>` })}</p>
    <p style="font-size:12px;color:#777;">${t.supportPrefix} <a href="mailto:${SITE_CONFIG.supportEmail}">${SITE_CONFIG.supportEmail}</a></p>`,
  );
}
