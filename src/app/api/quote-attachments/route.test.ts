import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { get, del, loadEditableTarget, count, create } = vi.hoisted(() => ({
  get: vi.fn(),
  del: vi.fn(),
  loadEditableTarget: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ get, del }));
vi.mock("@/server/quote-target", () => ({ loadEditableTarget }));
vi.mock("@/lib/db", () => {
  const tx = { quoteAttachment: { count, create } };
  return { db: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
});

import { POST } from "./route";

const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
const EXE_BYTES = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00];
const OWN_URL =
  "https://x.blob.vercel-storage.com/requests/req-1/quote-attachments/rd-1/abc-Xy7.pdf";

function stored(bytes: number[], size = 1000, contentType = "application/pdf") {
  return {
    statusCode: 200,
    blob: { contentType, size },
    stream: new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(bytes));
        c.close();
      },
    }),
  };
}

const confirm = (url: string, name = "plan.pdf") =>
  POST(
    new Request("http://x/api/quote-attachments", {
      method: "POST",
      body: JSON.stringify({ token: "tok", url, name }),
    }),
  );

describe("POST /api/quote-attachments", () => {
  beforeEach(() => {
    loadEditableTarget.mockResolvedValue({ ok: true, rd: { id: "rd-1", requestId: "req-1" } });
    get.mockResolvedValue(stored(PDF_BYTES));
    del.mockResolvedValue(undefined);
    count.mockResolvedValue(0);
    create.mockImplementation(async ({ data }) => ({
      id: "att-1",
      originalName: data.originalName,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
    }));
  });
  afterEach(() => vi.clearAllMocks());

  it("records a file whose bytes match, under the clinic's own name for it", async () => {
    const res = await confirm(OWN_URL, "C:\\fakepath\\תוכנית.pdf");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      attachment: {
        id: "att-1",
        name: "תוכנית.pdf",
        contentType: "application/pdf",
        sizeBytes: 1000,
      },
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes and refuses a file whose bytes don't match its type", async () => {
    get.mockResolvedValue(stored(EXE_BYTES));
    const res = await confirm(OWN_URL);
    expect(res.status).toBe(400);
    expect(del).toHaveBeenCalledWith(OWN_URL);
    expect(create).not.toHaveBeenCalled();
  });

  it("deletes and refuses a file over 10MB", async () => {
    get.mockResolvedValue(stored(PDF_BYTES, 10 * 1024 * 1024 + 1));
    const res = await confirm(OWN_URL);
    expect(res.status).toBe(400);
    expect(del).toHaveBeenCalledWith(OWN_URL);
  });

  // Confines both the read and the delete: without it a quote token could
  // name a patient's x-ray here and have it deleted.
  it("refuses a url outside this clinic's folder, and touches nothing", async () => {
    for (const url of [
      "https://x.blob.vercel-storage.com/requests/req-1/xray-abc.jpg",
      "https://x.blob.vercel-storage.com/requests/req-1/quote-attachments/rd-2/abc.pdf",
      "https://evil.example.com/requests/req-1/quote-attachments/rd-1/abc.pdf",
    ]) {
      const res = await confirm(url);
      expect(res.status).toBe(400);
    }
    expect(get).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("refuses once the quote is locked, and touches nothing", async () => {
    loadEditableTarget.mockResolvedValue({ ok: false, error: "DECIDED" });
    const res = await confirm(OWN_URL);
    expect(res.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("refuses a sixth file and deletes it", async () => {
    count.mockResolvedValue(5);
    const res = await confirm(OWN_URL);
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith(OWN_URL);
  });
});
