import { prisma } from "@/lib/prisma";
import { getOrgForUser } from "@/lib/guardian-data";

export type SitrepEvent = {
  id: string;
  source: "mission" | "alert";
  timestamp: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  category: string;
  href: string | null;
  missionCallsign: string | null;
  authorDisplay: string | null;
};

export type SitrepPayload = {
  ok: boolean;
  orgName: string;
  events: SitrepEvent[];
  error?: string;
};

export async function getSitrepData(userId: string): Promise<SitrepPayload> {
  try {
    const org = await getOrgForUser(userId);
    if (!org) {
      return { ok: true, orgName: "Guardian", events: [] };
    }

    const [missionLogs, notifications] = await Promise.all([
      prisma.missionLog.findMany({
        where: {
          mission: { orgId: org.id },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          mission: { select: { callsign: true, id: true } },
          author: { select: { handle: true, displayName: true } },
        },
      }),
      prisma.notification.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          createdBy: { select: { handle: true, displayName: true } },
        },
      }),
    ]);

    const events: SitrepEvent[] = [];

    for (const log of missionLogs) {
      const severityMap: Record<string, "info" | "warning" | "critical"> = {
        status: "info",
        package: "info",
        doctrine: "info",
        aar: "warning",
        alert: "critical",
      };
      events.push({
        id: `ml-${log.id}`,
        source: "mission",
        timestamp: log.createdAt.toISOString(),
        title: `${log.mission.callsign} / ${log.entryType}`,
        body: log.message,
        severity: severityMap[log.entryType] ?? "info",
        category: log.entryType,
        href: `/missions/${log.mission.id}`,
        missionCallsign: log.mission.callsign,
        authorDisplay: log.author?.displayName ?? log.author?.handle ?? null,
      });
    }

    for (const n of notifications) {
      events.push({
        id: `nt-${n.id}`,
        source: "alert",
        timestamp: n.createdAt.toISOString(),
        title: n.title,
        body: n.body,
        severity: n.severity as "info" | "warning" | "critical",
        category: n.category,
        href: n.href,
        missionCallsign: null,
        authorDisplay: n.createdBy?.displayName ?? n.createdBy?.handle ?? "system",
      });
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      ok: true,
      orgName: org.name,
      events: events.slice(0, 50),
    };
  } catch (e) {
    return {
      ok: false,
      orgName: "Guardian",
      events: [],
      error: e instanceof Error ? e.message : "Failed to load SITREP data.",
    };
  }
}
