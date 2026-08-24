import { describe, it, expect } from "vitest";
import { fileSignatureMatches, LOGO_MAX_FILE_SIZE_MB } from "./storage";

function file(bytes: number[], type: string, name = "f"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]; // %PDF-1
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const EXE = [0x4d, 0x5a, 0x90, 0x00]; // "MZ" — Windows executable

describe("fileSignatureMatches", () => {
  it("accepts real files whose bytes match the declared type", async () => {
    expect(await fileSignatureMatches(file(PDF, "application/pdf"))).toBe(true);
    expect(await fileSignatureMatches(file(PNG, "image/png"))).toBe(true);
    expect(await fileSignatureMatches(file(JPEG, "image/jpeg"))).toBe(true);
  });

  it("rejects a spoofed executable renamed to a PDF", async () => {
    expect(await fileSignatureMatches(file(EXE, "application/pdf", "malware.pdf"))).toBe(false);
  });

  it("rejects a type/content mismatch (PNG bytes declared as PDF)", async () => {
    expect(await fileSignatureMatches(file(PNG, "application/pdf"))).toBe(false);
  });

  it("rejects an unsupported declared type", async () => {
    expect(await fileSignatureMatches(file(PDF, "application/zip"))).toBe(false);
  });
});

describe("the logo limit against the platform's own", () => {
  // Vercel rejects a request body over roughly 4.5MB at the edge, before any
  // route code runs, and answers with plain text rather than JSON. Measured
  // against production: 4MB uploads, 4.4MB returns 413.
  //
  // If our advertised limit is the larger of the two, we invite clinics to
  // upload a file we have promised to accept and the platform silently
  // refuses — and a phone camera photo lands squarely in that gap.
  const VERCEL_REQUEST_BODY_LIMIT_MB = 4.5;

  it("stays under the request body limit the platform enforces", () => {
    expect(LOGO_MAX_FILE_SIZE_MB).toBeLessThan(VERCEL_REQUEST_BODY_LIMIT_MB);
  });

  // The multipart envelope adds boundaries and headers around the bytes, so
  // the request is always somewhat larger than the file.
  it("leaves room for the multipart overhead", () => {
    expect(VERCEL_REQUEST_BODY_LIMIT_MB - LOGO_MAX_FILE_SIZE_MB).toBeGreaterThanOrEqual(0.4);
  });
});
