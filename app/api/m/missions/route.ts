import { NextResponse } from "next/server";
import { requireMobileSession } from "@/lib/mobile-auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/m/missions
 * Returns active missions for G2 HUD.
 */
export async function GET(request: Request) {
  const session = await requireMobileSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const org = await getOrgForUser(session.userId);
    if (!org) {
      return NextResponse.json({ missions: [] });
    }

    const missions = await prisma.mission.findMany({
      where: {
        orgId: org.id,
        status: { in: ["planning", "ready", "active"] },
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 10,
      select: {
        id: true,
        callsign: true,
        title: true,
        missionType: true,
        status: true,
        priority: true,
        areaOfOperation: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      missions: missions.map((m) => ({
        id: m.id,
        name: `${m.callsign} / ${m.title}`,
        phase: m.status,
        status: m.priority,
        type: m.missionType,
        area: m.areaOfOperation,
        updatedAt: m.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load missions." },
      { status: 500 },
    );
  }
}
