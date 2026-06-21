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

const dentists = [
  {
    clinicName: "מרפאת השן הזהב",
    dentistName: 'ד"ר יוסי לוי',
    email: "yossi.levi@dental-zahav.co.il",
    phone: "03-5551234",
    city: "תל אביב",
    address: "דיזנגוף 145, תל אביב",
    experienceYears: 18,
    specialties: ["Implantology", "Prosthodontics"],
    treatments: ["Implants", "Crowns", "Veneers"],
    hmoAffiliations: ["Clalit", "Maccabi"],
    rating: 4.9,
    reviewCount: 142,
  },
  {
    clinicName: "מרפאת שיניים אסתטיקה",
    dentistName: 'ד"ר רחל כהן',
    email: "r.cohen@aesthetic-dental.co.il",
    phone: "03-6661234",
    city: "תל אביב",
    address: "אבן גבירול 78, תל אביב",
    experienceYears: 12,
    specialties: ["Aesthetics", "Prosthodontics"],
    treatments: ["Veneers", "Whitening", "Crowns"],
    hmoAffiliations: ["Maccabi", "Meuhedet"],
    rating: 4.8,
    reviewCount: 89,
  },
  {
    clinicName: "מרכז שיניים ירושלים",
    dentistName: 'ד"ר אבי שמואלי',
    email: "avi.s@jdc.co.il",
    phone: "02-5557788",
    city: "ירושלים",
    address: "המלך ג'ורג' 12, ירושלים",
    experienceYears: 22,
    specialties: ["Implantology", "Periodontics"],
    treatments: ["Implants", "Gum Surgery", "Bone Grafting"],
    hmoAffiliations: ["Clalit", "Leumit"],
    rating: 4.7,
    reviewCount: 203,
  },
  {
    clinicName: "מרפאת חיוך ירושלים",
    dentistName: 'ד"ר מירי גולן',
    email: "miri@hiyuch-jlm.co.il",
    phone: "02-6789012",
    city: "ירושלים",
    address: "יפו 88, ירושלים",
    experienceYears: 9,
    specialties: ["Orthodontics", "Pediatric"],
    treatments: ["Braces", "Invisalign", "Pediatric Care"],
    hmoAffiliations: ["Maccabi", "Clalit", "Meuhedet"],
    rating: 4.9,
    reviewCount: 76,
  },
  {
    clinicName: "מרפאת השיניים של חיפה",
    dentistName: 'ד"ר דניאל פרץ',
    email: "d.peretz@haifa-dental.co.il",
    phone: "04-8123456",
    city: "חיפה",
    address: "הנשיא 24, חיפה",
    experienceYears: 15,
    specialties: ["Endodontics", "Prosthodontics"],
    treatments: ["Root Canal", "Crowns", "Bridges"],
    hmoAffiliations: ["Clalit", "Maccabi"],
    rating: 4.6,
    reviewCount: 118,
  },
  {
    clinicName: "מרפאת השן הים",
    dentistName: 'ד"ר נועה אדרי',
    email: "noa@hashen-hayam.co.il",
    phone: "04-8765432",
    city: "חיפה",
    address: "מוריה 50, חיפה",
    experienceYears: 7,
    specialties: ["Aesthetics", "Endodontics"],
    treatments: ["Veneers", "Whitening", "Root Canal"],
    hmoAffiliations: ["Meuhedet", "Leumit"],
    rating: 4.8,
    reviewCount: 54,
  },
  {
    clinicName: 'מרפאת ד"ר ברקוביץ',
    dentistName: 'ד"ר אלון ברקוביץ',
    email: "alon@berkovich-dental.co.il",
    phone: "08-6234567",
    city: "באר שבע",
    address: "רגר 35, באר שבע",
    experienceYears: 25,
    specialties: ["Implantology", "Prosthodontics", "Periodontics"],
    treatments: ["Implants", "Full Mouth Reconstruction", "Crowns"],
    hmoAffiliations: ["Clalit"],
    rating: 4.9,
    reviewCount: 312,
  },
  {
    clinicName: "מרפאת המרכז",
    dentistName: 'ד"ר תמר אבני',
    email: "tamar@hamerkaz-dental.co.il",
    phone: "03-9551122",
    city: "ראשון לציון",
    address: "רוטשילד 60, ראשון לציון",
    experienceYears: 11,
    specialties: ["Orthodontics", "Aesthetics"],
    treatments: ["Invisalign", "Braces", "Veneers"],
    hmoAffiliations: ["Maccabi", "Clalit"],
    rating: 4.7,
    reviewCount: 92,
  },
  {
    clinicName: "מרפאת חיוך זוהר",
    dentistName: 'ד"ר משה ביטון',
    email: "moshe@hiyuch-zohar.co.il",
    phone: "03-9223344",
    city: "פתח תקווה",
    address: "ז'בוטינסקי 110, פתח תקווה",
    experienceYears: 16,
    specialties: ["Implantology", "Endodontics"],
    treatments: ["Implants", "Root Canal", "Crowns"],
    hmoAffiliations: ["Clalit", "Meuhedet"],
    rating: 4.6,
    reviewCount: 168,
  },
  {
    clinicName: "מרפאת השרון",
    dentistName: 'ד"ר רונית שטרן',
    email: "ronit@sharon-dental.co.il",
    phone: "09-7654321",
    city: "נתניה",
    address: "הרצל 22, נתניה",
    experienceYears: 13,
    specialties: ["Prosthodontics", "Aesthetics"],
    treatments: ["Crowns", "Bridges", "Veneers", "Whitening"],
    hmoAffiliations: ["Maccabi", "Leumit"],
    rating: 4.8,
    reviewCount: 71,
  },
  {
    clinicName: "מרפאת השן המודרנית",
    dentistName: 'ד"ר גיל אברהמי',
    email: "gil@modern-dental.co.il",
    phone: "03-5557799",
    city: "רמת גן",
    address: "ביאליק 40, רמת גן",
    experienceYears: 20,
    specialties: ["Implantology", "Aesthetics"],
    treatments: ["Implants", "Veneers", "Full Mouth Reconstruction"],
    hmoAffiliations: ["Clalit", "Maccabi", "Meuhedet"],
    rating: 4.9,
    reviewCount: 245,
  },
  {
    clinicName: "מרפאת הילה",
    dentistName: 'ד"ר הילה רוזן',
    email: "hila@hila-dental.co.il",
    phone: "09-7445566",
    city: "רעננה",
    address: "אחוזה 95, רעננה",
    experienceYears: 8,
    specialties: ["Pediatric", "Orthodontics"],
    treatments: ["Pediatric Care", "Invisalign", "Braces"],
    hmoAffiliations: ["Maccabi", "Clalit"],
    rating: 5.0,
    reviewCount: 47,
  },
  {
    clinicName: "מרפאת השן הצפונית",
    dentistName: 'ד"ר עמית כהן',
    email: "amit@northern-dental.co.il",
    phone: "09-9112233",
    city: "הרצליה",
    address: "סוקולוב 30, הרצליה",
    experienceYears: 14,
    specialties: ["Endodontics", "Prosthodontics"],
    treatments: ["Root Canal", "Crowns", "Bridges"],
    hmoAffiliations: ["Maccabi", "Meuhedet"],
    rating: 4.7,
    reviewCount: 134,
  },
  {
    clinicName: "מרפאת השן הדרומית",
    dentistName: 'ד"ר שרה ישראלי',
    email: "sara@southern-dental.co.il",
    phone: "08-8554433",
    city: "אשדוד",
    address: "מנחם בגין 75, אשדוד",
    experienceYears: 6,
    specialties: ["Aesthetics", "Pediatric"],
    treatments: ["Whitening", "Veneers", "Pediatric Care"],
    hmoAffiliations: ["Clalit", "Leumit"],
    rating: 4.6,
    reviewCount: 38,
  },
  {
    clinicName: "מרפאת השן המומחים",
    dentistName: 'ד"ר יואב חזן',
    email: "yoav@experts-dental.co.il",
    phone: "08-9776655",
    city: "מודיעין",
    address: "עמק דותן 12, מודיעין",
    experienceYears: 17,
    specialties: ["Implantology", "Periodontics", "Prosthodontics"],
    treatments: ["Implants", "Gum Surgery", "Crowns", "Bridges"],
    hmoAffiliations: ["Maccabi", "Clalit", "Meuhedet", "Leumit"],
    rating: 4.8,
    reviewCount: 189,
  },
];

async function main() {
  console.log("🌱 Seeding dentists...");

  for (const dentist of dentists) {
    await prisma.dentist.upsert({
      where: { email: dentist.email },
      update: dentist,
      create: dentist,
    });
  }

  const count = await prisma.dentist.count();
  console.log(`✓ Done. Total dentists in DB: ${count}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
