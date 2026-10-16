-- Pricing reset (2026-10-16): Basic and Pro are both sold, monthly or yearly,
-- and a year costs ten months (two months free). The free trial on a paid
-- plan is a plain 30 days from approval, no longer cut short after a number
-- of delivered requests.
--
-- Only the prices and the trial length are set here. Request caps stay as
-- they are in each row, and so do subscriptions that already exist: every
-- ClinicSubscription keeps the price and trial it was created with.

UPDATE "SubscriptionPricing" SET "trialDays" = 30, "updatedBy" = 'migration:2026-10-16-pricing';

UPDATE "SubscriptionPricing" AS sp
SET "monthlyPriceMinor" = v.monthly, "yearlyPriceMinor" = v.yearly
FROM (VALUES
  ('PAYPLUS'::"SubscriptionProvider", 'BASIC'::"SubscriptionTier", 29900, 299000),
  ('PAYPLUS'::"SubscriptionProvider", 'PRO'::"SubscriptionTier", 44900, 449000),
  ('PAYPLUS'::"SubscriptionProvider", 'FEATURED'::"SubscriptionTier", 89900, 899000),
  ('STRIPE'::"SubscriptionProvider", 'BASIC'::"SubscriptionTier", 7900, 79000),
  ('STRIPE'::"SubscriptionProvider", 'PRO'::"SubscriptionTier", 17900, 179000),
  ('STRIPE'::"SubscriptionProvider", 'FEATURED'::"SubscriptionTier", 35900, 359000)
) AS v(provider, tier, monthly, yearly)
WHERE sp."provider" = v.provider AND sp."tier" = v.tier;
