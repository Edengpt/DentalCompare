import "server-only";
import { getResend, fromAddress } from "@/lib/email";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function sendNewQuoteEmail(args: {
  to: string;
  patientName: string;
  requestId: string;
}): Promise<void> {
  const link = `${appUrl()}/request/${args.requestId}`;
  const html = `
  <div dir="rtl" style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #0f4c4c;">קיבלת הצעת מחיר חדשה 🎉</h2>
    <p>שלום ${args.patientName},</p>
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

  await getResend().emails.send({
    from: fromAddress(),
    to: args.to,
    subject: "קיבלת הצעת מחיר חדשה 🎉",
    html,
  });
}
