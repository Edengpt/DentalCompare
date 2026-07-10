import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillPaidSession } from "@/server/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Daily safety net for fulfillment. Finds PAID requests older than an hour that
 * still have un-emailed recipients — a send that failed, or a fulfillment call
 * that died mid-way — and re-runs fulfillment for them. fulfillPaidSession only
 * re-attempts the recipients still marked emailSent=false, so this is idempotent.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - ONE_HOUR_MS);
  const stuck = await db.request.findMany({
    where: {
      status: "PAID",
      createdAt: { lt: cutoff },
      requestDentists: { some: { emailSent: false } },
    },
    select: {
      id: true,
      payments: { where: { status: "PAID" }, select: { providerRef: true }, take: 1 },
    },
  });

  let retried = 0;
  let emails = 0;
  for (const r of stuck) {
    const providerRef = r.payments[0]?.providerRef;
    if (!providerRef) continue;
    try {
      const result = await fulfillPaidSession(providerRef);
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
