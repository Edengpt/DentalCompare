import { SITE_CONFIG } from "@/lib/constants";

// Pure HTML builders for the transactional emails. Kept dependency-free and
// side-effect-free so they're easy to read, diff, and unit test; the senders in
// src/server/*-notifications.ts and fulfillment.ts compose these.

/** Dentist "you were asked for a quote" email (patient fulfillment). */
export function quoteRequestEmailHtml(opts: {
  dentistName: string;
  patientName: string;
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

/** Patient "you received a new quote" notification. */
export function newQuoteEmailHtml(opts: { patientName: string; link: string }): string {
  const { patientName, link } = opts;
  return `
  <div dir="rtl" style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #0f4c4c;">קיבלת הצעת מחיר חדשה 🎉</h2>
    <p>שלום ${patientName},</p>
    <p>רופא הגיש הצעת מחיר לבקשה שלך ב-DentalCompare. היכנס/י כדי לראות את ההשוואה ולבחור.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}"
         style="display: inline-block; background: #0f4c4c; color: #fff; text-decoration: none;
                font-size: 16px; font-weight: bold; padding: 14px 30px; border-radius: 999px;">
        צפייה בהשוואה
      </a>
    </div>
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
    <p style="font-size: 12px; color: #777;">מייל זה נשלח אוטומטית על ידי DentalCompare.</p>
  </div>`;
}

/** Clinic "approved — set up your subscription" email. */
export function paymentSetupEmailHtml(opts: {
  contactName: string;
  clinicName: string;
  link: string;
}): string {
  const { contactName, clinicName, link } = opts;
  return `
  <div dir="rtl" style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #0f4c4c;">המרפאה אושרה — נותר רק להפעיל מנוי</h2>
    <p>שלום ${contactName || "צוות המרפאה"},</p>
    <p>המרפאה <strong>${clinicName}</strong> אושרה על ידי צוות DentalCompare.</p>
    <p>כדי שהמרפאה תופיע במאגר ותתחילו לקבל פניות, השלימו את הגדרת המנוי והתשלום:</p>
    <p style="margin: 24px 0;">
      <a href="${link}" style="background:#0f4c4c;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;">
        הפעלת המנוי והתשלום
      </a>
    </p>
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
    <p style="font-size: 12px; color: #777;">
      לשאלות: <a href="mailto:${SITE_CONFIG.supportEmail}">${SITE_CONFIG.supportEmail}</a>
    </p>
  </div>`;
}

/** Clinic "your recurring charge failed" email. */
export function paymentFailedEmailHtml(opts: { clinicName: string }): string {
  const { clinicName } = opts;
  return `
      <div dir="rtl" style="font-family: Arial, sans-serif; color:#1a1a1a; max-width:560px; margin:0 auto;">
        <h2 style="color:#0f4c4c;">לא הצלחנו לחייב את המנוי</h2>
        <p>החיוב התקופתי עבור <strong>${clinicName}</strong> נכשל. כדי שהמרפאה תמשיך להופיע במאגר, יש לעדכן את אמצעי התשלום.</p>
        <p style="font-size:12px;color:#777;">פנו לתמיכה: <a href="mailto:${SITE_CONFIG.supportEmail}">${SITE_CONFIG.supportEmail}</a></p>
      </div>`;
}
