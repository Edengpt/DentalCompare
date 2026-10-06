import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  authMock,
  userFindUnique,
  dentistFindUnique,
  attachmentFindUnique,
  attachmentFindFirst,
  attachmentDelete,
  getBlob,
  del,
  isAdminEmail,
  loadEditableTarget,
  rateLimit,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUnique: vi.fn(),
  dentistFindUnique: vi.fn(),
  attachmentFindUnique: vi.fn(),
  attachmentFindFirst: vi.fn(),
  attachmentDelete: vi.fn(),
  getBlob: vi.fn(),
  del: vi.fn(),
  isAdminEmail: vi.fn(),
  loadEditableTarget: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@vercel/blob", () => ({ get: getBlob, del }));
vi.mock("@/server/admin", () => ({ isAdminEmail }));
vi.mock("@/server/quote-target", () => ({ loadEditableTarget }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: userFindUnique },
    dentist: { findUnique: dentistFindUnique },
    quoteAttachment: {
      findUnique: attachmentFindUnique,
      findFirst: attachmentFindFirst,
      delete: attachmentDelete,
    },
  },
}));

import { GET, DELETE } from "./route";

const get = (query = "") =>
  GET(new Request(`http://x/api/quote-attachments/att-1${query}`), {
    params: Promise.resolve({ id: "att-1" }),
  });

function attachment({ quoteSubmitted = true } = {}) {
  return {
    blobUrl: "https://x.blob.vercel-storage.com/a.pdf",
    originalName: "תוכנית טיפול.pdf",
    requestDentist: {
      dentistId: "clinic-1",
      quote: quoteSubmitted ? { id: "q-1" } : null,
      request: { userId: "patient-1" },
    },
  };
}

describe("GET /api/quote-attachments/[id]", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "clerk-1" });
    userFindUnique.mockResolvedValue({ id: "patient-1", email: "p@example.com" });
    dentistFindUnique.mockResolvedValue(null);
    attachmentFindUnique.mockResolvedValue(attachment());
    isAdminEmail.mockReturnValue(false);
    getBlob.mockResolvedValue({
      statusCode: 200,
      blob: { contentType: "application/pdf" },
      stream: new ReadableStream(),
    });
  });
  afterEach(() => vi.clearAllMocks());

  it("serves the request's patient inline, with a UTF-8 file name", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const cd = res.headers.get("Content-Disposition")!;
    expect(cd.startsWith("inline;")).toBe(true);
    expect(cd).toContain(`filename*=UTF-8''${encodeURIComponent("תוכנית טיפול.pdf")}`);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sends it as a download with ?download=1", async () => {
    const res = await get("?download=1");
    expect(res.headers.get("Content-Disposition")!.startsWith("attachment;")).toBe(true);
  });

  it("hides a draft from the patient until the quote is submitted", async () => {
    attachmentFindUnique.mockResolvedValue(attachment({ quoteSubmitted: false }));
    expect((await get()).status).toBe(404);
  });

  it("returns 404 to another patient and to an unrelated clinic", async () => {
    userFindUnique.mockResolvedValue({ id: "patient-2", email: "o@example.com" });
    expect((await get()).status).toBe(404);

    userFindUnique.mockResolvedValue(null);
    dentistFindUnique.mockResolvedValue({ id: "clinic-2" });
    expect((await get()).status).toBe(404);
    expect(getBlob).not.toHaveBeenCalled();
  });

  it("serves the clinic that attached it, even before submitting", async () => {
    userFindUnique.mockResolvedValue(null);
    dentistFindUnique.mockResolvedValue({ id: "clinic-1" });
    attachmentFindUnique.mockResolvedValue(attachment({ quoteSubmitted: false }));
    expect((await get()).status).toBe(200);
  });

  it("serves an admin", async () => {
    userFindUnique.mockResolvedValue({ id: "admin", email: "a@example.com" });
    isAdminEmail.mockReturnValue(true);
    expect((await get()).status).toBe(200);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValue({ userId: null });
    expect((await get()).status).toBe(401);
  });
});

describe("DELETE /api/quote-attachments/[id]", () => {
  const call = (token: string) =>
    DELETE(
      new Request("http://x/api/quote-attachments/att-1", {
        method: "DELETE",
        body: JSON.stringify({ token }),
      }),
      { params: Promise.resolve({ id: "att-1" }) },
    );

  beforeEach(() => {
    loadEditableTarget.mockResolvedValue({ ok: true, rd: { id: "rd-1" } });
    rateLimit.mockResolvedValue({ allowed: true });
    attachmentFindFirst.mockResolvedValue({ id: "att-1", blobUrl: "https://b/a.pdf" });
    del.mockResolvedValue(undefined);
    attachmentDelete.mockResolvedValue({});
  });
  afterEach(() => vi.clearAllMocks());

  it("deletes the blob, then the row", async () => {
    const order: string[] = [];
    del.mockImplementation(async () => void order.push("blob"));
    attachmentDelete.mockImplementation(async () => void order.push("row"));
    expect((await call("tok")).status).toBe(200);
    expect(order).toEqual(["blob", "row"]);
  });

  it("only finds attachments on the token's own quote", async () => {
    await call("tok");
    expect(attachmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "att-1", requestDentistId: "rd-1" } }),
    );
  });

  it("refuses a bad or locked token and deletes nothing", async () => {
    loadEditableTarget.mockResolvedValue({ ok: false, error: "INVALID_LINK" });
    expect((await call("nope")).status).toBe(404);
    expect(del).not.toHaveBeenCalled();
  });

  it("keeps the row when the blob delete fails", async () => {
    del.mockRejectedValue(new Error("store down"));
    expect((await call("tok")).status).toBe(502);
    expect(attachmentDelete).not.toHaveBeenCalled();
  });
});
