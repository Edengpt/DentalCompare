import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { put, del, rateLimit, docCount } = vi.hoisted(() => ({
  put: vi.fn(),
  del: vi.fn(),
  rateLimit: vi.fn(),
  docCount: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ put, del }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/db", () => ({ db: { clinicDocument: { count: docCount } } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4" }),
}));

import { POST, DELETE } from "./route";

const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]; // "%PDF-1.4"

function pdf(bytes: number[] = PDF_BYTES): File {
  return new File([new Uint8Array(bytes)], "licence.pdf", { type: "application/pdf" });
}

function postWith(file: File): Request {
  const body = new FormData();
  body.append("file", file);
  return new Request("http://x/api/clinics/documents", { method: "POST", body });
}

describe("POST /api/clinics/documents", () => {
  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "blob_test_token";
    rateLimit.mockResolvedValue({ allowed: true });
    put.mockResolvedValue({ url: "https://x.blob.vercel-storage.com/clinics/documents/a.pdf" });
    docCount.mockResolvedValue(0);
  });
  afterEach(() => vi.clearAllMocks());

  it("stores a valid document and returns its url", async () => {
    const res = await POST(postWith(pdf()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://x.blob.vercel-storage.com/clinics/documents/a.pdf",
    });
  });

  // The store this writes to also holds patients' x-rays. An unauthenticated
  // route into it with no rate limit is a write primitive for anyone.
  it("refuses once the IP is over its limit, and never touches storage", async () => {
    rateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 });
    const res = await POST(postWith(pdf()));
    expect(res.status).toBe(429);
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a type an admin could not open", async () => {
    const doc = new File([new Uint8Array([1, 2, 3])], "x.docx", { type: "application/msword" });
    const res = await POST(postWith(doc));
    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  // A renamed executable declaring application/pdf passes every check that
  // trusts the browser. The bytes do not lie.
  it("rejects a file whose bytes do not match its declared type", async () => {
    const res = await POST(postWith(pdf([0x4d, 0x5a, 0x90, 0x00])));
    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("refuses to run at all when the private store is not configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res = await POST(postWith(pdf()));
    expect(res.status).toBe(503);
    expect(put).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/clinics/documents", () => {
  const orphan = "https://x.blob.vercel-storage.com/clinics/documents/a.pdf";

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "blob_test_token";
    rateLimit.mockResolvedValue({ allowed: true });
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
    expect(del).toHaveBeenCalledWith(orphan, { token: "blob_test_token" });
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
