-- prisma/migrations/20260902120000_quote_status/migration.sql
-- Every existing Quote row is an unresolved reply from before this lifecycle
-- existed, so PENDING_DECISION is the only honest default: a decision has
-- not been made yet, not "approved" and not "rejected".
CREATE TYPE "QuoteStatus" AS ENUM (
  'PENDING_DECISION',
  'APPROVED',
  'REJECTED',
  'IN_TREATMENT',
  'COMPLETION_REQUESTED',
  'COMPLETED'
);

ALTER TABLE "Quote" ADD COLUMN "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING_DECISION';
ALTER TABLE "Quote" ADD COLUMN "decidedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "rejectedAuto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quote" ADD COLUMN "treatmentStartedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "completionRequestedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "decisionNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "treatmentStartedNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "completionRequestedNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "completedNotifiedAt" TIMESTAMP(3);

CREATE INDEX "Quote_status_idx" ON "Quote"("status");
