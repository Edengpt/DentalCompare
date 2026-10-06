-- One row per stored object: re-confirming an upload must not create a second
-- row (or, at the file cap, delete a blob a live row points at).
CREATE UNIQUE INDEX "QuoteAttachment_blobUrl_key" ON "QuoteAttachment"("blobUrl");
