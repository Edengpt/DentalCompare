import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { authMock, userFindUnique, docFindUnique, getBlob, isAdminEmail } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUnique: vi.fn(),
  docFindUnique: vi.fn(),
  getBlob: vi.fn(),
  isAdminEmail: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@vercel/blob", () => ({ get: getBlob }));
vi.mock("@/server/admin", () => ({ isAdminEmail }));
vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: userFindUnique }, clinicDocument: { findUnique: docFindUnique } },
}));

import { GET } from "./route";

const call = (id: string) => GET(new Request("http://x"), { params: Promise.resolve({ id }) });

function streamOf(bytes: number[]) {
  return new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(bytes));
      c.close();
    },
  });
}

describe("GET /api/clinics/documents/[id]", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "clerk_admin" });
    userFindUnique.mockResolvedValue({ email: "admin@example.com" });
    isAdminEmail.mockReturnValue(true);
    docFindUnique.mockResolvedValue({
      blobUrl: "https://x.blob.vercel-storage.com/clinics/documents/a.pdf",
      contentType: "application/pdf",
    });
    getBlob.mockResolvedValue({
      statusCode: 200,
      stream: streamOf([1, 2, 3]),
      headers: new Headers(),
      blob: { contentType: "application/pdf" },
    });
  });
  afterEach(() => vi.clearAllMocks());

  it("streams the document to an admin", async () => {
    const res = await call("doc_1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
  });

  // 404 rather than 403: a 403 confirms the document exists, which is itself
  // something a stranger should not learn.
  it("turns away a signed-in patient with 404, not 403", async () => {
    isAdminEmail.mockReturnValue(false);
    const res = await call("doc_1");
    expect(res.status).toBe(404);
    expect(getBlob).not.toHaveBeenCalled();
  });

  it("turns away anonymous callers", async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await call("doc_1");
    expect(res.status).toBe(401);
    expect(getBlob).not.toHaveBeenCalled();
  });

  it("404s an id that does not exist", async () => {
    docFindUnique.mockResolvedValue(null);
    const res = await call("nope");
    expect(res.status).toBe(404);
  });

  // A licence is a private document handed to us. It should open in the tab and
  // never be left behind in a shared browser cache.
  it("serves the file inline with no-store", async () => {
    const res = await call("doc_1");
    expect(res.headers.get("content-disposition")).toContain("inline");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
