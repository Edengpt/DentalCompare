import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { logoValidationMessage } from "@/i18n/validation-message";
import { put } from "@vercel/blob";
import {
  logoBlobPath,
  validateLogo,
  logoSignatureMatches,
  LOGO_MAX_FILE_SIZE_BYTES,
} from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

export const runtime = "nodejs";

async function clientIp(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

/**
 * Public logo upload for the clinic intake form (which is itself unauthenticated).
 * Accepts a single image, validates type/size, stores it on Vercel Blob with a
 * random suffix, and returns the URL — the form then submits that URL as the
 * clinic's profileImageUrl. Kept image-only and small to limit abuse.
 */
export async function POST(request: Request) {
  const t = (await getDictionary(await getRequestLocale())).validation;

  // Unauthenticated and writes to a PUBLIC store: without a cap, a loop could
  // fill it and use our domain's blob host as free image hosting.
  const rl = await rateLimit(
    `clinic-logo:${await clientIp()}`,
    RATE_LIMITS.clinicLogo.limit,
    RATE_LIMITS.clinicLogo.windowMs,
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: t.tooManyDocumentUploads }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: t.noFile }, { status: 400 });
  }
  if (file.size > LOGO_MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: logoValidationMessage(t, "SIZE") }, { status: 400 });
  }

  const validation = validateLogo(file);
  if (validation) {
    return NextResponse.json({ error: logoValidationMessage(t, validation) }, { status: 400 });
  }
  // The declared type is the browser's word; the leading bytes are the file's.
  if (!(await logoSignatureMatches(file))) {
    return NextResponse.json({ error: logoValidationMessage(t, "TYPE") }, { status: 400 });
  }

  // Logos are public images shown in the directory, so they live in the PUBLIC
  // blob store (LOGO_BLOB_READ_WRITE_TOKEN) — separate from the default token,
  // which points at the PRIVATE store used for medical files.
  const logoToken = process.env.LOGO_BLOB_READ_WRITE_TOKEN;
  if (!logoToken) {
    return NextResponse.json({ error: t.logoUnavailable }, { status: 503 });
  }

  const blob = await put(logoBlobPath(file), file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
    token: logoToken,
  });

  return NextResponse.json({ url: blob.url });
}
