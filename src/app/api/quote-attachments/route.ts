import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { fileValidationMessage } from "@/i18n/validation-message";
import { blobPathnameOf, readBlobHead } from "@/lib/blob-head";
import { headMatchesType } from "@/lib/storage";
import { QUOTE_LIMITS } from "@/lib/quote-catalog";
import {
  QUOTE_ATTACHMENT_MAX_BYTES,
  isQuoteAttachmentBlobPath,
  sanitizeAttachmentName,
} from "@/lib/quote-attachments";
import { loadEditableTarget } from "@/server/quote-target";

export const runtime = "nodejs";

/**
 * Attaches a document the clinic's browser has already uploaded to its quote.
 *
 * The URL arrives as a string the browser chose and is checked rather than
 * trusted: it must be a blob URL, its path must be this clinic's folder on
 * this request, and its bytes must match the type the store recorded. Only
 * then is a row created — a file nothing points at is never shown to anyone.
 */
export async function POST(request: Request) {
  const dict = await getDictionary(await getRequestLocale());

  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    url?: unknown;
    name?: unknown;
  } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const url = typeof body?.url === "string" ? body.url : "";
  const name = sanitizeAttachmentName(typeof body?.name === "string" ? body.name : "");
  if (!token || !url) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const target = await loadEditableTarget(token);
  if (!target.ok) {
    const error =
      target.error === "INVALID_LINK" ? dict.errors.invalidLink : dict.errors.quoteAlreadyDecided;
    return NextResponse.json({ error }, { status: 404 });
  }
  const { rd } = target;

  // The pathname is read out of the URL rather than accepted separately, so a
  // caller can't pair someone else's URL with a pathname that passes — the
  // failure branches below delete what the URL points at.
  const pathname = blobPathnameOf(url);
  if (!pathname || !isQuoteAttachmentBlobPath(pathname, rd.requestId, rd.id)) {
    return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
  }

  const stored = await readBlobHead(url);
  if (!stored || !headMatchesType(stored.head, stored.contentType)) {
    void del(url).catch(() => {});
    return NextResponse.json({ error: dict.validation.fileSignature }, { status: 400 });
  }
  if (stored.size > QUOTE_ATTACHMENT_MAX_BYTES) {
    void del(url).catch(() => {});
    return NextResponse.json(
      { error: fileValidationMessage(dict.validation, "SIZE", QUOTE_LIMITS.attachmentMaxMB) },
      { status: 400 },
    );
  }

  // A URL already attached is answered as a no-op, never as a failure: the
  // failure branch below deletes the blob, which a live row points at.
  const existing = await db.quoteAttachment.findUnique({
    where: { blobUrl: url },
    select: { id: true, originalName: true, contentType: true, sizeBytes: true },
  });
  if (existing) {
    return NextResponse.json({
      attachment: {
        id: existing.id,
        name: existing.originalName,
        contentType: existing.contentType,
        sizeBytes: existing.sizeBytes,
      },
    });
  }

  // Count and create under a lock on the clinic's row, so two confirms racing
  // past the token route's count can't both land a sixth file — a plain
  // transaction at READ COMMITTED would let both see four.
  const attachment = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "RequestDentist" WHERE id = ${rd.id} FOR UPDATE`;
    const count = await tx.quoteAttachment.count({ where: { requestDentistId: rd.id } });
    if (count >= QUOTE_LIMITS.maxAttachments) return null;
    return tx.quoteAttachment.create({
      data: {
        requestDentistId: rd.id,
        blobUrl: url,
        contentType: stored.contentType,
        sizeBytes: stored.size,
        originalName: name,
      },
      select: { id: true, originalName: true, contentType: true, sizeBytes: true },
    });
  });
  if (!attachment) {
    void del(url).catch(() => {});
    return NextResponse.json(
      { error: format(dict.errors.attachmentLimit, { max: QUOTE_LIMITS.maxAttachments }) },
      { status: 400 },
    );
  }

  return NextResponse.json({
    attachment: {
      id: attachment.id,
      name: attachment.originalName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
    },
  });
}
