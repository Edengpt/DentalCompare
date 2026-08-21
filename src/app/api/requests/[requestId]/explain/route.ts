import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { explainTreatment } from "@/server/explain-treatment";
import { getRequestLocale } from "@/i18n/request-locale";
import { getDictionary } from "@/i18n/get-dictionary";

export const runtime = "nodejs";

/**
 * On-demand AI explanation of a request's treatment plan. Owner-only: the same
 * ownership gate as the private-file route, so nobody can spend AI budget on a
 * request that isn't theirs.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const locale = await getRequestLocale();
  const t = (await getDictionary(locale)).explain;
  const { requestId } = await params;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new NextResponse("Unauthorized", { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { userId: true, treatmentFileUrl: true },
  });
  // 404 (not 403) so we don't confirm the request exists to unrelated users.
  if (!request || request.userId !== user.id) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!request.treatmentFileUrl) {
    return NextResponse.json({ error: t.noTreatmentPlan }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: t.aiUnavailable },
      { status: 503 },
    );
  }

  try {
    const result = await explainTreatment(request.treatmentFileUrl, locale);
    return NextResponse.json(result);
  } catch (err) {
    console.error("explainTreatment failed:", err);
    return NextResponse.json({ error: t.explainFailed }, { status: 500 });
  }
}
