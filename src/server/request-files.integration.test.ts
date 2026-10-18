import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type {
  purgeRequestFiles as PurgeFn,
  purgeUserMedicalData as PurgeUserFn,
} from "@/server/request-files";
import type { POST as UploadPost } from "@/app/api/files/upload/route";

const h = vi.hoisted(() => ({
  clerkUserId: { value: "" },
  deleted: [] as string[],
  failFor: new Set<string>(),
  orphans: [] as string[],
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkUserId.value }),
}));
vi.mock("@/i18n/request-locale", () => ({ getRequestLocale: async () => "en" }));
vi.mock("@vercel/blob", () => ({
  list: async ({ prefix }: { prefix: string }) => ({
    blobs: h.orphans.filter((u) => u.includes(prefix)).map((url) => ({ url })),
    hasMore: false,
  }),
  del: async (url: string) => {
    if (h.failFor.has(url)) throw new Error("blob store unavailable");
    h.deleted.push(url);
  },
}));
// The upload route reads the stored file back to check its signature; here every
// stored file is a valid PDF, and any https URL is "ours".
vi.mock("@/lib/blob-head", () => ({
  blobPathnameOf: (url: string) => new URL(url).pathname.slice(1),
  readBlobHead: async () => ({
    head: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    contentType: "application/pdf",
  }),
}));

const hasDb = Boolean(process.env.DATABASE_URL);

let db: typeof Db;
let purgeRequestFiles: typeof PurgeFn;
let purgeUserMedicalData: typeof PurgeUserFn;
let uploadPost: typeof UploadPost;

const createdUsers: string[] = [];
const createdDentists: string[] = [];

async function seed() {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { clerkUserId: `rf_${sfx}`, fullName: "R", email: `rf_${sfx}@example.com` },
  });
  createdUsers.push(user.id);
  h.clerkUserId.value = user.clerkUserId;
  const request = await db.request.create({
    data: {
      userId: user.id,
      treatmentFileUrl: "",
      xrayFileUrl: "",
      patientNotes: "Pain in lower left molar",
    },
  });
  const dir = `https://blob.example.com/requests/${request.id}`;
  await db.request.update({
    where: { id: request.id },
    data: { treatmentFileUrl: `${dir}/treatment-a.pdf`, xrayFileUrl: `${dir}/xray-a.pdf` },
  });
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `rf_dentist_${sfx}@example.com`,
      phone: "0500000000",
      city: "Budapest",
      address: "Street 1",
      experienceYears: 5,
      specialties: [],
      treatments: [],
      insurerAffiliations: [],
    },
  });
  createdDentists.push(dentist.id);
  const rd = await db.requestDentist.create({
    data: { requestId: request.id, dentistId: dentist.id },
  });
  await db.quoteAttachment.create({
    data: {
      requestDentistId: rd.id,
      blobUrl: `${dir}/quote-attachments/${rd.id}/plan.pdf`,
      contentType: "application/pdf",
      sizeBytes: 10,
      originalName: "plan.pdf",
    },
  });
  return { user, requestId: request.id, dir };
}

describe.skipIf(!hasDb)("request file purging", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ purgeRequestFiles, purgeUserMedicalData } = await import("@/server/request-files"));
    ({ POST: uploadPost } = await import("@/app/api/files/upload/route"));
  });

  afterEach(async () => {
    const users = await db.user.findMany({
      where: { id: { in: createdUsers } },
      select: { id: true },
    });
    await db.request.deleteMany({
      where: { requestDentists: { some: { dentistId: { in: createdDentists } } } },
    });
    await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await db.dentist.deleteMany({ where: { id: { in: createdDentists } } });
    createdUsers.length = 0;
    createdDentists.length = 0;
    h.deleted.length = 0;
    h.failFor.clear();
    h.orphans.length = 0;
  });

  it("removes every file of the request but keeps the request", async () => {
    const { requestId, dir } = await seed();
    h.orphans.push(`${dir}/xray-old.pdf`);

    expect(await purgeRequestFiles(requestId)).toBe(4);

    expect(h.deleted).toEqual(
      expect.arrayContaining([
        `${dir}/treatment-a.pdf`,
        `${dir}/xray-a.pdf`,
        `${dir}/xray-old.pdf`,
        expect.stringContaining("/quote-attachments/"),
      ]),
    );
    const row = await db.request.findUnique({ where: { id: requestId } });
    expect(row).toMatchObject({ treatmentFileUrl: "", xrayFileUrl: "" });
    expect(await db.quoteAttachment.count({ where: { requestDentist: { requestId } } })).toBe(0);
  });

  // Files first, rows second: a failed delete must leave the rows pointing at
  // the files so the next attempt finds them again.
  it("leaves the rows intact when the store fails", async () => {
    const { requestId, dir } = await seed();
    h.failFor.add(`${dir}/xray-a.pdf`);

    await expect(purgeRequestFiles(requestId)).rejects.toThrow();

    const row = await db.request.findUnique({ where: { id: requestId } });
    expect(row?.xrayFileUrl).toBe(`${dir}/xray-a.pdf`);
    expect(await db.quoteAttachment.count({ where: { requestDentist: { requestId } } })).toBe(1);
  });

  it("strips a deleted account's requests of files and notes", async () => {
    const { user, requestId } = await seed();

    await purgeUserMedicalData(user.clerkUserId);

    const row = await db.request.findUnique({ where: { id: requestId } });
    expect(row).toMatchObject({ treatmentFileUrl: "", xrayFileUrl: "", patientNotes: null });
    expect(h.deleted.length).toBe(3);
  });

  it("deletes the previous file when the patient replaces it", async () => {
    const { requestId, dir } = await seed();
    const next = `${dir}/xray-b.pdf`;

    const res = await uploadPost(
      new Request("http://localhost/api/files/upload", {
        method: "POST",
        body: JSON.stringify({ requestId, kind: "xray", url: next }),
      }),
    );

    expect(res.status).toBe(200);
    expect(h.deleted).toEqual([`${dir}/xray-a.pdf`]);
    const row = await db.request.findUnique({ where: { id: requestId } });
    expect(row?.xrayFileUrl).toBe(next);
  });
});
