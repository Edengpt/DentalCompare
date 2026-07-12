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

  // Logos are public images shown in the directory, so they live in the PUBLIC
  // blob store (LOGO_BLOB_READ_WRITE_TOKEN) — separate from the default token,
  // which points at the PRIVATE store used for medical files.
  const logoToken = process.env.LOGO_BLOB_READ_WRITE_TOKEN;
  if (!logoToken) {
    return NextResponse.json(
      { error: "העלאת הלוגו אינה זמינה כרגע" },
      { status: 503 },
    );
  }

  const blob = await put(logoBlobPath(file), file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
    token: logoToken,
  });

  return NextResponse.json({ url: blob.url });
}
