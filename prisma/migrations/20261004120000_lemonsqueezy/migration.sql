-- Lemon Squeezy as a third billing provider (international clinics).
ALTER TYPE "SubscriptionProvider" ADD VALUE 'LEMONSQUEEZY';
ALTER TABLE "ClinicSubscription" ADD COLUMN "lemonSqueezySubscriptionId" TEXT;
ALTER TABLE "ClinicSubscription" ADD COLUMN "lemonSqueezyCustomerId" TEXT;
CREATE UNIQUE INDEX "ClinicSubscription_lemonSqueezySubscriptionId_key" ON "ClinicSubscription"("lemonSqueezySubscriptionId");
ALTER TABLE "SubscriptionCharge" ADD COLUMN "lemonSqueezyInvoiceId" TEXT;
CREATE UNIQUE INDEX "SubscriptionCharge_lemonSqueezyInvoiceId_key" ON "SubscriptionCharge"("lemonSqueezyInvoiceId");
