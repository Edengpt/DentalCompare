import "server-only";
import { randomUUID } from "node:crypto";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { getResend, fromAddress } from "@/lib/email";
import { quotePath } from "@/lib/quotes";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/app-url";
import { logEvent } from "@/lib/log";
import { formatPhoneForDisplay } from "@/lib/phone";
import { quoteRequestEmailHtml } from "@/server/emails/templates";
import { recordVerifiedRequest } from "@/server/request-usage";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { asLocale, intlLocale } from "@/i18n/config";

/**
 * Downloads a private blob and returns it as a Resend attachment (Buffer content)
 * — dentists receive the medical files as attachments rather than links to a
 * now-private blob URL.
 */
async function toAttachment(url: string, filename: string) {
  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`blob fetch failed for ${filename}`);
  }
  const content = Buffer.from(await new Response(result.stream).arrayBuffer());
  return { filename, content };
}

export type FulfillResult =
  { ok: true; emailsSent: number; alreadySent: number } | { ok: false; error: string };

// Subject and body follow the CLINIC's language, not the patient's: it lands in
// the clinic's inbox, and a Budapest clinic reading Hebrew is the failure this
// whole change exists to prevent.

function attachmentName(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext && ["pdf", "jpg", "jpeg", "png"].includes(ext)) return `${fallback}.${ext}`;
  } catch {
    // ignore malformed URLs — fall through to a generic name
  }
  return `${fallback}.pdf`;
}

/**
 * Idempotently delivers a submitted request: emails every selected dentist that
 * hasn't been emailed yet, attaching the treatment plan and x-ray.
 *
 * Keyed on the request itself — there is no payment gate, because the patient
 * side is free (PRD 4.1) and the clinic already paid via its subscription.
 * Delivery is the service the subscription bought, not a billable event.
 *
 * Safe to call multiple times (from the submit action and from the safety-net
 * cron), which is how the PRD rule "לא ניתן לשלוח פעמיים את אותה בקשה" is
 * enforced: `emailSent` gates each recipient.
 */
export async function fulfillRequest(requestId: string): Promise<FulfillResult> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      createdAt: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      user: { select: { fullName: true, email: true, phone: true, phoneVerifiedAt: true } },
      requestDentists: {
        where: { emailSent: false },
        select: {
          id: true,
          dentistId: true,
          dentist: { select: { dentistName: true, email: true, locale: true } },
        },
      },
    },
  });
  if (!request) return { ok: false, error: e.requestNotFound };
  // The patient (User) is required to email dentists on their behalf. A null
  // user means the account was deleted (userId set to null) — nothing to fulfill.
  if (!request.user) return { ok: false, error: e.patientNotFound };

  const pending = request.requestDentists;
  if (pending.length === 0) {
    return { ok: true, emailsSent: 0, alreadySent: 0 };
  }

  const formatDate = (locale: string) =>
    new Intl.DateTimeFormat(intlLocale[asLocale(locale)], {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(request.createdAt);

  // Download both private files once and attach them as content — the dentist
  // gets real attachments, not a link to a private blob.
  let attachments: Array<{ filename: string; content: Buffer }>;
  try {
    attachments = [
      await toAttachment(
        request.treatmentFileUrl,
        attachmentName(request.treatmentFileUrl, "treatment-plan"),
      ),
      await toAttachment(request.xrayFileUrl, attachmentName(request.xrayFileUrl, "dental-xray")),
    ];
  } catch (err) {
    logEvent("error", "fulfillment.attachment_download_failed", {
      requestId: request.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: e.attachmentsFailed };
  }

  const resend = getResend();
  const from = fromAddress();
  let sent = 0;
  let alreadySent = 0;

  for (const rd of pending) {
    const quoteToken = randomUUID();

    // Atomically claim this recipient: only the caller whose updateMany flips
    // emailSent false->true wins (count === 1). Concurrent callers (the webhook
    // and the success page can both run fulfillment at once) see count === 0 and
    // skip — so each dentist is emailed exactly once, with one stable quoteToken.
    const claim = await db.requestDentist.updateMany({
      where: { id: rd.id, emailSent: false },
      data: { emailSent: true, sentAt: new Date(), quoteToken },
    });
    if (claim.count === 0) {
      alreadySent += 1;
      continue;
    }

    try {
      // The persisted row is the source of truth for the token we send.
      const row = await db.requestDentist.findUnique({
        where: { id: rd.id },
        select: { quoteToken: true },
      });
      const token = row?.quoteToken ?? quoteToken;
      const quoteUrl = `${appUrl()}${quotePath(token)}`;

      const clinicLocale = asLocale(rd.dentist.locale);
      const t = (await getDictionary(clinicLocale)).emails;

      const { error } = await resend.emails.send({
        from,
        to: rd.dentist.email,
        replyTo: request.user.email,
        subject: t.subjectQuoteRequest,
        html: quoteRequestEmailHtml({
          locale: clinicLocale,
          t,
          dentistName: rd.dentist.dentistName,
          // Third person in this email, so the label reads naturally.
          patientName: request.user.fullName ?? t.patientFallback,
          patientPhone: formatPhoneForDisplay(request.user.phone) || "—",
          // Verification is optional (PRD 4.2), so tell the clinic which kind of
          // number it's getting instead of letting it assume all were checked.
          phoneVerified: Boolean(request.user.phoneVerifiedAt),
          requestId: request.id,
          date: formatDate(clinicLocale),
          quoteUrl,
        }),
        attachments,
      });

      if (error) throw new Error(error.message ?? "Resend error");
      sent += 1;
      try {
        await recordVerifiedRequest(rd.dentistId);
      } catch (err) {
        logEvent("error", "fulfillment.record_verified_request_failed", {
          requestId: request.id,
          dentistId: rd.dentistId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } catch (err) {
      logEvent("error", "fulfillment.email_send_failed", {
        requestId: request.id,
        dentistEmail: rd.dentist.email,
        error: err instanceof Error ? err.message : String(err),
      });
      // Release the claim so a later retry — or the daily safety-net cron —
      // can pick this recipient up again.
      await db.requestDentist.updateMany({
        where: { id: rd.id },
        data: { emailSent: false, sentAt: null, quoteToken: null },
      });
    }
  }

  if (sent > 0) {
    await audit({
      actor: "system",
      action: "request.fulfilled",
      entity: "Request",
      entityId: request.id,
      metadata: { emailsSent: sent, alreadySent },
    });
  }

  // SENT once at least one clinic has the request; FAILED only when every
  // recipient failed, so the safety-net cron can find it and retry.
  const anyDelivered = sent > 0 || alreadySent > 0;
  await db.request.update({
    where: { id: request.id },
    data: anyDelivered ? { status: "SENT", sentAt: new Date() } : { status: "FAILED" },
  });

  return { ok: true, emailsSent: sent, alreadySent };
}
