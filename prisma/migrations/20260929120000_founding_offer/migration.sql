-- Founding offer: discounted price for the first 50 paid clinics, 12 months.
ALTER TABLE "ClinicSubscription" ADD COLUMN "isFounding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClinicSubscription" ADD COLUMN "regularPriceMinor" INTEGER;
ALTER TABLE "ClinicSubscription" ADD COLUMN "foundingEndsAt" TIMESTAMP(3);
ALTER TABLE "ClinicSubscription" ADD COLUMN "foundingNoticeSentAt" TIMESTAMP(3);
