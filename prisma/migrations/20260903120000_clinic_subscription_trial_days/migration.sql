-- The trial length in effect when this clinic registered, frozen the same way
-- priceMinor/currency already are. Without this, approving a clinic reads
-- whatever SubscriptionPricing.trialDays says at approval time, which can
-- differ from what the clinic actually saw and agreed to at registration.
--
-- Backfilled to 60 (today's live value) for any existing row, then the
-- default is dropped: every future INSERT must supply it explicitly, exactly
-- like priceMinor/currency.
ALTER TABLE "ClinicSubscription" ADD COLUMN "trialDays" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "ClinicSubscription" ALTER COLUMN "trialDays" DROP DEFAULT;
