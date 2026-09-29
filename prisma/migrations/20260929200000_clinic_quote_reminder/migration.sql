-- One reminder to a clinic that has not quoted a day after the request.
ALTER TABLE "RequestDentist" ADD COLUMN "clinicReminderSentAt" TIMESTAMP(3);
