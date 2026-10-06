-- Structured quotes: treatment line items, package discount, travel details,
-- and clinic-attached documents. Additive only — legacy quotes stay valid.
ALTER TABLE "Quote" ADD COLUMN "discountMinor" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "flightsIncluded" BOOLEAN;
ALTER TABLE "Quote" ADD COLUMN "flightTickets" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "transfers" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "variant" TEXT,
    "customLabel" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteAttachment" (
    "id" TEXT NOT NULL,
    "requestDentistId" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");
CREATE INDEX "QuoteAttachment_requestDentistId_idx" ON "QuoteAttachment"("requestDentistId");

ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteAttachment" ADD CONSTRAINT "QuoteAttachment_requestDentistId_fkey" FOREIGN KEY ("requestDentistId") REFERENCES "RequestDentist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
