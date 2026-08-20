import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { visibleSubscriptionFilter } from "@/lib/subscription";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? undefined;
  const specialties = searchParams.getAll("specialty");
  const insurers = searchParams.getAll("insurer");
  const minExperience = Number(searchParams.get("minExperience") ?? 0) || undefined;

  const dentists = await db.dentist.findMany({
    where: {
      isActive: true,
      subscription: visibleSubscriptionFilter(),
      ...(city ? { city } : {}),
      ...(specialties.length ? { specialties: { hasSome: specialties } } : {}),
      ...(insurers.length ? { insurerAffiliations: { hasSome: insurers } } : {}),
      ...(minExperience ? { experienceYears: { gte: minExperience } } : {}),
    },
    orderBy: [{ reviewCount: "desc" }, { rating: "desc" }, { experienceYears: "desc" }],
  });

  return NextResponse.json({ dentists });
}
