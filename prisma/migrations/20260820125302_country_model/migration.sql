-- Country becomes a row, not a hardcoded list. Everything that used to be an
-- Israeli constant — currency, calling code, the payer list — hangs off here.
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "callingCode" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "insurers" TEXT[],
    "requiredDocs" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "Country_isActive_idx" ON "Country"("isActive");

-- Israel must exist BEFORE the foreign keys are added.
--
-- Every existing User and Dentist row gets countryCode = 'IL' from the column
-- default, so adding the constraint against an empty Country table fails
-- outright on any database that already has clinics in it. The seed script also
-- upserts this row; both paths are idempotent, and the migration cannot depend
-- on the seed having been run.
INSERT INTO "Country" ("code", "nameEn", "currency", "callingCode", "defaultLocale", "insurers", "requiredDocs", "isActive", "createdAt", "updatedAt")
VALUES (
    'IL',
    'Israel',
    'ILS',
    '972',
    'he',
    ARRAY['Clalit', 'Maccabi', 'Meuhedet', 'Leumit'],
    ARRAY['dental_licence', 'business_registration'],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

-- AlterTable
ALTER TABLE "Dentist" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'IL',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'he',
ADD COLUMN     "spokenLanguages" TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'IL',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'he';

-- CreateIndex
CREATE INDEX "User_countryCode_idx" ON "User"("countryCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dentist" ADD CONSTRAINT "Dentist_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- NOTE: Prisma also wanted to DROP TABLE "Payment_archived" here. Deliberately
-- omitted. That table is the retained archive of the removed patient-fee model
-- (see the free_patient_subscription_only migration); dropping it is unrelated
-- to internationalisation and irreversible. The resulting drift is pre-existing
-- and should be resolved on its own terms.
