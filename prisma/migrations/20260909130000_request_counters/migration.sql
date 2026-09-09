-- Both columns are purely additive with permanent defaults — no existing row
-- needs a value it doesn't already have, and no default is ever dropped (see
-- the schema comment: unrelated test fixtures across the repo create
-- ClinicSubscription rows directly and have no reason to know about either
-- column).
ALTER TABLE "ClinicSubscription" ADD COLUMN "trialRequestCap" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "ClinicSubscription" ADD COLUMN "verifiedRequestCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MonthlyRequestUsage" (
    "dentistId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MonthlyRequestUsage_pkey" PRIMARY KEY ("dentistId", "yearMonth")
);

ALTER TABLE "MonthlyRequestUsage" ADD CONSTRAINT "MonthlyRequestUsage_dentistId_fkey"
  FOREIGN KEY ("dentistId") REFERENCES "Dentist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
