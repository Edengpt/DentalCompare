-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('PAYPLUS', 'STRIPE');

-- CreateTable
CREATE TABLE "SubscriptionPricing" (
    "provider" "SubscriptionProvider" NOT NULL,
    "currency" TEXT NOT NULL,
    "monthlyPriceMinor" INTEGER NOT NULL,
    "yearlyPriceMinor" INTEGER NOT NULL,
    "trialDays" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SubscriptionPricing_pkey" PRIMARY KEY ("provider")
);

-- Seed values. PAYPLUS matches today's live SUBSCRIPTION_PLANS/TRIAL_DAYS
-- exactly — nothing changes for an existing or new Israeli clinic the moment
-- this migration runs. STRIPE is a placeholder default, unused until the
-- Stripe integration exists.
INSERT INTO "SubscriptionPricing" ("provider", "currency", "monthlyPriceMinor", "yearlyPriceMinor", "trialDays", "updatedAt")
VALUES
  ('PAYPLUS', 'ILS', 29900, 199000, 60, now()),
  ('STRIPE', 'USD', 7900, 53000, 60, now());
