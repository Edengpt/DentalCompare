-- A patient may live in any country, not only one where clinics operate, and
-- no longer starts out in Israel. Existing values are kept as they are.
ALTER TABLE "User" DROP CONSTRAINT "User_countryCode_fkey";
ALTER TABLE "User" ALTER COLUMN "countryCode" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "countryCode" DROP DEFAULT;
