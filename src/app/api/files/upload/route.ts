import { NextResponse } from "next/server";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/format";
import { getRequestLocale } from "@/i18n/request-locale";
import { fileValidationMessage } from "@/i18n/validation-message";
import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  blobPath,
  type UploadKind,
  validateFile,
  fileSignatureMatches,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS, REQUEST_LIMITS } from "@/lib/constants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const t = (await getDictionary(await getRequestLocale())).validation;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reject oversized uploads from the Content-Length header BEFORE buffering the
  // whole body into memory via formData(). validateFile() still enforces the
  // exact byte size later (Content-Length can be absent or spoofed) — this is a
  // cheap early guard against memory-exhaustion from a huge multipart body.
  // Allow ~1MB of multipart framing overhead on top of the file-size limit.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_FILE_SIZE_BYTES + 1024 * 1024) {
    return NextResponse.json(
      { error: format(t.fileSize, { mb: REQUEST_LIMITS.maxFileSizeMB }) },
      { status: 413 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const requestId = formData.get("requestId");
  const kind = formData.get("kind");

  if (!(file instanceof File) || typeof requestId !== "string" || typeof kind !== "string") {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  if (kind !== "treatment" && kind !== "xray") {
    return NextResponse.json({ error: "Invalid file kind" }, { status: 400 });
  }

  const validation = validateFile(file);
  if (validation) {
    return NextResponse.json({ error: fileValidationMessage(t, validation) }, { status: 400 });
  }

  // Defense-in-depth: confirm the actual bytes match the declared type — a
  // renamed executable with a spoofed MIME/extension is rejected here.
  if (!(await fileSignatureMatches(file))) {
    return NextResponse.json(
      { error: t.fileSignature },
      { status: 400 },
    );
  }

  // Verify the request belongs to the current user
  const user = await db.user.findUnique({ where: { clerkUserId } });
  if (!user) {
    return NextResponse.json(
      { error: "User profile not synced yet — please refresh and retry" },
      { status: 404 },
    );
  }

  const existingRequest = await db.request.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, status: true },
  });
  if (!existingRequest || existingRequest.userId !== user.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Cap uploads per request to curb abuse of the endpoint.
  const rl = await rateLimit(
    `upload:${requestId}`,
    RATE_LIMITS.fileUpload.limit,
    RATE_LIMITS.fileUpload.windowMs,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: t.tooManyUploads },
      { status: 429 },
    );
  }

  // Upload to Vercel Blob as PRIVATE — treatment plans and x-rays are medical
  // records and must not be reachable by URL. Access goes through the
  // auth-checked /api/files/[requestId]/[kind] route (patient/admin) or as email
  // attachments to dentists.
  const blob = await put(blobPath(requestId, kind as UploadKind, file), file, {
    access: "private",
    addRandomSuffix: true,
    contentType: file.type,
  });

  // Save URL to the appropriate Request column
  const updated = await db.request.update({
    where: { id: requestId },
    data: kind === "treatment" ? { treatmentFileUrl: blob.url } : { xrayFileUrl: blob.url },
    select: { treatmentFileUrl: true, xrayFileUrl: true },
  });

  return NextResponse.json({
    url: blob.url,
    kind,
    request: updated,
  });
}
