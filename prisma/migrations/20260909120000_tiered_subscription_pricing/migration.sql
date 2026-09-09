-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'BASIC', 'PRO', 'FEATURED');

-- The two rows that exist today become BASIC — the one paid plan that
-- existed before tiers did (same reasoning as `provider DEFAULT 'PAYPLUS'`
-- already on this table). Values are backfilled in place, not reset to the
-- original seed, so any price an admin already edited via
-- /admin/subscriptions survives this migration untouched.
ALTER TABLE "SubscriptionPricing" ADD COLUMN "tier" "SubscriptionTier" NOT NULL DEFAULT 'BASIC';
ALTER TABLE "SubscriptionPricing" ADD COLUMN "monthlyRequestCap" INTEGER;
ALTER TABLE "SubscriptionPricing" ADD COLUMN "trialRequestCap" INTEGER NOT NULL DEFAULT 5;
-- BASIC's real monthly request cap, per the design spec's tier table.
UPDATE "SubscriptionPricing" SET "monthlyRequestCap" = 10;
ALTER TABLE "SubscriptionPricing" ALTER COLUMN "tier" DROP DEFAULT;
ALTER TABLE "SubscriptionPricing" ALTER COLUMN "trialRequestCap" DROP DEFAULT;

-- Rebuild the primary key around (provider, tier) now that a provider can
-- have more than one row. The original constraint name comes from Prisma's
-- own naming convention for a single-column @id.
ALTER TABLE "SubscriptionPricing" DROP CONSTRAINT "SubscriptionPricing_pkey";
ALTER TABLE "SubscriptionPricing" ADD CONSTRAINT "SubscriptionPricing_pkey" PRIMARY KEY ("provider", "tier");

-- Seed the six new tier rows per provider, copying each provider's real
-- currency and trialDays off its own BASIC row rather than hardcoding them —
-- so a price an admin already changed on BASIC is reflected in nothing here
-- (FREE/PRO/FEATURED are new rows with their own placeholder prices; only
-- currency/trialDays are inherited). FREE is priced 0/0 in both currencies —
-- locked there going forward by parsePricingInput (Task 2). PRO/FEATURED,
-- and every STRIPE row (STRIPE is still "ready but unused" per the
-- 2026-09-03 migration), are placeholder starting points — editable at
-- /admin/subscriptions like every other row.
INSERT INTO "SubscriptionPricing"
  ("provider", "tier", "currency", "monthlyPriceMinor", "yearlyPriceMinor", "monthlyRequestCap", "trialDays", "trialRequestCap", "updatedAt")
SELECT new_rows.provider, new_rows.tier, basic."currency", new_rows."monthlyPriceMinor", new_rows."yearlyPriceMinor", new_rows."monthlyRequestCap", basic."trialDays", 5, now()
FROM (
  SELECT 'PAYPLUS'::"SubscriptionProvider" AS provider, 'FREE'::"SubscriptionTier" AS tier, 0 AS "monthlyPriceMinor", 0 AS "yearlyPriceMinor", 3 AS "monthlyRequestCap"
  UNION ALL SELECT 'PAYPLUS', 'PRO', 44900, 449000, 30
  UNION ALL SELECT 'PAYPLUS', 'FEATURED', 89900, 899000, NULL
  UNION ALL SELECT 'STRIPE', 'FREE', 0, 0, 3
  UNION ALL SELECT 'STRIPE', 'PRO', 17900, 149000, 30
  UNION ALL SELECT 'STRIPE', 'FEATURED', 35900, 299000, NULL
) new_rows
JOIN "SubscriptionPricing" basic ON basic."provider" = new_rows.provider AND basic."tier" = 'BASIC';

-- ClinicSubscription gains a tier column, defaulted to BASIC for the same
-- reason as SubscriptionPricing above. Unlike `tier` on SubscriptionPricing,
-- this default is NOT dropped: not every write path is updated to set it
-- explicitly by this plan (only the two Task 3 touches), matching how
-- `provider DEFAULT 'PAYPLUS'` was deliberately left permanent on this same
-- model for the identical reason.
ALTER TABLE "ClinicSubscription" ADD COLUMN "tier" "SubscriptionTier" NOT NULL DEFAULT 'BASIC';
