import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getResend, fromAddress } from "@/lib/email";
import { quotePath } from "@/lib/quotes";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export type FulfillResult =
  | { ok: true; paid: boolean; emailsSent: number; alreadySent: number }
  | { ok: false; error: string };

const SUBJECT = "בקשה להצעת מחיר לטיפול שיניים";

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

function buildEmailHtml(opts: {
  dentistName: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  requestId: string;
  date: string;
  quoteUrl: string;
}): string {
  const { dentistName, patientName, patientPhone, requestId, date, quoteUrl } = opts;
  return `
  <div dir="rtl" style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #0f4c4c;">${patientName} ביקש/ה ממך הצעת מחיר</h2>
    <p>שלום ${dentistName},</p>
    <p>${patientName} מבקש/ת הצעת מחיר לטיפול שיניים דרך DentalCompare. תוכנית הטיפול והצילום מצורפים למייל זה.</p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${quoteUrl}"
         style="display: inline-block; background: #ff6b4a; color: #fff; text-decoration: none;
                font-size: 17px; font-weight: bold; padding: 16px 32px; border-radius: 999px;">
        💰 להזנת מחיר מהירה — לוקח 5 שניות
      </a>
    </div>

    <ul style="padding-inline-start: 18px; color: #555; font-size: 13px;">
      <li>מספר בקשה: ${requestId.slice(0, 8)}</li>
      <li>תאריך: ${date}</li>
      <li>ליצירת קשר ישיר: ${patientPhone || "ראו כפתור למעלה"}</li>
    </ul>

    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
    <p style="font-size: 12px; color: #777;">מייל זה נשלח אוטומטית על ידי DentalCompare.</p>
  </div>`;
}

/**
 * Idempotently finalizes a paid Checkout session: marks the Payment and Request
 * as PAID (if not already), then emails every selected dentist that hasn't been
 * emailed yet — attaching the treatment plan and x-ray. Safe to call multiple
 * times (from both the Stripe webhook and the success page), which is how the
 * PRD rule "לא ניתן לשלוח פעמיים את אותה בקשה" is enforced: `emailSent` gates
 * each recipient.
 */
export async function fulfillPaidSession(sessionId: string): Promise<FulfillResult> {
  const payment = await db.payment.findUnique({
    where: { providerRef: sessionId },
    select: { id: true, requestId: true, status: true },
  });
  if (!payment) return { ok: false, error: "תשלום לא נמצא" };

  // Promote payment + request to PAID once.
  if (payment.status !== "PAID") {
    await db.$transaction([
      db.payment.update({ where: { id: payment.id }, data: { status: "PAID" } }),
      db.request.update({ where: { id: payment.requestId }, data: { status: "PAID" } }),
    ]);
  }

  const request = await db.request.findUnique({
    where: { id: payment.requestId },
    select: {
      id: true,
      createdAt: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      user: { select: { fullName: true, email: true, phone: true } },
      requestDentists: {
        where: { emailSent: false },
        select: { id: true, dentist: { select: { dentistName: true, email: true } } },
      },
    },
  });
  if (!request) return { ok: false, error: "הבקשה לא נמצאה" };
  // The patient (User) is required to email dentists on their behalf. A null
  // user means the account was deleted (userId set to null) — nothing to fulfill.
  if (!request.user) return { ok: false, error: "המטופל לא נמצא" };

  const pending = request.requestDentists;
  if (pending.length === 0) {
    return { ok: true, paid: true, emailsSent: 0, alreadySent: 0 };
  }

  const date = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(request.createdAt);

  const attachments = [
    {
      filename: attachmentName(request.treatmentFileUrl, "treatment-plan"),
      path: request.treatmentFileUrl,
    },
    { filename: attachmentName(request.xrayFileUrl, "dental-xray"), path: request.xrayFileUrl },
  ];

  const resend = getResend();
  const from = fromAddress();
  let sent = 0;

  for (const rd of pending) {
    try {
      const quoteToken = randomUUID();
      const quoteUrl = `${appUrl()}${quotePath(quoteToken)}`;

      const { error } = await resend.emails.send({
        from,
        to: rd.dentist.email,
        replyTo: request.user.email,
        subject: SUBJECT,
        html: buildEmailHtml({
          dentistName: rd.dentist.dentistName,
          patientName: request.user.fullName,
          patientEmail: request.user.email,
          patientPhone: request.user.phone,
          requestId: request.id,
          date,
          quoteUrl,
        }),
        attachments,
      });

      if (error) {
        console.error(`Resend error for ${rd.dentist.email}:`, error);
        continue;
      }

      await db.requestDentist.update({
        where: { id: rd.id },
        data: { emailSent: true, sentAt: new Date(), quoteToken },
      });
      sent += 1;
    } catch (err) {
      console.error(`Failed to send to ${rd.dentist.email}:`, err);
    }
  }

  return { ok: true, paid: true, emailsSent: sent, alreadySent: 0 };
}
