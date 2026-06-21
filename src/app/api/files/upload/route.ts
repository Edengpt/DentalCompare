import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blobPath, type UploadKind, validateFile, fileValidationMessage } from "@/lib/storage";

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

  // Upload to Vercel Blob
  const blob = await put(blobPath(requestId, kind as UploadKind, file), file, {
    access: "public",
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
