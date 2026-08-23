-- How far the patient will travel, and whether they consented explicitly.
--
-- Every column is optional or defaulted, so each existing row stays valid the
-- moment the columns exist. LOCAL is the safe default: a request created before
-- this change never asked to travel anywhere.
CREATE TYPE "TravelScope" AS ENUM ('LOCAL', 'SELECTED', 'ANY');

ALTER TABLE "Request"
  ADD COLUMN "travelScope" "TravelScope" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "destinationCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "consentAt" TIMESTAMP(3),
  ADD COLUMN "consentVersion" TEXT;
