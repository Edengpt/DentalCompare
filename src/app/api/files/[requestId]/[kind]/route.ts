import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isAdminEmail } from "@/server/admin";

export const runtime = "nodejs";

const FILENAMES: Record<string, string> = {
  treatment: "treatment-plan",
  xray: "dental-xray",
};

function extFor(contentType: string | null): string {
  if (contentType?.includes("pdf")) return "pdf";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  return "bin";
}

/**
 * Streams a request's private medical file (treatment plan / x-ray) to the
 * patient who owns the request, to an admin, or to a clinic the request was
 * actually delivered to. Everyone else — including anyone holding the raw blob
 * URL — gets a 404. This is the only way those private blobs are reachable in
 * the browser.
 *
 * The clinic case exposes nothing new: the delivery email already carried both
 * files as attachments. It exists so the clinic can price the request from its
 * own area instead of digging for that email.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string; kind: string }> },
) {
  const { requestId, kind } = await params;
  if (kind !== "treatment" && kind !== "xray") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new NextResponse("Unauthorized", { status: 401 });

  // A clinic account signs in through the same Clerk instance but need not have
  // a patient User row, so the two identities are looked up side by side.
  const [user, clinic] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId }, select: { id: true, email: true } }),
    // Only an account already stamped onto a clinic. Linking one happens in the
    // clinic area on a verified address, never as a side effect of a download.
    db.dentist.findUnique({ where: { clerkUserId }, select: { id: true } }),
  ]);
  if (!user && !clinic) return new NextResponse("Unauthorized", { status: 401 });

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { userId: true, treatmentFileUrl: true, xrayFileUrl: true },
  });
  if (!request) return new NextResponse("Not found", { status: 404 });

  // Use 404 (not 403) so we don't confirm the request exists to anyone else.
  const allowed =
    (user !== null && (request.userId === user.id || isAdminEmail(user.email))) ||
    (clinic !== null && (await wasDeliveredTo(requestId, clinic.id)));
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const url = kind === "treatment" ? request.treatmentFileUrl : request.xrayFileUrl;
  if (!url) return new NextResponse("Not found", { status: 404 });

  try {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse("Not found", { status: 404 });
    }
    const contentType = result.blob.contentType || "application/octet-stream";
    const filename = `${FILENAMES[kind]}.${extFor(result.blob.contentType)}`;
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error(`file download failed for ${requestId}/${kind}:`, err);
    return new NextResponse("Not found", { status: 404 });
  }
}

/**
 * Whether this clinic received the request — selected AND emailed. A clinic the
 * patient picked but that was never sent the request (dropped at send time, or
 * still in the queue) has not been given the files and does not get them here.
 */
async function wasDeliveredTo(requestId: string, dentistId: string): Promise<boolean> {
  const rd = await db.requestDentist.findFirst({
    where: { requestId, dentistId, emailSent: true },
    select: { id: true },
  });
  return rd !== null;
}
