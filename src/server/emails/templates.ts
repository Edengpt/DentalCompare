import { formatMoney } from "@/lib/money";
import { SITE_CONFIG } from "@/lib/constants";
import { dir, type Locale } from "@/i18n/config";
import { DOCUMENT_TOKEN_DAYS } from "@/lib/clinic-documents";
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
  <div dir="${dir[locale]}" style="font-family: Arial, sans-serif; color: #14202e; max-width: 560px; margin: 0 auto;">
${body}
  </div>`;
}

const HR = `<hr style="border: none; border-top: 1px solid #d5dde8; margin: 24px 0;" />`;

/** Dentist "you were asked for a quote" email (patient fulfillment). */
export function quoteRequestEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  dentistName: string;
  /** Already resolved to a display value — never null here. */
  patientName: string;
  patientPhone: string;
  /** Whether the patient completed SMS verification. It's optional, so say so
   *  rather than let the clinic assume every number was checked. */
  phoneVerified: boolean;
  requestId: string;
  date: string;
  quoteUrl: string;
}): string {
  const {
    locale,
    t,
    dentistName,
    patientName,
    patientPhone,
    phoneVerified,
    requestId,
    date,
    quoteUrl,
  } = opts;
  const p = escapeHtml(patientName);
  const d = escapeHtml(dentistName);
  const phone = escapeHtml(patientPhone);
  const phoneNote = phoneVerified
    ? ` <span style="color:#1b7a4b;">${t.smsVerified}</span>`
    : ` <span style="color:#999;">${t.smsNotVerified}</span>`;

  return shell(
    locale,
    `    <h2 style="color: #0e2f55;">${format(t.quoteRequestHeading, { patient: p })}</h2>
    <p>${format(t.greeting, { name: d })}</p>
    <p>${format(t.quoteRequestBody, { patient: p })}</p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${quoteUrl}"
         style="display: inline-block; background: #2356c7; color: #fff; text-decoration: none;
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
  /** Null when the patient never gave a name — see User.fullName. */
  patientName: string | null;
  link: string;
}): string {
  const { locale, t, patientName, link } = opts;
  // Addressing the reader by name is the point of a greeting; with no name the
  // greeting drops it rather than substituting a placeholder, because "Hello
  // the patient," reads worse than "Hello,".
  const greeting = patientName
    ? format(t.greeting, { name: escapeHtml(patientName) })
    : t.greetingNoName;

  return shell(
    locale,
    `    <h2 style="color: #0e2f55;">${t.newQuoteHeading}</h2>
    <p>${greeting}</p>
    <p>${t.newQuoteBody}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0e2f55; color: #fff; text-decoration: none;
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
  areaLink: string;
}): string {
  const { locale, t, contactName, clinicName, link, areaLink } = opts;

  return shell(
    locale,
    `    <h2 style="color: #0e2f55;">${t.setupHeading}</h2>
    <p>${format(t.greeting, { name: escapeHtml(contactName) || t.clinicTeam })}</p>
    <p>${format(t.setupApproved, { clinic: `<strong>${escapeHtml(clinicName)}</strong>` })}</p>
    <p>${t.setupInstruction}</p>
    <p style="margin: 24px 0;">
      <a href="${link}" style="background:#0e2f55;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;">
        ${t.setupCta}
      </a>
    </p>
    ${HR}
    <p style="font-size: 13px;">
      ${format(t.setupAreaLine, { link: `<a href="${areaLink}">${t.setupAreaCta}</a>` })}
    </p>
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
  /**
   * Where the clinic can still enter a card, or null when one is already stored.
   *
   * A clinic enters its trial the moment an admin approves it; payment setup is
   * a separate link it may never have clicked. Announcing a charge to "the card
   * you saved at registration" is therefore false for a large share of trialing
   * clinics — and this is the one email they are guaranteed to read before the
   * trial ends, so it is also the best chance to convert them.
   */
  setupUrl: string | null;
}): string {
  const { locale, t, clinicName, daysRemaining, priceMinor, currency, planLabel, setupUrl } = opts;
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

  if (setupUrl) {
    return shell(
      locale,
      `    <h2 style="color:#0e2f55;">${format(t.trialSetupHeading, { when })}</h2>
    <p>${format(t.greeting, { name: `<strong>${escapeHtml(clinicName)}</strong>` })}</p>
    <p>${format(t.trialSetupBody, { clinic: `<strong>${escapeHtml(clinicName)}</strong>`, when, plan: escapeHtml(planLabel), price: `<strong>${price}</strong>` })}</p>
    <p style="margin:24px 0;"><a href="${setupUrl}" style="background:#0e2f55;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${t.trialSetupCta}</a></p>
    <p>${t.trialSetupNoCharge}</p>
    <p style="font-size:12px;color:#777;">${t.trialCancelPrefix} <a href="mailto:${SITE_CONFIG.supportEmail}">${SITE_CONFIG.supportEmail}</a></p>`,
    );
  }

  return shell(
    locale,
    `    <h2 style="color:#0e2f55;">${format(t.trialHeading, { when })}</h2>
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
    `    <h2 style="color:#0e2f55;">${t.chargeFailedHeading}</h2>
    <p>${format(t.chargeFailedBody, { clinic: `<strong>${escapeHtml(clinicName)}</strong>` })}</p>
    <p style="font-size:12px;color:#777;">${t.supportPrefix} <a href="mailto:${SITE_CONFIG.supportEmail}">${SITE_CONFIG.supportEmail}</a></p>`,
  );
}

/**
 * Internal "a trial ended and we could not bill it" alert.
 *
 * Addressed to the operator, not the clinic — the clinic is told nothing,
 * because from its side nothing changed and nothing is owed. It names the clinic
 * and the reason because those decide the next action: a missing provider is one
 * fix for everyone, a missing card is one clinic to call.
 */
export function trialUnbilledAdminEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  clinicEmail: string;
  reasonLabel: string;
}): string {
  const { locale, t, clinicName, clinicEmail, reasonLabel } = opts;

  return shell(
    locale,
    `    <h2 style="color:#0e2f55;">${t.trialUnbilledHeading}</h2>
    <p>${format(t.trialUnbilledBody, { clinic: `<strong>${escapeHtml(clinicName)}</strong>` })}</p>
    <p>${t.trialUnbilledReasonLabel} <strong>${escapeHtml(reasonLabel)}</strong></p>
    <p>${t.trialUnbilledClinicLabel} <a href="mailto:${escapeHtml(clinicEmail)}">${escapeHtml(clinicEmail)}</a></p>
    ${HR}
    <p style="font-size:12px;color:#777;">${t.trialUnbilledStillVisible}</p>`,
  );
}

/**
 * "We need a better copy of this document" — sent to a clinic whose
 * registration is otherwise complete.
 *
 * Written as one more step rather than a rejection, because that is what it is:
 * the clinic has already filled in the whole form and is waiting. Every value
 * is escaped — the reason is free text an admin typed, and it arrives here as
 * markup.
 */
export function documentsRejectedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  items: { kind: string; reason: string }[];
  link: string;
}): string {
  const { locale, t, clinicName, items, link } = opts;
  const list = items
    .map(
      (i) =>
        `<li style="margin-bottom:8px;"><strong>${escapeHtml(i.kind)}</strong>${
          i.reason ? ` — ${escapeHtml(i.reason)}` : ""
        }</li>`,
    )
    .join("");

  return shell(
    locale,
    `    <h2 style="color:#0e2f55;">${t.docsRejectedHeading}</h2>
    <p>${format(t.greeting, { name: `<strong>${escapeHtml(clinicName)}</strong>` })}</p>
    <p>${format(t.docsRejectedBody, { clinic: `<strong>${escapeHtml(clinicName)}</strong>` })}</p>
    <p style="font-weight:600;">${t.docsRejectedWhat}</p>
    <ul>${list}</ul>
    <p style="margin:24px 0;"><a href="${link}" style="background:#0e2f55;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${t.docsRejectedCta}</a></p>
    ${HR}
    <p style="font-size:12px;color:#777;">${format(t.docsRejectedExpiry, { days: DOCUMENT_TOKEN_DAYS })}</p>`,
  );
}

/** Clinic "the patient approved your quote" email. */
export function quoteApprovedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, clinicName, link } = opts;
  return shell(
    locale,
    `    <h2 style="color: #0e2f55;">${t.quoteApprovedHeading}</h2>
    <p>${format(t.greeting, { name: escapeHtml(clinicName) })}</p>
    <p>${format(t.quoteApprovedBody, { patient: t.patientFallback })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0e2f55; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.quoteApprovedCta}
      </a>
    </div>
    ${HR}
    <p style="font-size: 12px; color: #777;">${t.autoFooter}</p>`,
  );
}

/** Clinic "the patient rejected your quote" email. */
export function quoteRejectedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, clinicName, link } = opts;
  return shell(
    locale,
    `    <h2 style="color: #0e2f55;">${t.quoteRejectedHeading}</h2>
    <p>${format(t.greeting, { name: escapeHtml(clinicName) })}</p>
    <p>${format(t.quoteRejectedBody, { patient: t.patientFallback })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0e2f55; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.quoteRejectedCta}
      </a>
    </div>
    ${HR}
    <p style="font-size: 12px; color: #777;">${t.autoFooter}</p>`,
  );
}

/** Patient "your treatment has started" email. */
export function treatmentStartedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  patientName: string | null;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, patientName, clinicName, link } = opts;
  const greeting = patientName
    ? format(t.greeting, { name: escapeHtml(patientName) })
    : t.greetingNoName;
  return shell(
    locale,
    `    <h2 style="color: #0e2f55;">${t.treatmentStartedHeading}</h2>
    <p>${greeting}</p>
    <p>${format(t.treatmentStartedBody, { clinic: escapeHtml(clinicName) })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0e2f55; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.treatmentStartedCta}
      </a>
    </div>
    ${HR}
    <p style="font-size: 12px; color: #777;">${t.autoFooter}</p>`,
  );
}

/** Patient "please confirm the treatment is complete" email. */
export function completionRequestedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  patientName: string | null;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, patientName, clinicName, link } = opts;
  const greeting = patientName
    ? format(t.greeting, { name: escapeHtml(patientName) })
    : t.greetingNoName;
  return shell(
    locale,
    `    <h2 style="color: #0e2f55;">${t.completionRequestedHeading}</h2>
    <p>${greeting}</p>
    <p>${format(t.completionRequestedBody, { clinic: escapeHtml(clinicName) })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0e2f55; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.completionRequestedCta}
      </a>
    </div>
    ${HR}
    <p style="font-size: 12px; color: #777;">${t.autoFooter}</p>`,
  );
}

/** Clinic "the patient confirmed treatment is complete" email. */
export function treatmentCompletedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  link: string;
}): string {
  const { locale, t, clinicName, link } = opts;
  return shell(
    locale,
    `    <h2 style="color: #0e2f55;">${t.treatmentCompletedHeading}</h2>
    <p>${format(t.greeting, { name: escapeHtml(clinicName) })}</p>
    <p>${format(t.treatmentCompletedBody, { patient: t.patientFallback, clinic: escapeHtml(clinicName) })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0e2f55; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.treatmentCompletedCta}
      </a>
    </div>
    ${HR}
    <p style="font-size: 12px; color: #777;">${t.autoFooter}</p>`,
  );
}

/**
 * A short notice to a clinic about something the patient did on its treatment:
 * heading, one line, a button to the clinic area. The two below differ only in
 * their strings.
 */
function clinicTreatmentNoticeHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  link: string;
  heading: string;
  body: string;
}): string {
  const { locale, t, clinicName, link, heading, body } = opts;
  return shell(
    locale,
    `    <h2 style="color: #0e2f55;">${heading}</h2>
    <p>${format(t.greeting, { name: escapeHtml(clinicName) })}</p>
    <p>${format(body, { patient: t.patientFallback })}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0e2f55; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        ${t.treatmentCompletedCta}
      </a>
    </div>
    ${HR}
    <p style="font-size: 12px; color: #777;">${t.autoFooter}</p>`,
  );
}

/** Clinic: the patient marked the treatment as started. */
export function treatmentStartedByPatientEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  link: string;
}): string {
  return clinicTreatmentNoticeHtml({
    ...opts,
    heading: opts.t.treatmentStartedByPatientHeading,
    body: opts.t.treatmentStartedByPatientBody,
  });
}

/** Clinic: the patient answered the completion request with "still ongoing". */
export function completionDeclinedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  link: string;
}): string {
  return clinicTreatmentNoticeHtml({
    ...opts,
    heading: opts.t.completionDeclinedHeading,
    body: opts.t.completionDeclinedBody,
  });
}

/**
 * Clinic: its registration was not approved. Sent just before the clinic is
 * removed — the one message it will get about this, so it carries the reason
 * when the admin gave one and says how to get in touch.
 */
export function clinicRejectedEmailHtml(opts: {
  locale: Locale;
  t: EmailStrings;
  clinicName: string;
  reason: string | null;
}): string {
  const { locale, t, clinicName, reason } = opts;
  return shell(
    locale,
    `    <h2 style="color:#0e2f55;">${t.clinicRejectedHeading}</h2>
    <p>${format(t.greeting, { name: `<strong>${escapeHtml(clinicName)}</strong>` })}</p>
    <p>${t.clinicRejectedBody}</p>
    ${
      reason
        ? `<p style="font-weight:600;">${t.clinicRejectedReason}</p>
    <p style="background:#f3f6fa;border-radius:8px;padding:12px 16px;white-space:pre-wrap;">${escapeHtml(reason)}</p>`
        : ""
    }
    <p>${t.clinicRejectedContact}</p>
    ${HR}
    <p style="font-size:12px;color:#777;">${t.autoFooter}</p>`,
  );
}
