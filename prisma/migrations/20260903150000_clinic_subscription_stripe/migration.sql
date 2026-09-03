-- prisma/migrations/20260903150000_clinic_subscription_stripe/migration.sql
-- Every existing row is a PayPlus subscription (Stripe support didn't exist
-- before this migration) — backfilled via the DEFAULT below. Unlike
-- priceMinor/currency/trialDays's migrations, the DEFAULT is kept (not
-- dropped) — see the matching comment on the schema field in Step 4 for why.
ALTER TABLE "ClinicSubscription" ADD COLUMN "provider" "SubscriptionProvider" NOT NULL DEFAULT 'PAYPLUS';

ALTER TABLE "ClinicSubscription" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "ClinicSubscription" ADD COLUMN "stripeSubscriptionId" TEXT;
CREATE UNIQUE INDEX "ClinicSubscription_stripeSubscriptionId_key" ON "ClinicSubscription"("stripeSubscriptionId");

ALTER TABLE "SubscriptionCharge" ADD COLUMN "stripeInvoiceId" TEXT;
CREATE UNIQUE INDEX "SubscriptionCharge_stripeInvoiceId_key" ON "SubscriptionCharge"("stripeInvoiceId");
