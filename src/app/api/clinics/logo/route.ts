import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import {
  logoBlobPath,
  validateLogo,
  logoValidationMessage,
  LOGO_MAX_FILE_SIZE_BYTES,
} from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Public logo upload for the clinic intake form (which is itself unauthenticated).
 * Accepts a single image, validates type/size, stores it on Vercel Blob with a
 * random suffix, and returns the URL — the form then submits that URL as the
 * clinic's profileImageUrl. Kept image-only and small to limit abuse.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא נשלח קובץ" }, { status: 400 });
  }
  if (file.size > LOGO_MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: logoValidationMessage("SIZE") }, { status: 400 });
  }

  const validation = validateLogo(file);
  if (validation) {
    return NextResponse.json({ error: logoValidationMessage(validation) }, { status: 400 });
  }

  const blob = await put(logoBlobPath(file), file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}
