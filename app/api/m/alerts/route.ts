import { NextResponse } from "next/server";
import { requireMobileSession } from "@/lib/mobile-auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/m/alerts
 * Returns recent alerts for G2 HUD — combines unread notifications
 * with high-severity active intel reports.
 */
export async function GET(request: Request) {
  const session = await requireMobileSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const org = await getOrgForUser(session.userId);
    if (!org) {
      return NextResponse.json({ alerts: [] });
    }

    const [notifications, intel] = await Promise.all([
      prisma.notification.findMany({
        where: {
          orgId: org.id,
          status: "unread",
          severity: { in: ["critical", "warning"] },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          severity: true,
          category: true,
          createdAt: true,
        },
      }),
      prisma.intelReport.findMany({
        where: {
          orgId: org.id,
          isActive: true,
          severity: { gte: 3 },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          severity: true,
          reportType: true,
          hostileGroup: true,
          createdAt: true,
        },
      }),
    ]);

    // Merge and deduplicate by title, sort by recency
    const alerts: Array<{
      id: string;
      title: string;
      severity: string;
      source: string;
      createdAt: string;
    }> = [];

    const severityMap: Record<number, string> = {
      5: "critical",
      4: "high",
      3: "elevated",
      2: "guarded",
      1: "low",
    };

    for (const n of notifications) {
      alerts.push({
        id: `notif-${n.id}`,
        title: n.title,
        severity: n.severity,
        source: n.category,
        createdAt: n.createdAt.toISOString(),
      });
    }

    for (const i of intel) {
      alerts.push({
        id: `intel-${i.id}`,
        title: i.title,
        severity: severityMap[i.severity] ?? "elevated",
        source: i.reportType,
        createdAt: i.createdAt.toISOString(),
      });
    }

    // Sort by createdAt descending, take top 10
    alerts.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({ alerts: alerts.slice(0, 10) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load alerts." },
      { status: 500 },
    );
  }
}
