-- AlterTable: track when the patient was notified of a new quote so a failed
-- first send can be retried by the daily cron.
ALTER TABLE "Quote" ADD COLUMN "patientNotifiedAt" TIMESTAMP(3);
