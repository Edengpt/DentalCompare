import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { headers } from "next/headers";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { fileSignatureMatches } from "@/lib/storage";
import {
  clinicDocumentBlobPath,
  isClinicDocumentBlobUrl,
  validateClinicDocument,
  DOC_MAX_FILE_SIZE_BYTES,
  DOC_MAX_FILE_SIZE_MB,
} from "@/lib/clinic-documents";

export const runtime = "nodejs";

/**
 * Licence-document upload for the clinic intake form, which is itself
 * unauthenticated — so this route cannot be either.
 *
 * Three boundaries stand in for authentication, because this writes into the
 * PRIVATE blob store, the same one the patients' x-rays live in:
 *
 *  1. a per-IP rate limit,
 *  2. a check of the file's leading bytes, not just its declared type,
 *  3. a delete that refuses any object already attached to a clinic.
 *
 * Files are uploaded before the clinic row exists — the same shape as the logo
 * upload — because the whole registration cannot travel in one request body:
 * Vercel refuses anything over roughly 4.5MB at the edge.
 */
async function clientIp(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  const t = (await getDictionary(await getRequestLocale())).validation;

  const rl = await rateLimit(
    `clinic-doc:${await clientIp()}`,
    RATE_LIMITS.clinicDocument.limit,
    RATE_LIMITS.clinicDocument.windowMs,
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: t.tooManyDocumentUploads }, { status: 429 });
  }

  // Read only as a configuration guard — the blob client picks the token up
  // from the environment itself. Failing here beats failing mid-upload.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: t.documentsUnavailable }, { status: 503 });
  }

  // Rejected from the header before formData() buffers the whole body into
  // memory. validateClinicDocument still checks the exact size afterwards:
  // Content-Length can be absent or wrong.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > DOC_MAX_FILE_SIZE_BYTES + 1024 * 1024) {
    return NextResponse.json(
      { error: format(t.documentSize, { mb: DOC_MAX_FILE_SIZE_MB }) },
      { status: 413 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: t.noFile }, { status: 400 });
  }

  const invalid = validateClinicDocument(file);
  if (invalid) {
    return NextResponse.json(
      {
        error:
          invalid === "SIZE"
            ? format(t.documentSize, { mb: DOC_MAX_FILE_SIZE_MB })
            : t.documentType,
      },
      { status: 400 },
    );
  }

  // Defense in depth: a renamed executable with a spoofed MIME type and
  // extension passes every check that trusts the browser. The bytes do not lie.
  if (!(await fileSignatureMatches(file))) {
    return NextResponse.json({ error: t.documentType }, { status: 400 });
  }

  // access: "private", like the patients' medical files and unlike the clinic
  // logos. A licence stored public would be readable by anyone holding the URL,
  // which would make the admin-only download route beside it pointless.
  const blob = await put(clinicDocumentBlobPath(file), file, {
    access: "private",
    addRandomSuffix: true,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}

/**
 * Removes a document uploaded during a registration that was never submitted —
 * the clinic changed country and its slots changed with it.
 *
 * Safe to expose only because of the reference check: an object already
 * attached to a clinic is refused however the URL was obtained. Leaving the
 * orphans instead is how a private store fills with health-adjacent files
 * nobody can attribute to anyone.
 */
export async function DELETE(request: Request) {
  const t = (await getDictionary(await getRequestLocale())).validation;

  const rl = await rateLimit(
    `clinic-doc:${await clientIp()}`,
    RATE_LIMITS.clinicDocument.limit,
    RATE_LIMITS.clinicDocument.windowMs,
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: t.tooManyDocumentUploads }, { status: 429 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: t.documentsUnavailable }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (!isClinicDocumentBlobUrl(url)) {
    return NextResponse.json({ error: t.documentType }, { status: 400 });
  }

  if ((await db.clinicDocument.count({ where: { blobUrl: url } })) > 0) {
    return NextResponse.json({ error: t.documentInUse }, { status: 409 });
  }

  await del(url);
  return NextResponse.json({ ok: true });
}
