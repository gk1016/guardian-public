import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const classification = searchParams.get("classification") ?? undefined;

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { manufacturer: { contains: q, mode: "insensitive" } },
      { focus: { contains: q, mode: "insensitive" } },
    ];
  }
  if (classification) {
    where.classification = classification;
  }

  const specs = await prisma.shipSpec.findMany({
    where,
    orderBy: { name: "asc" },
    take: 50,
    select: {
      id: true,
      name: true,
      manufacturer: true,
      classification: true,
      focus: true,
      crewMin: true,
      crewMax: true,
      cargo: true,
      imageUrl: true,
      inGame: true,
    },
  });

  return NextResponse.json({ specs });
}
