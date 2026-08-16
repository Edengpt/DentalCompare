import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillRequest } from "@/server/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Daily safety net for fulfillment. Finds submitted requests older than an hour
 * that still have un-emailed recipients — a send that failed, or a fulfillment
 * call that died mid-way — and re-runs delivery. fulfillRequest only re-attempts
 * the recipients still marked emailSent=false, so this is idempotent.
 *
 * SENT is included on purpose: a request counts as SENT once *any* recipient got
 * the email, so a partially delivered request would otherwise never be retried.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - ONE_HOUR_MS);
  const stuck = await db.request.findMany({
    where: {
      status: { in: ["SUBMITTED", "SENT", "FAILED"] },
      createdAt: { lt: cutoff },
      requestDentists: { some: { emailSent: false } },
    },
    select: { id: true },
  });

  let retried = 0;
  let emails = 0;
  for (const r of stuck) {
    try {
      const result = await fulfillRequest(r.id);
      if (result.ok) {
        retried += 1;
        emails += result.emailsSent;
      }
    } catch (err) {
      console.error(`[retry-fulfillment] error for request ${r.id}:`, err);
    }
  }

  return NextResponse.json({ checked: stuck.length, retried, emails });
}
