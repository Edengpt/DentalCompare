import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isAdminEmail } from "@/server/admin";

export const runtime = "nodejs";

/**
 * Streams a clinic's licence document to an admin, and to nobody else.
 *
 * Everyone else — including anyone holding the raw blob URL — gets a 404 rather
 * than a 403: a 403 confirms the document exists, which is itself something a
 * stranger should not learn. The same shape as the patients' medical files, for
 * the same reason.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new NextResponse("Unauthorized", { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { email: true },
  });
  if (!user || !isAdminEmail(user.email)) return new NextResponse("Not found", { status: 404 });

  const doc = await db.clinicDocument.findUnique({
    where: { id },
    select: { blobUrl: true, contentType: true },
  });
  if (!doc) return new NextResponse("Not found", { status: 404 });

  try {
    const result = await get(doc.blobUrl, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse("Not found", { status: 404 });
    }
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || doc.contentType,
        // inline so it opens in the tab rather than downloading, and no-store so
        // a licence document is never left behind in a shared browser cache.
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error(`clinic document download failed for ${id}:`, err);
    return new NextResponse("Not found", { status: 404 });
  }
}
