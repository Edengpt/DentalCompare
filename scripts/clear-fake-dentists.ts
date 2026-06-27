/**
 * One-off cleanup: removes ALL dentist rows. Intended to wipe the placeholder
 * seed data before launch so the directory starts empty and only fills via the
 * real flow (intake form -> admin approval). Deleting a dentist cascades to its
 * RequestDentist links (see schema onDelete: Cascade).
 *
 * Run with:  npx tsx scripts/clear-fake-dentists.ts
 *
 * Safe to run only pre-launch / when no real clinics exist yet. After launch,
 * remove specific clinics from the admin panel instead.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const before = await prisma.dentist.count();
  if (before === 0) {
    console.log("✓ No dentists to delete — directory is already empty.");
    return;
  }

  console.log(`⚠️  Deleting ${before} dentist row(s) and their request links...`);
  const { count } = await prisma.dentist.deleteMany({});
  console.log(`✓ Deleted ${count} dentist(s). Directory is now empty.`);
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
