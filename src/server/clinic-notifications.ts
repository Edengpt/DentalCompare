import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import { SITE_CONFIG } from "@/lib/constants";

const SUBJECT = "המרפאה שלכם אושרה ל-DentalCompare";

function buildApprovalHtml(opts: { contactName: string; clinicName: string }): string {
  const { contactName, clinicName } = opts;
  return `
  <div dir="rtl" style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #0f4c4c;">ברוכים הבאים ל-DentalCompare!</h2>
    <p>שלום ${contactName || "צוות המרפאה"},</p>
    <p>שמחים לעדכן שהמרפאה <strong>${clinicName}</strong> אושרה ופורסמה במאגר שלנו.</p>
    <p>מרגע זה המרפאה גלויה למטופלים שמחפשים הצעות מחיר, ותתחילו לקבל פניות ישירות לאימייל המרפאה.</p>

    <h3 style="color: #0f4c4c; margin-bottom: 4px;">מה הלאה?</h3>
    <ul style="padding-inline-start: 18px; margin-top: 4px;">
      <li>כשמטופל יבחר במרפאתכם, תקבלו מייל עם פרטיו ותוכנית הטיפול.</li>
      <li>השיבו ישירות למטופל עם הצעת המחיר שלכם.</li>
      <li>זכרו לדווח לנו על כל עסקה שנסגרה, בהתאם לחוזה העמלה שאישרתם.</li>
    </ul>

    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
    <p style="font-size: 12px; color: #777;">
      לשאלות: <a href="mailto:${SITE_CONFIG.supportEmail}">${SITE_CONFIG.supportEmail}</a><br />
      מייל זה נשלח אוטומטית על ידי DentalCompare.
    </p>
  </div>`;
}

/**
 * Notifies a clinic that its self-registration was approved. Best-effort: on a
 * missing API key or send error it logs and returns false rather than throwing,
 * so the approval flow never fails because of email delivery.
 */
export async function sendClinicApprovalEmail(opts: {
  email: string;
  contactName: string | null;
  clinicName: string;
}): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: opts.email,
      subject: SUBJECT,
      html: buildApprovalHtml({
        contactName: opts.contactName ?? "",
        clinicName: opts.clinicName,
      }),
    });
    if (error) {
      console.error(`Resend error for clinic approval ${opts.email}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send clinic approval email to ${opts.email}:`, err);
    return false;
  }
}
