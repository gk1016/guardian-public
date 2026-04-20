import { prisma } from "@/lib/prisma";

export type OverviewPayload = {
  ok: boolean;
  orgName: string;
  activeMissionCount: number;
  openRescueCount: number;
  activeIntelCount: number;
  qrfReadyCount: number;
  missions: {
    id: string;
    callsign: string;
    title: string;
    missionType: string;
    status: string;
    priority: string;
    areaOfOperation: string | null;
    participantCount: number;
  }[];
  rescues: {
    id: string;
    survivorHandle: string;
    locationName: string | null;
    urgency: string;
    status: string;
    escortRequired: boolean;
  }[];
  intel: {
    id: string;
    title: string;
    severity: number;
    hostileGroup: string | null;
    locationName: string | null;
    confidence: string;
  }[];
  qrf: {
    id: string;
    callsign: string;
    status: string;
    platform: string | null;
    locationName: string | null;
    availableCrew: number;
  }[];
  error?: string;
};

type PagePayload<T> = {
  ok: boolean;
  orgName: string;
  items: T[];
  error?: string;
};

async function getPrimaryOrg() {
  return prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

export async function getCommandOverview(): Promise<OverviewPayload> {
  try {
    const org = await getPrimaryOrg();

    if (!org) {
      return {
        ok: true,
        orgName: "Guardian",
        activeMissionCount: 0,
        openRescueCount: 0,
        activeIntelCount: 0,
        qrfReadyCount: 0,
        missions: [],
        rescues: [],
        intel: [],
        qrf: [],
      };
    }

    const [missions, rescues, intel, qrf, activeMissionCount, openRescueCount, activeIntelCount, qrfReadyCount] =
      await Promise.all([
        prisma.mission.findMany({
          where: { orgId: org.id },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          take: 4,
          include: { participants: true },
        }),
        prisma.rescueRequest.findMany({
          where: { orgId: org.id },
          orderBy: [{ urgency: "asc" }, { updatedAt: "desc" }],
          take: 3,
        }),
        prisma.intelReport.findMany({
          where: { orgId: org.id, isActive: true },
          orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
          take: 4,
        }),
        prisma.qrfReadiness.findMany({
          where: { orgId: org.id },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          take: 4,
        }),
        prisma.mission.count({
          where: { orgId: org.id, status: { in: ["planning", "ready", "active"] } },
        }),
        prisma.rescueRequest.count({
          where: { orgId: org.id, status: { in: ["open", "accepted", "en_route"] } },
        }),
        prisma.intelReport.count({
          where: { orgId: org.id, isActive: true },
        }),
        prisma.qrfReadiness.count({
          where: { orgId: org.id, status: { in: ["redcon1", "redcon2"] } },
        }),
      ]);

    return {
      ok: true,
      orgName: org.name,
      activeMissionCount,
      openRescueCount,
      activeIntelCount,
      qrfReadyCount,
      missions: missions.map((mission) => ({
        id: mission.id,
        callsign: mission.callsign,
        title: mission.title,
        missionType: mission.missionType,
        status: mission.status,
        priority: mission.priority,
        areaOfOperation: mission.areaOfOperation,
        participantCount: mission.participants.length,
      })),
      rescues: rescues.map((rescue) => ({
        id: rescue.id,
        survivorHandle: rescue.survivorHandle,
        locationName: rescue.locationName,
        urgency: rescue.urgency,
        status: rescue.status,
        escortRequired: rescue.escortRequired,
      })),
      intel: intel.map((report) => ({
        id: report.id,
        title: report.title,
        severity: report.severity,
        hostileGroup: report.hostileGroup,
        locationName: report.locationName,
        confidence: report.confidence,
      })),
      qrf: qrf.map((entry) => ({
        id: entry.id,
        callsign: entry.callsign,
        status: entry.status,
        platform: entry.platform,
        locationName: entry.locationName,
        availableCrew: entry.availableCrew,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      activeMissionCount: 0,
      openRescueCount: 0,
      activeIntelCount: 0,
      qrfReadyCount: 0,
      missions: [],
      rescues: [],
      intel: [],
      qrf: [],
      error: error instanceof Error ? error.message : "Failed to load overview.",
    };
  }
}

export async function getMissionPageData(): Promise<
  PagePayload<{
    id: string;
    callsign: string;
    title: string;
    missionType: string;
    status: string;
    priority: string;
    areaOfOperation: string | null;
    missionBrief: string | null;
    participantCount: number;
  }>
> {
  try {
    const org = await getPrimaryOrg();
    if (!org) {
      return { ok: true, orgName: "Guardian", items: [] };
    }

    const missions = await prisma.mission.findMany({
      where: { orgId: org.id },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: { participants: true },
    });

    return {
      ok: true,
      orgName: org.name,
      items: missions.map((mission) => ({
        id: mission.id,
        callsign: mission.callsign,
        title: mission.title,
        missionType: mission.missionType,
        status: mission.status,
        priority: mission.priority,
        areaOfOperation: mission.areaOfOperation,
        missionBrief: mission.missionBrief,
        participantCount: mission.participants.length,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      items: [],
      error: error instanceof Error ? error.message : "Failed to load missions.",
    };
  }
}

export async function getIntelPageData(): Promise<
  PagePayload<{
    id: string;
    title: string;
    description: string | null;
    severity: number;
    reportType: string;
    locationName: string | null;
    hostileGroup: string | null;
    confidence: string;
    tags: string[];
  }>
> {
  try {
    const org = await getPrimaryOrg();
    if (!org) {
      return { ok: true, orgName: "Guardian", items: [] };
    }

    const reports = await prisma.intelReport.findMany({
      where: { orgId: org.id },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });

    return {
      ok: true,
      orgName: org.name,
      items: reports.map((report) => ({
        id: report.id,
        title: report.title,
        description: report.description,
        severity: report.severity,
        reportType: report.reportType,
        locationName: report.locationName,
        hostileGroup: report.hostileGroup,
        confidence: report.confidence,
        tags: report.tags,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      items: [],
      error: error instanceof Error ? error.message : "Failed to load intel.",
    };
  }
}

export async function getRescuePageData(): Promise<
  PagePayload<{
    id: string;
    survivorHandle: string;
    locationName: string | null;
    status: string;
    urgency: string;
    threatSummary: string | null;
    rescueNotes: string | null;
    escortRequired: boolean;
    medicalRequired: boolean;
    offeredPayment: number | null;
  }>
> {
  try {
    const org = await getPrimaryOrg();
    if (!org) {
      return { ok: true, orgName: "Guardian", items: [] };
    }

    const rescues = await prisma.rescueRequest.findMany({
      where: { orgId: org.id },
      orderBy: [{ urgency: "asc" }, { updatedAt: "desc" }],
    });

    return {
      ok: true,
      orgName: org.name,
      items: rescues.map((rescue) => ({
        id: rescue.id,
        survivorHandle: rescue.survivorHandle,
        locationName: rescue.locationName,
        status: rescue.status,
        urgency: rescue.urgency,
        threatSummary: rescue.threatSummary,
        rescueNotes: rescue.rescueNotes,
        escortRequired: rescue.escortRequired,
        medicalRequired: rescue.medicalRequired,
        offeredPayment: rescue.offeredPayment,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      items: [],
      error: error instanceof Error ? error.message : "Failed to load rescues.",
    };
  }
}
