-- Money migration M2: backfill minor units from the whole-shekel columns.
--
-- The multiplier is 100 because these columns hold WHOLE SHEKELS, and that was
-- verified rather than assumed: src/lib/payplus.ts sends `amount: args.amountILS`
-- straight to the provider alongside `currency_code: "ILS"`, and the plan
-- constants are 299 and 1990. Getting this wrong is a 100x error on a live
-- customer charge, which is why it is stated here rather than left implicit.
--
-- WHERE ... IS NULL makes this idempotent: re-running cannot double-multiply an
-- already-converted row.
UPDATE "Quote"
   SET "amountMinor" = "amountILS" * 100,
       "currency"    = 'ILS'
 WHERE "amountMinor" IS NULL;

UPDATE "ClinicSubscription"
   SET "priceMinor" = "priceILS" * 100,
       "currency"   = 'ILS'
 WHERE "priceMinor" IS NULL;

UPDATE "SubscriptionCharge"
   SET "amountMinor" = "amountILS" * 100,
       "currency"    = 'ILS'
 WHERE "amountMinor" IS NULL;
