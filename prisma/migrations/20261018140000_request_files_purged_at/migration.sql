-- When a request's medical files were deleted (retention period or account deletion).
ALTER TABLE "Request" ADD COLUMN "filesPurgedAt" TIMESTAMP(3);
