import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blobPathnameOf, readBlobHead } from "@/lib/blob-head";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import {
  headMatchesType,
  isOwnRequestBlobPath,
  type UploadKind,
} from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Attaches a file the browser has already uploaded to a request.
 *
 * This route used to receive the file itself. It cannot any more: Vercel
 * refuses a request body over roughly 4.5MB at the edge, before route code
 * runs, while the site advertises 20MB — so a phone photo of an x-ray failed
 * with a platform error the site could not explain. The browser now writes
 * straight to storage (see ./token) and reports the result here.
 *
 * The URL therefore arrives as a string the browser chose, and is checked
 * rather than trusted: it must be a blob URL, its path must belong to this
 * request and kind, and the request must belong to the caller.
 */
export async function POST(request: Request) {
  const t = (await getDictionary(await getRequestLocale())).validation;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    requestId?: unknown;
    kind?: unknown;
    url?: unknown;
  } | null;

  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const kind: UploadKind | null =
    body?.kind === "treatment" || body?.kind === "xray" ? body.kind : null;
  const url = typeof body?.url === "string" ? body.url : "";

  if (!requestId || !kind || !url) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // The pathname is read out of the URL rather than accepted as its own field.
  // Taking both separately would let a caller pair someone else's URL with a
  // pathname of their own that passes the check below — and the failure branch
  // deletes what the URL points at.
  const pathname = blobPathnameOf(url);
  if (!pathname || !isOwnRequestBlobPath(pathname, requestId, kind)) {
    return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) {
    return NextResponse.json(
      { error: "User profile not synced yet — please refresh and retry" },
      { status: 404 },
    );
  }

  const owned = await db.request.findFirst({
    where: { id: requestId, userId: user.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  // The magic-byte check used to run while we held the file. The bytes no
  // longer pass through here, so it happens as a short read back out of the
  // stored blob — a renamed executable declaring application/pdf is still
  // refused, and refused *before* the URL is recorded anywhere.
  //
  // The type checked against is the one the store recorded, not one the client
  // restates here: that stored type is what will be served to the clinic, so
  // it is the type the bytes have to agree with.
  const stored = await readBlobHead(url);
  if (!stored || !headMatchesType(stored.head, stored.contentType)) {
    // Nothing references this object, and a file we just refused must not be
    // left sitting in private storage.
    void del(url).catch(() => {});
    return NextResponse.json({ error: t.fileSignature }, { status: 400 });
  }

  const updated = await db.request.update({
    where: { id: requestId },
    data: kind === "treatment" ? { treatmentFileUrl: url } : { xrayFileUrl: url },
    select: { treatmentFileUrl: true, xrayFileUrl: true },
  });

  return NextResponse.json({ url, kind, request: updated });
}
