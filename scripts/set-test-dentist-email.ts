// One-off: point the first dentist at the owner's inbox so test-mode emails
// actually deliver (Resend free tier only sends to the account owner).
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
config({ path: ".env" });

const TEST_EMAIL = process.env.TEST_DENTIST_EMAIL ?? "edenbuchrisnew@gmail.com";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

async function main() {
  const first = await db.dentist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!first) {
    console.log("No dentists found — run `npm run db:seed` first.");
    return;
  }
  await db.dentist.update({ where: { id: first.id }, data: { email: TEST_EMAIL } });
  console.log(`OK: ${first.dentistName} (${first.clinicName}) -> ${TEST_EMAIL}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
