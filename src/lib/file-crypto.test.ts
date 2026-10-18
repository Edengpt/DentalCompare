import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptFile, encryptFile, fileEncryptionKey, isEncryptedFile } from "./file-crypto";

const key = randomBytes(32);
const xray = Buffer.from("%PDF-1.7 pretend this is a panoramic x-ray");

describe("file encryption", () => {
  it("round-trips a file", () => {
    const sealed = encryptFile(xray, key);
    expect(isEncryptedFile(sealed)).toBe(true);
    expect(decryptFile(sealed, key).equals(xray)).toBe(true);
  });

  it("stores no readable trace of the content", () => {
    const sealed = encryptFile(xray, key);
    expect(sealed.includes(Buffer.from("x-ray"))).toBe(false);
    expect(sealed.includes(Buffer.from("%PDF"))).toBe(false);
  });

  it("uses a fresh IV every time", () => {
    expect(encryptFile(xray, key).equals(encryptFile(xray, key))).toBe(false);
  });

  // Files stored before encryption existed stay readable until retention
  // removes them — no backfill needed.
  it("passes a pre-encryption file through unchanged", () => {
    expect(isEncryptedFile(xray)).toBe(false);
    expect(decryptFile(xray, key).equals(xray)).toBe(true);
    expect(decryptFile(xray, null).equals(xray)).toBe(true);
  });

  it("refuses a tampered file instead of returning altered bytes", () => {
    const sealed = encryptFile(xray, key);
    sealed[sealed.length - 1] ^= 0xff;
    expect(() => decryptFile(sealed, key)).toThrow();
  });

  it("refuses the wrong key", () => {
    expect(() => decryptFile(encryptFile(xray, key), randomBytes(32))).toThrow();
  });

  it("refuses an encrypted file when no key is configured", () => {
    expect(() => decryptFile(encryptFile(xray, key), null)).toThrow(/FILE_ENCRYPTION_KEY/);
  });
});

describe("fileEncryptionKey", () => {
  it("is null when unset, so dev and CI store files as they are", () => {
    expect(fileEncryptionKey(undefined)).toBeNull();
    expect(fileEncryptionKey("  ")).toBeNull();
  });

  // A malformed key must not quietly fall back to storing plaintext.
  it("throws on a key of the wrong length", () => {
    expect(() => fileEncryptionKey(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });

  it("decodes a valid base64 key", () => {
    expect(fileEncryptionKey(key.toString("base64"))?.equals(key)).toBe(true);
  });
});
