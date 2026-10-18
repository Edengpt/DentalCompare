import { describe, expect, it } from "vitest";
import { isOwnBlobHost, isOwnBlobUrl, storeIdFromToken } from "./blob-store";

const ENV = {
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_QuuE38w0pQ1vOutr_secret",
  LOGO_BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_kD5cvfGur7o6xbry_secret",
};

describe("storeIdFromToken", () => {
  it("reads the store id from a read-write token, lower-cased", () => {
    expect(storeIdFromToken(ENV.BLOB_READ_WRITE_TOKEN)).toBe("quue38w0pq1voutr");
    expect(storeIdFromToken(undefined)).toBeNull();
    expect(storeIdFromToken("garbage")).toBeNull();
  });
});

describe("isOwnBlobHost", () => {
  it("accepts only our own store once a token is configured", () => {
    expect(isOwnBlobHost("quue38w0pq1voutr.private.blob.vercel-storage.com", "private", ENV)).toBe(
      true,
    );
    expect(isOwnBlobHost("attacker1234.public.blob.vercel-storage.com", "private", ENV)).toBe(
      false,
    );
  });

  it("keeps the stores apart", () => {
    expect(isOwnBlobHost("kd5cvfgur7o6xbry.public.blob.vercel-storage.com", "public", ENV)).toBe(
      true,
    );
    expect(isOwnBlobHost("kd5cvfgur7o6xbry.public.blob.vercel-storage.com", "private", ENV)).toBe(
      false,
    );
  });

  it("falls back to any Vercel Blob host when no token is set", () => {
    expect(isOwnBlobHost("x.blob.vercel-storage.com", "private", {})).toBe(true);
    expect(isOwnBlobHost("blob.vercel-storage.com.evil.com", "private", {})).toBe(false);
  });
});

describe("isOwnBlobUrl", () => {
  it("requires https and our host", () => {
    const ok = "https://quue38w0pq1voutr.private.blob.vercel-storage.com/clinics/documents/a.pdf";
    expect(isOwnBlobUrl(ok, "private", ENV)).toBe(true);
    expect(isOwnBlobUrl(ok.replace("https", "http"), "private", ENV)).toBe(false);
    expect(isOwnBlobUrl("not a url", "private", ENV)).toBe(false);
  });
});
