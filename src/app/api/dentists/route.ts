import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PUBLIC_DENTIST_SELECT, publicDentistWhere } from "@/lib/dentist-public";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? undefined;
  const specialties = searchParams.getAll("specialty");
  const insurers = searchParams.getAll("insurer");
  const minExperience = Number(searchParams.get("minExperience") ?? 0) || undefined;

  // Unauthenticated and reachable by anyone — proxy-routes.test.ts pins that it
  // is deliberately public — so the select matters more here than anywhere.
  const dentists = await db.dentist.findMany({
    select: PUBLIC_DENTIST_SELECT,
    where: {
      ...publicDentistWhere(),
      ...(city ? { city } : {}),
      ...(specialties.length ? { specialties: { hasSome: specialties } } : {}),
      ...(insurers.length ? { insurerAffiliations: { hasSome: insurers } } : {}),
      ...(minExperience ? { experienceYears: { gte: minExperience } } : {}),
    },
    orderBy: [{ reviewCount: "desc" }, { rating: "desc" }, { experienceYears: "desc" }],
  });

  return NextResponse.json({ dentists });
}
