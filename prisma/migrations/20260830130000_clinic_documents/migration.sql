-- Licence documents, and the stamp that says an admin looked at them.
--
-- licenceVerifiedAt is separate from approvedAt on purpose: approvedAt also
-- starts the 60-day trial clock, and a licence check is not a billing event.
ALTER TABLE "Dentist" ADD COLUMN "licenceVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Dentist" ADD COLUMN "licenceVerifiedBy" TEXT;
ALTER TABLE "Dentist" ADD COLUMN "documentToken" TEXT;
ALTER TABLE "Dentist" ADD COLUMN "documentTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Dentist_documentToken_key" ON "Dentist"("documentToken");

CREATE TABLE "ClinicDocument" (
    "id" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "ClinicDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicDocument_dentistId_kind_key" ON "ClinicDocument"("dentistId", "kind");
CREATE INDEX "ClinicDocument_dentistId_idx" ON "ClinicDocument"("dentistId");

-- Cascade because rejectClinic deletes the clinic outright, and a document row
-- pointing at a private file with no owner is exactly what must not survive.
ALTER TABLE "ClinicDocument" ADD CONSTRAINT "ClinicDocument_dentistId_fkey"
    FOREIGN KEY ("dentistId") REFERENCES "Dentist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
