import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del: vi.fn(async () => undefined) }));

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;
const DAY = 24 * 60 * 60 * 1000;
const NEW_URL = "https://x.blob.vercel-storage.com/clinics/documents/new.pdf";

let db: typeof Db;
let replaceClinicDocuments: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
let getClinicByDocumentToken: (token: string) => Promise<unknown>;

const created: string[] = [];

async function seedRejected(opts: { expiresInMs?: number } = {}) {
  const sfx = randomUUID().slice(0, 8);
  const token = `dtok_${sfx}`;
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `rep_${sfx}@example.com`,
      phone: "0500000000",
      city: "חיפה",
      address: "רחוב 2",
      experienceYears: 3,
      documentToken: token,
      documentTokenExpiresAt: new Date(Date.now() + (opts.expiresInMs ?? 7 * DAY)),
      documents: {
        create: {
          kind: "Licence",
          blobUrl: `https://x.blob.vercel-storage.com/clinics/documents/old_${sfx}.pdf`,
          contentType: "application/pdf",
          rejectedAt: new Date(),
          rejectionReason: "blurry",
        },
      },
    },
    include: { documents: true },
  });
  created.push(dentist.id);
  return { token, dentistId: dentist.id, docId: dentist.documents[0].id };
}

function replaceForm(token: string, documentId: string, url = NEW_URL): FormData {
  const fd = new FormData();
  fd.append("token", token);
  fd.append("documentId", documentId);
  fd.append("documentUrl", url);
  fd.append("documentType", "application/pdf");
  return fd;
}

describe.skipIf(!hasDb)("replaceClinicDocuments (integration, real DB)", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ replaceClinicDocuments, getClinicByDocumentToken } = await import("./clinic-documents"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.length = 0;
  }, DB_TIMEOUT);

  it(
    "replaces the file and clears the rejection",
    async () => {
      const { token, docId } = await seedRejected();

      const result = await replaceClinicDocuments(replaceForm(token, docId));
      expect(result.ok).toBe(true);

      const doc = await db.clinicDocument.findUnique({ where: { id: docId } });
      expect(doc!.blobUrl).toBe(NEW_URL);
      expect(doc!.rejectedAt).toBeNull();
      expect(doc!.rejectionReason).toBeNull();
    },
    DB_TIMEOUT,
  );

  // The token travels by email and outlives the conversation that produced it.
  it(
    "refuses an expired token, and changes nothing",
    async () => {
      const { token, docId } = await seedRejected({ expiresInMs: -DAY });

      const result = await replaceClinicDocuments(replaceForm(token, docId));
      expect(result.ok).toBe(false);
      expect((await db.clinicDocument.findUnique({ where: { id: docId } }))!.rejectedAt).not.toBeNull();
    },
    DB_TIMEOUT,
  );

  // Holding one clinic's token must not let anyone overwrite another's licence.
  it(
    "refuses a document that belongs to a different clinic",
    async () => {
      const a = await seedRejected();
      const b = await seedRejected();

      const result = await replaceClinicDocuments(replaceForm(a.token, b.docId));
      expect(result.ok).toBe(false);
      expect((await db.clinicDocument.findUnique({ where: { id: b.docId } }))!.blobUrl).not.toBe(
        NEW_URL,
      );
    },
    DB_TIMEOUT,
  );

  it(
    "refuses a url that did not come from our own upload route",
    async () => {
      const { token, docId } = await seedRejected();
      const result = await replaceClinicDocuments(
        replaceForm(token, docId, "https://evil.example.com/x.pdf"),
      );
      expect(result.ok).toBe(false);
    },
    DB_TIMEOUT,
  );

  // The page must not become a read key for private documents: it says which
  // kinds need replacing and why, and carries nothing that could fetch a file.
  it(
    "the page lookup returns kinds and reasons, never a blob url",
    async () => {
      const { token } = await seedRejected();
      const clinic = (await getClinicByDocumentToken(token)) as {
        documents: Record<string, unknown>[];
      };
      expect(clinic.documents[0]).toHaveProperty("kind");
      expect(clinic.documents[0]).toHaveProperty("rejectionReason");
      expect(clinic.documents[0]).not.toHaveProperty("blobUrl");
    },
    DB_TIMEOUT,
  );

  it(
    "the page lookup returns nothing for an expired token",
    async () => {
      const { token } = await seedRejected({ expiresInMs: -DAY });
      expect(await getClinicByDocumentToken(token)).toBeNull();
    },
    DB_TIMEOUT,
  );
});
