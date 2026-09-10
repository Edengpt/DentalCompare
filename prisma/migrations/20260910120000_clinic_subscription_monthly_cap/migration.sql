-- Purely additive, nullable, no default, no backfill needed — every existing
-- row (real or test-fixture) simply reads null, meaning "no known cap",
-- which every check this plan adds already treats identically to
-- "unlimited". See the schema comment for why this field needs no @default,
-- unlike trialRequestCap in the previous migration.
ALTER TABLE "ClinicSubscription" ADD COLUMN "monthlyRequestCap" INTEGER;
