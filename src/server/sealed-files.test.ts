import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { isEncryptedFile } from "@/lib/file-crypto";
import { readPrivateFile, sealUploadedFile } from "./sealed-files";

// An in-memory private store: url -> { bytes, contentType }.
const h = vi.hoisted(() => ({
  store: new Map<string, { bytes: Buffer; contentType: string }>(),
  deleted: [] as string[],
}));

vi.mock("@vercel/blob", () => ({
  get: async (url: string) => {
    const f = h.store.get(url);
    if (!f) return null;
    return {
      statusCode: 200,
      stream: new Response(new Uint8Array(f.bytes)).body,
      blob: { contentType: f.contentType },
    };
  },
  put: async (pathname: string, body: Buffer, opts: { contentType: string }) => {
    const url = `https://blob.example.com/${pathname.replace(/(\.\w+)$/, "-sealed$1")}`;
    h.store.set(url, { bytes: Buffer.from(body), contentType: opts.contentType });
    return { url };
  },
  del: async (url: string) => {
    h.deleted.push(url);
    h.store.delete(url);
  },
}));

const PATH = "requests/r1/xray-abc.png";
const URL_PLAIN = `https://blob.example.com/${PATH}`;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from("x-ray pixels")]);

describe("sealUploadedFile", () => {
  beforeEach(() => {
    h.store.clear();
    h.deleted.length = 0;
    h.store.set(URL_PLAIN, { bytes: PNG, contentType: "image/png" });
  });
  afterEach(() => {
    delete process.env.FILE_ENCRYPTION_KEY;
  });

  it("replaces the upload with an encrypted copy and deletes the plaintext", async () => {
    process.env.FILE_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    const sealedUrl = await sealUploadedFile(URL_PLAIN, PATH, "image/png");

    expect(sealedUrl).not.toBe(URL_PLAIN);
    expect(h.deleted).toEqual([URL_PLAIN]);
    const stored = h.store.get(sealedUrl)!;
    expect(isEncryptedFile(stored.bytes)).toBe(true);
    expect(stored.contentType).toBe("image/png");

    // And the app reads it back as the original file.
    const read = await readPrivateFile(sealedUrl);
    expect(read?.data.equals(PNG)).toBe(true);
    expect(read?.contentType).toBe("image/png");
  });

  it("leaves the file as it is when no key is configured", async () => {
    expect(await sealUploadedFile(URL_PLAIN, PATH, "image/png")).toBe(URL_PLAIN);
    expect(h.deleted).toEqual([]);
    expect((await readPrivateFile(URL_PLAIN))?.data.equals(PNG)).toBe(true);
  });
});
