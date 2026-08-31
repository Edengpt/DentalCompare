import { NextResponse } from "next/server";
import { get, del } from "@vercel/blob";
import { headers } from "next/headers";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { headMatchesType, SIGNATURE_BYTES } from "@/lib/storage";
import { isClinicDocumentBlobUrl } from "@/lib/clinic-documents";

export const runtime = "nodejs";

async function clientIp(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

/**
 * Confirms a licence document the browser has already uploaded.
 *
 * This route used to receive the file itself, which capped the document at 4MB:
 * anything travelling through a route travels through Vercel's edge, and the
 * edge refuses a body over roughly 4.5MB before route code runs. A phone photo
 * of a framed licence is routinely larger than that. The browser now writes
 * straight to storage (see ./token) and confirms here.
 *
 * The route is unauthenticated, because the registration form it serves is —
 * the document exists before the clinic row does. Three boundaries stand in for
 * authentication, and this step still carries the one that matters most here:
 * the file's leading bytes are read back out of the store and checked against
 * the type recorded for it. A renamed executable is deleted rather than handed
 * on to the form as a usable URL.
 */
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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: t.documentsUnavailable }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";

  // Confines what the byte check — and the delete below it — can be pointed at.
  // Without it a caller could name a patient's x-ray and have it deleted.
  if (!isClinicDocumentBlobUrl(url)) {
    return NextResponse.json({ error: t.documentType }, { status: 400 });
  }

  // Defence in depth, unchanged in substance and moved in place: a renamed
  // executable with a spoofed MIME type and extension passes every check that
  // trusts the browser. The bytes do not lie. The type they are checked against
  // is the one the store recorded, since that is what an admin will be served.
  const stored = await readHead(url);
  if (!stored || !headMatchesType(stored.head, stored.contentType)) {
    // Refused, so nothing may point at it — and an unattached object in the
    // private store is exactly what the DELETE below exists to prevent.
    void del(url).catch(() => {});
    return NextResponse.json({ error: t.documentType }, { status: 400 });
  }

  return NextResponse.json({ url });
}

/**
 * First bytes of a stored private blob and the type the store has on record,
 * or null when it cannot be read.
 */
async function readHead(url: string): Promise<{ head: Uint8Array; contentType: string } | null> {
  try {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const reader = result.stream.getReader();
    const head = new Uint8Array(SIGNATURE_BYTES);
    let filled = 0;
    // Read until the signature is covered rather than trusting one chunk to
    // carry it: a short first chunk would otherwise look like a bad signature
    // and get a real document deleted.
    while (filled < SIGNATURE_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      const take = value.subarray(0, SIGNATURE_BYTES - filled);
      head.set(take, filled);
      filled += take.length;
    }
    await reader.cancel().catch(() => {});
    if (filled < SIGNATURE_BYTES) return null;
    return { head, contentType: result.blob.contentType };
  } catch {
    return null;
  }
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
