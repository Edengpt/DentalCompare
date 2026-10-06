import { NextResponse } from "next/server";
import { get, del } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { isAdminEmail } from "@/server/admin";
import { loadEditableTarget } from "@/server/quote-target";
import { contentDisposition } from "@/lib/quote-attachments";

export const runtime = "nodejs";

/**
 * Streams a quote document to the patient who owns the request, to the clinic
 * that attached it, or to an admin. Everyone else gets a 404, never a 403, so
 * the route doesn't confirm the file exists.
 *
 * The patient sees a document only once the quote it belongs to has been
 * submitted — before that it is the clinic's draft.
 *
 * `?download=1` asks the browser to save rather than open it.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new NextResponse("Unauthorized", { status: 401 });

  // A clinic account signs in through the same Clerk instance but need not have
  // a patient User row, so the two identities are looked up side by side.
  const [user, clinic] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId }, select: { id: true, email: true } }),
    db.dentist.findUnique({ where: { clerkUserId }, select: { id: true } }),
  ]);
  if (!user && !clinic) return new NextResponse("Unauthorized", { status: 401 });

  const attachment = await db.quoteAttachment.findUnique({
    where: { id },
    select: {
      blobUrl: true,
      originalName: true,
      requestDentist: {
        select: {
          dentistId: true,
          quote: { select: { id: true } },
          request: { select: { userId: true } },
        },
      },
    },
  });
  if (!attachment) return new NextResponse("Not found", { status: 404 });
  const rd = attachment.requestDentist;

  const allowed =
    (user !== null &&
      ((rd.request.userId === user.id && rd.quote !== null) || isAdminEmail(user.email))) ||
    (clinic !== null && clinic.id === rd.dentistId);
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  try {
    const result = await get(attachment.blobUrl, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse("Not found", { status: 404 });
    }
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Content-Disposition": contentDisposition(
          download ? "attachment" : "inline",
          attachment.originalName,
        ),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error(`quote attachment download failed for ${id}:`, err);
    return new NextResponse("Not found", { status: 404 });
  }
}

/**
 * Removes a document from a quote that is still editable. Authorized by the
 * quote token, like the upload — the magic-link clinic has no session.
 *
 * Blob first, row second: a row whose blob is gone is a broken link the clinic
 * can retry; a blob whose row is gone is a medical file nobody can find to
 * delete.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";

  const target = await loadEditableTarget(token);
  if (!target.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rl = await rateLimit(
    `quote-attach:${token}`,
    RATE_LIMITS.quoteAttachment.limit,
    RATE_LIMITS.quoteAttachment.windowMs,
  );
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const attachment = await db.quoteAttachment.findFirst({
    where: { id, requestDentistId: target.rd.id },
    select: { id: true, blobUrl: true },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await del(attachment.blobUrl);
  } catch (err) {
    console.error(`quote attachment blob delete failed for ${id}:`, err);
    return NextResponse.json({ error: "Delete failed" }, { status: 502 });
  }
  await db.quoteAttachment.delete({ where: { id: attachment.id } });
  return NextResponse.json({ ok: true });
}
