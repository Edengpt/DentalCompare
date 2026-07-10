-- DB-backed rate limiting (Step 11). New table only.
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RateLimit_bucket_createdAt_idx" ON "RateLimit"("bucket", "createdAt");
