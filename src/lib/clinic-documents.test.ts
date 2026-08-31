import { describe, it, expect } from "vitest";
import {
  GENERIC_DOC_KIND,
  requiredDocKinds,
  missingDocKinds,
  validateClinicDocument,
  clinicDocumentBlobPath,
  isClinicDocumentBlobUrl,
  DOC_MAX_FILE_SIZE_BYTES,
  documentTokenExpiry,
  isDocumentTokenLive,
  isClinicDocumentBlobPath,
} from "./clinic-documents";

function fileOf(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("requiredDocKinds", () => {
  it("uses the country's own list when it has one", () => {
    expect(requiredDocKinds(["Licence", "Insurance"])).toEqual(["Licence", "Insurance"]);
  });

  // "Mandatory" has to be true in a country nobody has finished configuring. A
  // country with no documents listed must not quietly become a country with no
  // check.
  it("falls back to one generic licence when the country lists none", () => {
    expect(requiredDocKinds([])).toEqual([GENERIC_DOC_KIND]);
  });

  it("drops blanks and duplicates an admin may have typed", () => {
    expect(requiredDocKinds(["Licence", " ", "Licence", "Insurance"])).toEqual([
      "Licence",
      "Insurance",
    ]);
  });
});

describe("missingDocKinds", () => {
  it("is empty when every required kind was provided", () => {
    expect(missingDocKinds(["Licence", "Insurance"], ["Insurance", "Licence"])).toEqual([]);
  });

  it("names exactly what is missing, in the order asked for", () => {
    expect(missingDocKinds(["Licence", "Insurance"], ["Insurance"])).toEqual(["Licence"]);
  });

  // Extra uploads are not a reason to refuse a registration, but they are also
  // not a substitute for the one that is missing.
  it("ignores kinds nobody asked for", () => {
    expect(missingDocKinds(["Licence"], ["Passport"])).toEqual(["Licence"]);
  });
});

describe("validateClinicDocument", () => {
  it("accepts a phone photo, which is the main path and not a concession", () => {
    expect(validateClinicDocument(fileOf("licence.jpg", "image/jpeg", 1000))).toBeNull();
    expect(validateClinicDocument(fileOf("licence.png", "image/png", 1000))).toBeNull();
  });

  it("accepts a scanned pdf", () => {
    expect(validateClinicDocument(fileOf("licence.pdf", "application/pdf", 1000))).toBeNull();
  });

  it("rejects a type we cannot display to an admin", () => {
    expect(validateClinicDocument(fileOf("licence.docx", "application/msword", 1000))).toBe("TYPE");
  });

  it("rejects a file the platform would refuse at the edge anyway", () => {
    expect(
      validateClinicDocument(fileOf("licence.pdf", "application/pdf", DOC_MAX_FILE_SIZE_BYTES + 1)),
    ).toBe("SIZE");
  });
});

describe("clinicDocumentBlobPath", () => {
  it("puts documents under their own prefix, with the right extension", () => {
    const path = clinicDocumentBlobPath(fileOf("scan.jpeg", "image/jpeg", 10));
    expect(path).toMatch(/^clinics\/documents\/[0-9a-f-]{36}\.jpg$/);
  });

  // Two clinics uploading "licence.pdf" must not land on the same object.
  it("never returns the same path twice", () => {
    const a = clinicDocumentBlobPath(fileOf("licence.pdf", "application/pdf", 10));
    const b = clinicDocumentBlobPath(fileOf("licence.pdf", "application/pdf", 10));
    expect(a).not.toBe(b);
  });
});

describe("isClinicDocumentBlobUrl", () => {
  it("accepts a url our own upload route produced", () => {
    expect(
      isClinicDocumentBlobUrl(
        "https://abc123.public.blob.vercel-storage.com/clinics/documents/x.pdf",
      ),
    ).toBe(true);
  });

  // The registration form submits URLs as plain strings. Without this, a clinic
  // could name any file on the internet as its licence, or point at another
  // clinic's private medical file.
  it("rejects a url from anywhere else, and one from another prefix", () => {
    expect(isClinicDocumentBlobUrl("https://evil.example.com/clinics/documents/x.pdf")).toBe(false);
    expect(
      isClinicDocumentBlobUrl("https://abc.public.blob.vercel-storage.com/requests/r1/xray.jpg"),
    ).toBe(false);
  });
});

describe("the replacement-document token", () => {
  const now = new Date("2026-09-01T00:00:00Z");

  it("expires DOCUMENT_TOKEN_DAYS after it is issued", () => {
    expect(documentTokenExpiry(now).toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("is live right up to the moment it expires, and not after", () => {
    const expires = documentTokenExpiry(now);
    expect(isDocumentTokenLive(expires, new Date("2026-09-14T23:59:59Z"))).toBe(true);
    expect(isDocumentTokenLive(expires, new Date("2026-09-15T00:00:01Z"))).toBe(false);
  });

  // A clinic with no token at all must not read as one with a live token just
  // because null compares loosely somewhere downstream.
  it("is not live when there is no expiry, meaning no token was ever issued", () => {
    expect(isDocumentTokenLive(null, now)).toBe(false);
  });
});

describe("isClinicDocumentBlobPath", () => {
  // The browser names the file it uploads and this route is unauthenticated:
  // the registration form is public and the clinic row does not exist yet. This
  // rule is the only thing between a stranger and a chosen write path into the
  // private store that also holds patients' x-rays.
  it("accepts a plain name in the documents folder", () => {
    expect(isClinicDocumentBlobPath("clinics/documents/abc-123.pdf")).toBe(true);
  });

  it("rejects any other folder", () => {
    expect(isClinicDocumentBlobPath("requests/req_1/xray.jpg")).toBe(false);
    expect(isClinicDocumentBlobPath("clinics/logos/a.png")).toBe(false);
  });

  it("rejects a name that climbs out of the folder", () => {
    expect(isClinicDocumentBlobPath("clinics/documents/../../requests/x.jpg")).toBe(false);
    expect(isClinicDocumentBlobPath("clinics/documents/sub/a.pdf")).toBe(false);
  });

  it("rejects the bare folder with no name", () => {
    expect(isClinicDocumentBlobPath("clinics/documents/")).toBe(false);
  });
});

describe("isClinicDocumentBlobUrl", () => {
  it("accepts a url from our own store", () => {
    expect(isClinicDocumentBlobUrl("https://x.blob.vercel-storage.com/clinics/documents/a.pdf")).toBe(
      true,
    );
  });

  // The dots have to be literal. Written as a template literal they were not,
  // and a lookalike host would have passed a check that guards a delete.
  it("rejects a lookalike host", () => {
    expect(isClinicDocumentBlobUrl("https://xblobyvercel-storagezcom/clinics/documents/a.pdf")).toBe(
      false,
    );
  });

  it("rejects our store outside the documents folder", () => {
    expect(isClinicDocumentBlobUrl("https://x.blob.vercel-storage.com/requests/r1/xray.jpg")).toBe(
      false,
    );
  });
});
