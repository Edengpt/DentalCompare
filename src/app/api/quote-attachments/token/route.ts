import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { QUOTE_LIMITS } from "@/lib/quote-catalog";
import {
  QUOTE_ATTACHMENT_MAX_BYTES,
  QUOTE_ATTACHMENT_TYPES,
  isQuoteAttachmentBlobPath,
} from "@/lib/quote-attachments";
import { loadEditableTarget } from "@/server/quote-target";

export const runtime = "nodejs";

/**
 * Issues a short-lived token so a clinic's browser can upload a quote document
 * straight to the private store.
 *
 * Authorized by the quote token, not a Clerk session: the emailed magic link
 * is how most clinics quote, and they have no account. The same token already
 * authorizes the price, so this extends the trust it carries rather than
 * creating new trust — and it stops working at the same moment the quote locks.
 *
 * The magic-byte check can't happen here (the bytes never reach us); it runs
 * at the confirm step, which reads them back out.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload ?? "{}") as { token?: unknown };
        const token = typeof payload.token === "string" ? payload.token : "";

        const target = await loadEditableTarget(token);
        if (!target.ok) throw new Error("Quote is not editable");
        const { rd } = target;

        // The browser chose the pathname; this is the only moment anyone sees
        // it before the write, so it is the only place that can keep a quote
        // token inside its own folder.
        if (!isQuoteAttachmentBlobPath(pathname, rd.requestId, rd.id)) {
          throw new Error("Invalid upload path");
        }

        const rl = await rateLimit(
          `quote-attach:${token}`,
          RATE_LIMITS.quoteAttachment.limit,
          RATE_LIMITS.quoteAttachment.windowMs,
        );
        if (!rl.allowed) throw new Error("Too many uploads");

        const count = await db.quoteAttachment.count({ where: { requestDentistId: rd.id } });
        if (count >= QUOTE_LIMITS.maxAttachments) throw new Error("Attachment limit reached");

        return {
          allowedContentTypes: [...QUOTE_ATTACHMENT_TYPES],
          maximumSizeInBytes: QUOTE_ATTACHMENT_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      // Deliberately no onUploadCompleted, for the same reason as
      // /api/files/upload/token: it never fires against localhost. The browser
      // confirms to /api/quote-attachments instead.
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload rejected" },
      { status: 400 },
    );
  }
}
