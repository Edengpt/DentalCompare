// Load the same env files the app uses (.env.local wins, then .env) so tests
// that need a real DATABASE_URL (integration tests) can connect. Pure unit tests
// don't depend on these; integration suites self-skip when DATABASE_URL is absent.
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
