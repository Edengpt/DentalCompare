import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { get, del, rateLimit, docCount } = vi.hoisted(() => ({
  get: vi.fn(),
  del: vi.fn(),
  rateLimit: vi.fn(),
  docCount: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ get, del }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/db", () => ({ db: { clinicDocument: { count: docCount } } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4" }),
}));

import { POST, DELETE } from "./route";

const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]; // "%PDF-1.4"
const EXE_BYTES = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00];
const DOC_URL = "https://x.blob.vercel-storage.com/clinics/documents/a.pdf";

/** A stored blob the confirm step will read back. */
function stored(bytes: number[], contentType = "application/pdf") {
  return {
    statusCode: 200,
    blob: { contentType },
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(bytes));
        controller.close();
      },
    }),
  };
}

function confirm(url: string): Request {
  return new Request("http://x/api/clinics/documents", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

describe("POST /api/clinics/documents", () => {
  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "blob_test_token";
    rateLimit.mockResolvedValue({ allowed: true });
    get.mockResolvedValue(stored(PDF_BYTES));
    // The real del() returns a promise the route attaches a catch to.
    del.mockResolvedValue(undefined);
    docCount.mockResolvedValue(0);
  });
  afterEach(() => vi.clearAllMocks());

  it("confirms a document whose bytes match and returns its url", async () => {
    const res = await POST(confirm(DOC_URL));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: DOC_URL });
    expect(del).not.toHaveBeenCalled();
  });

  // The file no longer passes through this route, so the byte check reads it
  // back out of the store. A renamed executable declaring application/pdf
  // passes every check that trusts the browser; the bytes do not lie.
  it("rejects a file whose bytes do not match the type it was stored under", async () => {
    get.mockResolvedValue(stored(EXE_BYTES));
    const res = await POST(confirm(DOC_URL));
    expect(res.status).toBe(400);
  });

  // Nothing points at a refused file, and the store it sits in also holds
  // patients' x-rays. Leaving it there is how that store fills with content
  // nobody checked.
  it("deletes the file it just refused", async () => {
    get.mockResolvedValue(stored(EXE_BYTES));
    await POST(confirm(DOC_URL));
    expect(del).toHaveBeenCalledWith(DOC_URL);
  });

  // Confines both the read and the delete. Without it a caller could name a
  // patient's x-ray here and have it deleted.
  it("refuses a url outside the documents prefix, and deletes nothing", async () => {
    const res = await POST(confirm("https://x.blob.vercel-storage.com/requests/r1/xray.jpg"));
    expect(res.status).toBe(400);
    expect(del).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  // The store this writes to also holds patients' x-rays. An unauthenticated
  // route into it with no rate limit is a write primitive for anyone.
  it("refuses once the IP is over its limit, and never touches storage", async () => {
    rateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 });
    const res = await POST(confirm(DOC_URL));
    expect(res.status).toBe(429);
    expect(get).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("refuses to run at all when the private store is not configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res = await POST(confirm(DOC_URL));
    expect(res.status).toBe(503);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/clinics/documents", () => {
  const orphan = "https://x.blob.vercel-storage.com/clinics/documents/a.pdf";

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "blob_test_token";
    rateLimit.mockResolvedValue({ allowed: true });
    del.mockResolvedValue(undefined);
    docCount.mockResolvedValue(0);
  });
  afterEach(() => vi.clearAllMocks());

  const call = (url: string) =>
    DELETE(
      new Request("http://x/api/clinics/documents", {
        method: "DELETE",
        body: JSON.stringify({ url }),
      }),
    );

  it("deletes an orphan left behind when the clinic changed country", async () => {
    const res = await call(orphan);
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith(orphan);
  });

  // This is the whole reason the endpoint is safe to expose. A document already
  // attached to a clinic can never be removed through it, however the URL was
  // obtained.
  it("refuses to delete a document that belongs to a clinic", async () => {
    docCount.mockResolvedValue(1);
    const res = await call(orphan);
    expect(res.status).toBe(409);
    expect(del).not.toHaveBeenCalled();
  });

  it("refuses a url outside the documents prefix", async () => {
    const res = await call("https://x.blob.vercel-storage.com/requests/r1/xray.jpg");
    expect(res.status).toBe(400);
    expect(del).not.toHaveBeenCalled();
  });
});
