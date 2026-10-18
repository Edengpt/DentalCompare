import { NextResponse } from "next/server";
import { purgeExpiredMedicalFiles } from "@/server/medical-file-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily retention run for patients' medical files (`vercel.json`'s
 * `"0 5 * * *"`). See purgeExpiredMedicalFiles for what is due and when.
 *
 * **Dry by default.** Until PURGE_MEDICAL_FILES is set to "on" it only reports
 * what it would delete. The first live run catches up on everything since
 * launch at once, so it is switched on deliberately, after reading a dry run's
 * numbers — never by a deploy.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const dryRun = process.env.PURGE_MEDICAL_FILES !== "on";
  const result = await purgeExpiredMedicalFiles({ dryRun });
  return NextResponse.json(result);
}
