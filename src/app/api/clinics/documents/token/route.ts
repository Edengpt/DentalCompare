import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import {
  DOC_ACCEPTED_MIME_TYPES,
  DOC_MAX_FILE_SIZE_BYTES,
  isClinicDocumentBlobPath,
} from "@/lib/clinic-documents";

export const runtime = "nodejs";

async function clientIp(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

/**
 * Issues a short-lived token so the browser can upload a licence straight to
 * storage, skipping the route — and with it Vercel's ~4.5MB edge limit on
 * request bodies, which is the only reason the document limit was ever 4MB.
 *
 * Like the route it replaces, this is unauthenticated: the registration form is
 * public and the document is uploaded before the clinic row exists. The same
 * boundaries stand in for authentication, all of them before the token exists:
 * a per-IP rate limit, a store-enforced size and type, and a path the caller
 * cannot choose freely. The check of the file's leading bytes is the one that
 * had to move — the bytes never reach us now — and it runs at the confirm step
 * in ../route.ts, which reads them back out.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const rl = await rateLimit(
          `clinic-doc:${await clientIp()}`,
          RATE_LIMITS.clinicDocument.limit,
          RATE_LIMITS.clinicDocument.windowMs,
        );
        if (!rl.allowed) throw new Error("Too many uploads");

        if (!isClinicDocumentBlobPath(pathname)) throw new Error("Invalid upload path");

        return {
          allowedContentTypes: [...DOC_ACCEPTED_MIME_TYPES],
          maximumSizeInBytes: DOC_MAX_FILE_SIZE_BYTES,
          // Also what stops a caller naming an existing document's path in
          // order to overwrite it: every upload lands on a fresh name.
          addRandomSuffix: true,
        };
      },
      // No onUploadCompleted on purpose: Vercel's servers call it, so it never
      // fires against localhost and the local flow would silently skip the
      // byte check. The browser confirms to ../route.ts instead.
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload rejected" },
      { status: 400 },
    );
  }
}
