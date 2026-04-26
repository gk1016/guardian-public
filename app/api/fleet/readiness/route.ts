import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  // Get all active fleet ships with specs and owners
  const ships = await prisma.fleetShip.findMany({
    where: { orgId: org.id, status: "active" },
    include: {
      shipSpec: true,
      user: { select: { handle: true, displayName: true, status: true } },
    },
  });

  // Get total active members for crew availability estimate
  const memberCount = await prisma.orgMember.count({
    where: {
      orgId: org.id,
      user: { status: "active" },
    },
  });

  // Aggregate by classification
  const byClass: Record<string, {
    count: number;
    crewRequired: number;
    crewMinimum: number;
    ships: { name: string; owner: string; crewMax: number; shipName: string | null }[];
  }> = {};

  let totalCrewMax = 0;
  let totalCrewMin = 0;
  let totalCargo = 0;

  for (const ship of ships) {
    const cls = ship.shipSpec.classification;
    if (!byClass[cls]) {
      byClass[cls] = { count: 0, crewRequired: 0, crewMinimum: 0, ships: [] };
    }
    byClass[cls].count++;
    byClass[cls].crewRequired += ship.shipSpec.crewMax;
    byClass[cls].crewMinimum += ship.shipSpec.crewMin;
    byClass[cls].ships.push({
      name: ship.shipSpec.name,
      owner: ship.user.handle,
      crewMax: ship.shipSpec.crewMax,
      shipName: ship.shipName,
    });

    totalCrewMax += ship.shipSpec.crewMax;
    totalCrewMin += ship.shipSpec.crewMin;
    totalCargo += ship.shipSpec.cargo;
  }

  // Unique ship types
  const uniqueTypes = new Set(ships.map((s) => s.shipSpec.name)).size;
  // Unique owners
  const uniqueOwners = new Set(ships.map((s) => s.userId)).size;

  return NextResponse.json({
    readiness: {
      totalShips: ships.length,
      uniqueTypes,
      uniqueOwners,
      memberCount,
      crewCapacity: { min: totalCrewMin, max: totalCrewMax },
      totalCargo,
      crewSufficiency: memberCount >= totalCrewMin
        ? memberCount >= totalCrewMax
          ? "full"
          : "minimum"
        : "undermanned",
      byClassification: byClass,
    },
  });
}
