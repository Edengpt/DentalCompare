-- Daily FX snapshot, for DISPLAY conversion only. A quote is always stored in
-- the currency the clinic named; these rates never rewrite a stored amount.
CREATE TABLE "ExchangeRate" (
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("base","quote")
);

-- NOTE: Prisma wanted to DROP TABLE "Payment_archived" here as well.
-- Deliberately omitted, same as in the country_model migration — see the note
-- there. The drift is pre-existing and unrelated to internationalisation.
