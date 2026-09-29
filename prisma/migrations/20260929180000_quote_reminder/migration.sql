-- Patient reminder for quotes they have not opened.
ALTER TABLE "Request" ADD COLUMN "patientViewedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "patientReminderSentAt" TIMESTAMP(3);
