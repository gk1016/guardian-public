import { NextResponse } from "next/server";
import { requireMobileSession } from "@/lib/mobile-auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/m/status
 * Returns ops status summary for G2 HUD.
 * Computes threat level from highest active intel severity.
 */
export async function GET(request: Request) {
  const session = await requireMobileSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const org = await getOrgForUser(session.userId);
    if (!org) {
      return NextResponse.json({
        threatLevel: "low",
        activeMissionCount: 0,
        recentAlertCount: 0,
        qrfReady: false,
        userRole: session.role,
        activeMission: null,
      });
    }

    const [
      activeMissionCount,
      recentAlertCount,
      qrfReadyCount,
      maxIntelSeverity,
      activeMission,
    ] = await Promise.all([
      prisma.mission.count({
        where: { orgId: org.id, status: { in: ["planning", "ready", "active"] } },
      }),
      prisma.notification.count({
        where: {
          orgId: org.id,
          status: "unread",
        },
      }),
      prisma.qrfReadiness.count({
        where: { orgId: org.id, status: { in: ["redcon1", "redcon2"] } },
      }),
      prisma.intelReport.findFirst({
        where: { orgId: org.id, isActive: true },
        orderBy: { severity: "desc" },
        select: { severity: true },
      }),
      prisma.mission.findFirst({
        where: { orgId: org.id, status: "active" },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          callsign: true,
          title: true,
          status: true,
          priority: true,
        },
      }),
    ]);

    // Derive threat level from highest active intel severity
    const severity = maxIntelSeverity?.severity ?? 0;
    let threatLevel: string;
    if (severity >= 5) threatLevel = "critical";
    else if (severity >= 4) threatLevel = "high";
    else if (severity >= 3) threatLevel = "elevated";
    else if (severity >= 2) threatLevel = "guarded";
    else threatLevel = "low";

    return NextResponse.json({
      threatLevel,
      activeMissionCount,
      recentAlertCount,
      qrfReady: qrfReadyCount > 0,
      userRole: session.role,
      activeMission: activeMission
        ? {
            id: activeMission.id,
            name: activeMission.title,
            phase: activeMission.status,
            status: activeMission.priority,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load status." },
      { status: 500 },
    );
  }
}
