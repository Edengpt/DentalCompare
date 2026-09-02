import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, isOwnRequestBlobPath } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Issues a short-lived token so the browser can upload straight to storage.
 *
 * The file used to travel through /api/files/upload, which meant it also had to
 * pass through Vercel's edge — and the edge refuses a request body over roughly
 * 4.5MB before any route code runs, answering in plain text. The site was
 * advertising 20MB, so a patient with a phone photo of an x-ray hit a platform
 * error the site could not explain. Going direct is what makes the advertised
 * limit true rather than lowering it: a large x-ray is a legitimate file.
 *
 * Everything the old route enforced while holding the file is enforced here
 * before the token exists, except the magic-byte check — the bytes never reach
 * us now, so that moved to the attach step, which reads them back out.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { userId: clerkUserId } = await auth();
        if (!clerkUserId) throw new Error("Unauthorized");

        const payload = JSON.parse(clientPayload ?? "{}") as {
          requestId?: unknown;
          kind?: unknown;
        };
        const requestId = typeof payload.requestId === "string" ? payload.requestId : "";
        const kind = payload.kind === "treatment" || payload.kind === "xray" ? payload.kind : null;
        if (!requestId || !kind) throw new Error("Invalid upload target");

        // The browser chooses the pathname. This is the only moment anyone sees
        // it before the write, so it is the only place that can stop a patient
        // writing into another patient's folder.
        if (!isOwnRequestBlobPath(pathname, requestId, kind)) {
          throw new Error("Invalid upload path");
        }

        const user = await db.user.findUnique({
          where: { clerkUserId },
          select: { id: true },
        });
        if (!user) throw new Error("Unauthorized");

        const owned = await db.request.findFirst({
          where: { id: requestId, userId: user.id },
          select: { id: true },
        });
        if (!owned) throw new Error("Request not found");

        const rl = await rateLimit(
          `upload:${requestId}`,
          RATE_LIMITS.fileUpload.limit,
          RATE_LIMITS.fileUpload.windowMs,
        );
        if (!rl.allowed) throw new Error("Too many uploads");

        return {
          // Enforced by the blob service itself, so an oversized or wrong-typed
          // upload is refused at the store rather than after we have paid to
          // receive it.
          allowedContentTypes: [...ACCEPTED_MIME_TYPES],
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
      // Deliberately no onUploadCompleted: it is called by Vercel's servers, so
      // it never fires against localhost and the local flow would silently stop
      // recording files. The browser confirms to /api/files/upload instead,
      // which is checked there rather than trusted.
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload rejected" },
      { status: 400 },
    );
  }
}
