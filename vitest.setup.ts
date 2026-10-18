// Load the same env files the app uses (.env.local wins, then .env) so tests
// that need a real DATABASE_URL (integration tests) can connect. Pure unit tests
// don't depend on these; integration suites self-skip when DATABASE_URL is absent.
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

// Blob URLs in tests are fixtures (`x.blob.vercel-storage.com`), and CI has no
// store tokens. Drop the developer's real ones so a local run checks blob hosts
// exactly the way CI does, instead of pinning them to a real store.
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.LOGO_BLOB_READ_WRITE_TOKEN;
