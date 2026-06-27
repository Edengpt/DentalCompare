import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import { SITE_CONFIG } from "@/lib/constants";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

function buildSetupHtml(opts: { contactName: string; clinicName: string; link: string }): string {
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
      html: buildSetupHtml({ contactName: args.contactName ?? "", clinicName: args.clinicName, link }),
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
