-- Free-patient pivot (PRD 4.1–4.5).
-- The patient flat fee is gone: patients are never charged, and all revenue comes
-- from clinic subscriptions. Clinics also get a 60-day free trial.
--
-- Data-preserving on purpose:
--   * Payment is ARCHIVED, not dropped — those rows are real money that was taken
--     from real people and are needed for accounting, tax and refund disputes.
--     Drop "Payment_archived" manually once it has been exported.
--   * RequestStatus members are remapped in place rather than reset.

-- ── 1. RequestStatus: PENDING/PAID/FAILED -> DRAFT/SUBMITTED/SENT/FAILED ──────
-- PAID meant "paid, and therefore emailed to the clinics" — that is SENT now.
-- PENDING meant "still being assembled" — that is DRAFT.
CREATE TYPE "RequestStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'SENT', 'FAILED');

ALTER TABLE "Request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Request" ALTER COLUMN "status" TYPE "RequestStatus_new"
  USING (
    CASE "status"::text
      WHEN 'PENDING' THEN 'DRAFT'
      WHEN 'PAID'    THEN 'SENT'
      WHEN 'FAILED'  THEN 'FAILED'
    END
  )::"RequestStatus_new";
ALTER TABLE "Request" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "RequestStatus";
ALTER TYPE "RequestStatus_new" RENAME TO "RequestStatus";

-- Backfill sentAt for requests that were already delivered, so the new column
-- isn't uniformly null for all historical rows.
ALTER TABLE "Request" ADD COLUMN "sentAt" TIMESTAMP(3);
UPDATE "Request" SET "sentAt" = "updatedAt" WHERE "status" = 'SENT';

-- ── 2. Archive the patient Payment table ─────────────────────────────────────
-- Detach the FKs first so archived rows survive future deletes of users/requests.
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_userId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_requestId_fkey";
ALTER TABLE "Payment" RENAME TO "Payment_archived";

-- ── 3. User: verified phone as the qualification gate (PRD 4.2) ──────────────
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- phone becomes UNIQUE. Existing rows may hold duplicates or blanks (it was never
-- verified before), so make duplicates unique-but-obviously-invalid instead of
-- letting the index creation fail and abort the whole migration. These users are
-- forced through phone verification on their next request either way, since
-- phoneVerifiedAt is null for every pre-existing row.
UPDATE "User" u
SET "phone" = u."phone" || '#dup-' || u."id"
WHERE EXISTS (
  SELECT 1 FROM "User" o
  WHERE o."phone" = u."phone" AND o."id" <> u."id" AND o."createdAt" < u."createdAt"
);
UPDATE "User" SET "phone" = '#missing-' || "id" WHERE "phone" IS NULL OR btrim("phone") = '';

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- ── 4. Clinic free trial (PRD 4.4) ───────────────────────────────────────────
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING' BEFORE 'ACTIVE';

ALTER TABLE "Dentist" ADD COLUMN "approvedAt" TIMESTAMP(3);
-- Clinics already live in the directory were approved at some point in the past;
-- their subscription is already ACTIVE/PAST_DUE so they are NOT retro-granted a
-- trial. This only backfills the audit field.
UPDATE "Dentist" SET "approvedAt" = "updatedAt" WHERE "isActive" = true;

ALTER TABLE "ClinicSubscription" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "ClinicSubscription" ADD COLUMN "trialWarningSentDays" INTEGER;
CREATE INDEX "ClinicSubscription_trialEndsAt_idx" ON "ClinicSubscription"("trialEndsAt");

-- ── 5. Invalid-lead reporting (PRD 4.5) ──────────────────────────────────────
ALTER TABLE "RequestDentist" ADD COLUMN "disputedAt" TIMESTAMP(3);
ALTER TABLE "RequestDentist" ADD COLUMN "disputeReason" TEXT;
CREATE INDEX "RequestDentist_dentistId_sentAt_idx" ON "RequestDentist"("dentistId", "sentAt");
