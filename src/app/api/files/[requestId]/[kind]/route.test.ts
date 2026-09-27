import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  authMock,
  userFindUnique,
  requestFindUnique,
  dentistFindUnique,
  requestDentistFindFirst,
  getBlob,
  isAdminEmail,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUnique: vi.fn(),
  requestFindUnique: vi.fn(),
  dentistFindUnique: vi.fn(),
  requestDentistFindFirst: vi.fn(),
  getBlob: vi.fn(),
  isAdminEmail: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@vercel/blob", () => ({ get: getBlob }));
vi.mock("@/server/admin", () => ({ isAdminEmail }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: userFindUnique },
    request: { findUnique: requestFindUnique },
    dentist: { findUnique: dentistFindUnique },
    requestDentist: { findFirst: requestDentistFindFirst },
  },
}));

import { GET } from "./route";

const call = (requestId: string, kind: string) =>
  GET(new Request("http://x"), { params: Promise.resolve({ requestId, kind }) });

function streamOf(bytes: number[]) {
  return new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(bytes));
      c.close();
    },
  });
}

describe("GET /api/files/[requestId]/[kind]", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "clerk_1" });
    userFindUnique.mockResolvedValue({ id: "user_1", email: "owner@example.com" });
    requestFindUnique.mockResolvedValue({
      userId: "user_1",
      treatmentFileUrl: "https://blob/treatment",
      xrayFileUrl: "https://blob/xray",
    });
    isAdminEmail.mockReturnValue(false);
    dentistFindUnique.mockResolvedValue(null);
    requestDentistFindFirst.mockResolvedValue(null);
    getBlob.mockResolvedValue({
      statusCode: 200,
      stream: streamOf([1, 2, 3]),
      headers: new Headers(),
      blob: { contentType: "application/pdf" },
    });
  });
  afterEach(() => vi.clearAllMocks());

  it("rejects an unknown kind with 404 before touching auth", async () => {
    const res = await call("req_1", "passport");
    expect(res.status).toBe(404);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns 401 when not signed in", async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await call("req_1", "treatment");
    expect(res.status).toBe(401);
  });

  it("streams the file to the owner with the blob content type", async () => {
    const res = await call("req_1", "treatment");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(getBlob).toHaveBeenCalledWith("https://blob/treatment", { access: "private" });
  });

  it("returns 404 for a signed-in user who is neither owner nor admin", async () => {
    requestFindUnique.mockResolvedValue({
      userId: "someone_else",
      treatmentFileUrl: "https://blob/treatment",
      xrayFileUrl: "https://blob/xray",
    });
    const res = await call("req_1", "treatment");
    expect(res.status).toBe(404);
    expect(getBlob).not.toHaveBeenCalled();
  });

  it("allows an admin who is not the owner", async () => {
    requestFindUnique.mockResolvedValue({
      userId: "someone_else",
      treatmentFileUrl: "https://blob/treatment",
      xrayFileUrl: "https://blob/xray",
    });
    isAdminEmail.mockReturnValue(true);
    const res = await call("req_1", "xray");
    expect(res.status).toBe(200);
    expect(getBlob).toHaveBeenCalledWith("https://blob/xray", { access: "private" });
  });

  describe("a clinic signed in to its own account", () => {
    const notTheOwner = {
      userId: "someone_else",
      treatmentFileUrl: "https://blob/treatment",
      xrayFileUrl: "https://blob/xray",
    };

    beforeEach(() => {
      authMock.mockResolvedValue({ userId: "clerk_clinic" });
      // A clinic account need not have a patient User row at all.
      userFindUnique.mockResolvedValue(null);
      requestFindUnique.mockResolvedValue(notTheOwner);
      dentistFindUnique.mockResolvedValue({ id: "dentist_1" });
    });

    it("gets the files of a request that was actually delivered to it", async () => {
      requestDentistFindFirst.mockResolvedValue({ id: "rd_1" });

      const res = await call("req_1", "xray");

      expect(res.status).toBe(200);
      expect(requestDentistFindFirst).toHaveBeenCalledWith({
        where: { requestId: "req_1", dentistId: "dentist_1", emailSent: true },
        select: { id: true },
      });
    });

    it("gets 404 for a request that was not sent to it", async () => {
      requestDentistFindFirst.mockResolvedValue(null);

      const res = await call("req_1", "xray");

      expect(res.status).toBe(404);
      expect(getBlob).not.toHaveBeenCalled();
    });

    it("gets 401 when the account is neither a patient nor a clinic", async () => {
      dentistFindUnique.mockResolvedValue(null);

      const res = await call("req_1", "xray");

      expect(res.status).toBe(401);
      expect(getBlob).not.toHaveBeenCalled();
    });
  });
});
