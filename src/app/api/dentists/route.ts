import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? undefined;
  const specialties = searchParams.getAll("specialty");
  const hmos = searchParams.getAll("hmo");
  const minExperience = Number(searchParams.get("minExperience") ?? 0) || undefined;

  const dentists = await db.dentist.findMany({
    where: {
      isActive: true,
      ...(city ? { city } : {}),
      ...(specialties.length ? { specialties: { hasSome: specialties } } : {}),
      ...(hmos.length ? { hmoAffiliations: { hasSome: hmos } } : {}),
      ...(minExperience ? { experienceYears: { gte: minExperience } } : {}),
    },
    orderBy: [{ reviewCount: "desc" }, { rating: "desc" }, { experienceYears: "desc" }],
  });

  return NextResponse.json({ dentists });
}
