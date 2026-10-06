import { describe, it, expect } from "vitest";
import {
  isQuoteAttachmentBlobPath,
  quoteAttachmentBlobPath,
  quoteAttachmentDir,
  sanitizeAttachmentName,
  validateQuoteAttachment,
  QUOTE_ATTACHMENT_MAX_BYTES,
} from "./quote-attachments";

const REQ = "req-1";
const RD = "rd-1";
const dir = quoteAttachmentDir(REQ, RD);

describe("isQuoteAttachmentBlobPath", () => {
  it("accepts the paths quoteAttachmentBlobPath produces, with or without the store's suffix", () => {
    const p = quoteAttachmentBlobPath(REQ, RD, { type: "application/pdf" });
    expect(isQuoteAttachmentBlobPath(p, REQ, RD)).toBe(true);
    expect(isQuoteAttachmentBlobPath(p.replace(".pdf", "-Xy7Kq2.pdf"), REQ, RD)).toBe(true);
  });

  it("rejects traversal, nesting, other folders and other request files", () => {
    for (const p of [
      `${dir}../other.pdf`,
      `${dir}a/b.pdf`,
      `${dir}`,
      `${dir}x.exe`,
      `${quoteAttachmentDir(REQ, "rd-2")}abc.pdf`,
      `${quoteAttachmentDir("req-2", RD)}abc.pdf`,
      `requests/${REQ}/treatment-abc.pdf`,
    ]) {
      expect(isQuoteAttachmentBlobPath(p, REQ, RD)).toBe(false);
    }
  });
});

describe("validateQuoteAttachment", () => {
  it("accepts PDF/JPG/PNG up to 10MB", () => {
    expect(
      validateQuoteAttachment({ type: "application/pdf", size: QUOTE_ATTACHMENT_MAX_BYTES }),
    ).toBeNull();
    expect(validateQuoteAttachment({ type: "image/png", size: 1 })).toBeNull();
  });
  it("rejects other types and oversize files", () => {
    expect(validateQuoteAttachment({ type: "image/gif", size: 1 })).toBe("TYPE");
    expect(
      validateQuoteAttachment({ type: "image/jpeg", size: QUOTE_ATTACHMENT_MAX_BYTES + 1 }),
    ).toBe("SIZE");
  });
});

describe("sanitizeAttachmentName", () => {
  it("strips paths, control characters and quotes", () => {
    expect(sanitizeAttachmentName("C:\\fakepath\\תוכנית טיפול.pdf")).toBe("תוכנית טיפול.pdf");
    expect(sanitizeAttachmentName('a"b\u0000c.pdf')).toBe("abc.pdf");
    expect(sanitizeAttachmentName("   ")).toBe("document");
  });
  it("caps the length but keeps the extension", () => {
    const out = sanitizeAttachmentName(`${"x".repeat(300)}.pdf`);
    expect(out.length).toBe(120);
    expect(out.endsWith(".pdf")).toBe(true);
  });
});
