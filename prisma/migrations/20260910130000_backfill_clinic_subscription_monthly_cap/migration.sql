-- Backfills existing ClinicSubscription rows' monthlyRequestCap from the
-- current SubscriptionPricing row for their own (provider, tier) — closing
-- the gap the previous migration left. Without this, a clinic created
-- before this migration ran would have monthlyRequestCap permanently null
-- (read as unlimited everywhere), since no application code path can ever
-- set it after row creation — every write of this field happens only when
-- the row is first created (registration, or the admin manual-add path).
-- The IS NULL guard keeps this safe to think about even if it were ever
-- re-run: it only ever fills a genuinely-unset value, never overwrites one.
UPDATE "ClinicSubscription" cs
SET "monthlyRequestCap" = sp."monthlyRequestCap"
FROM "SubscriptionPricing" sp
WHERE sp."provider" = cs."provider"
  AND sp."tier" = cs."tier"
  AND cs."monthlyRequestCap" IS NULL;
