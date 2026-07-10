import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blobPath, type UploadKind, validateFile, fileValidationMessage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: fileValidationMessage(validation) }, { status: 400 });
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
      { error: "יותר מדי העלאות לבקשה זו. נסו שוב מאוחר יותר." },
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
