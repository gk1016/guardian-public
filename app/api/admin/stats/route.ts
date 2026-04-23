import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageAdministration } from "@/lib/roles";

/**
 * GET /api/admin/stats
 * Dashboard summary: user counts, mission counts, recent audit activity.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  // Run all queries in parallel
  const [
    usersByStatus,
    missionsByStatus,
    totalIntel,
    openRescues,
    openIncidents,
    unreadNotifications,
    recentAudit,
    totpEnabled,
  ] = await Promise.all([
    // User counts by status
    prisma.orgMember.findMany({
      where: { orgId: org.id },
      select: { user: { select: { status: true } } },
    }),
    // Mission counts by status
    prisma.mission.groupBy({
      by: ["status"],
      where: { orgId: org.id },
      _count: true,
    }),
    // Total active intel
    prisma.intelReport.count({
      where: { orgId: org.id, isActive: true },
    }),
    // Open rescues
    prisma.rescueRequest.count({
      where: { orgId: org.id, status: { in: ["open", "in_progress"] } },
    }),
    // Open incidents
    prisma.incident.count({
      where: { orgId: org.id, status: "open" },
    }),
    // Unread notifications
    prisma.notification.count({
      where: { orgId: org.id, status: "unread" },
    }),
    // Last 10 audit events
    prisma.auditLog.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        action: true,
        targetType: true,
        createdAt: true,
        user: { select: { handle: true } },
      },
    }),
    // Users with TOTP enabled
    prisma.user.count({
      where: {
        totpEnabled: true,
        memberships: { some: { orgId: org.id } },
      },
    }),
  ]);

  // Aggregate user counts
  const users: Record<string, number> = { active: 0, pending: 0, disabled: 0 };
  for (const m of usersByStatus) {
    const s = m.user.status;
    users[s] = (users[s] ?? 0) + 1;
  }

  // Aggregate mission counts
  const missions: Record<string, number> = {};
  for (const g of missionsByStatus) {
    missions[g.status] = g._count;
  }

  return NextResponse.json({
    ok: true,
    org: { id: org.id, name: org.name, tag: org.tag },
    users: {
      ...users,
      total: Object.values(users).reduce((a, b) => a + b, 0),
      totpEnabled,
    },
    missions,
    intel: { active: totalIntel },
    rescues: { open: openRescues },
    incidents: { open: openIncidents },
    notifications: { unread: unreadNotifications },
    recentActivity: recentAudit.map((a) => ({
      action: a.action,
      targetType: a.targetType,
      actor: a.user.handle,
      at: a.createdAt.toISOString(),
    })),
  });
}
