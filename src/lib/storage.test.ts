import { describe, it, expect } from "vitest";
import { fileSignatureMatches } from "./storage";

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
