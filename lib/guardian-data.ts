import { prisma } from "@/lib/prisma";

type MissionWithParticipants = {
  id: string;
  callsign: string;
  title: string;
  missionType: string;
  status: string;
  priority: string;
  areaOfOperation: string | null;
  missionBrief: string | null;
  lead?: {
    handle: string;
    displayName: string | null;
  } | null;
  updatedAt?: Date;
  participants: unknown[];
};

type MissionParticipantRecord = {
  id: string;
  handle: string;
  role: string;
  platform: string | null;
  status: string;
  notes: string | null;
};

type MissionLogRecord = {
  id: string;
  entryType: string;
  message: string;
  createdAt: Date;
  author: {
    handle: string;
    displayName: string | null;
  } | null;
};

type IntelReportRecord = {
  id: string;
  title: string;
  description: string | null;
  severity: number;
  reportType: string;
  locationName: string | null;
  hostileGroup: string | null;
  confidence: string;
  tags: string[];
};

type RescueRequestRecord = {
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
};

type QrfReadinessRecord = {
  id: string;
  callsign: string;
  status: string;
  platform: string | null;
  locationName: string | null;
  availableCrew: number;
};

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

type MissionDetailPayload = {
  ok: boolean;
  orgName: string;
  mission: {
    id: string;
    callsign: string;
    title: string;
    missionType: string;
    status: string;
    priority: string;
    areaOfOperation: string | null;
    missionBrief: string | null;
    leadDisplay: string;
    updatedAtLabel: string;
    logs: {
      id: string;
      entryType: string;
      message: string;
      createdAtLabel: string;
      authorDisplay: string;
    }[];
    participants: {
      id: string;
      handle: string;
      role: string;
      platform: string | null;
      status: string;
      notes: string | null;
    }[];
  } | null;
  error?: string;
};

async function getPrimaryOrg() {
  return prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

export async function getOrgForUser(userId: string) {
  const membership = await prisma.orgMember.findFirst({
    where: { userId },
    include: { org: true },
    orderBy: { joinedAt: "asc" },
  });

  return membership?.org ?? getPrimaryOrg();
}

export async function getCommandOverview(userId: string): Promise<OverviewPayload> {
  try {
    const org = await getOrgForUser(userId);

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
      missions: missions.map((mission: MissionWithParticipants) => ({
        id: mission.id,
        callsign: mission.callsign,
        title: mission.title,
        missionType: mission.missionType,
        status: mission.status,
        priority: mission.priority,
        areaOfOperation: mission.areaOfOperation,
        participantCount: mission.participants.length,
      })),
      rescues: rescues.map((rescue: RescueRequestRecord) => ({
        id: rescue.id,
        survivorHandle: rescue.survivorHandle,
        locationName: rescue.locationName,
        urgency: rescue.urgency,
        status: rescue.status,
        escortRequired: rescue.escortRequired,
      })),
      intel: intel.map((report: IntelReportRecord) => ({
        id: report.id,
        title: report.title,
        severity: report.severity,
        hostileGroup: report.hostileGroup,
        locationName: report.locationName,
        confidence: report.confidence,
      })),
      qrf: qrf.map((entry: QrfReadinessRecord) => ({
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

export async function getMissionPageData(userId: string): Promise<
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
    const org = await getOrgForUser(userId);
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
      items: missions.map((mission: MissionWithParticipants) => ({
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

export async function getMissionDetailPageData(
  userId: string,
  missionId: string,
): Promise<MissionDetailPayload> {
  try {
    const org = await getOrgForUser(userId);
    if (!org) {
      return { ok: true, orgName: "Guardian", mission: null };
    }

    const mission = await prisma.mission.findFirst({
      where: {
        id: missionId,
        orgId: org.id,
      },
      include: {
        lead: {
          select: {
            handle: true,
            displayName: true,
          },
        },
        participants: {
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        },
        logs: {
          orderBy: [{ createdAt: "desc" }],
          include: {
            author: {
              select: {
                handle: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!mission) {
      return {
        ok: false,
        orgName: org.name,
        mission: null,
        error: "Mission not found.",
      };
    }

    return {
      ok: true,
      orgName: org.name,
      mission: {
        id: mission.id,
        callsign: mission.callsign,
        title: mission.title,
        missionType: mission.missionType,
        status: mission.status,
        priority: mission.priority,
        areaOfOperation: mission.areaOfOperation,
        missionBrief: mission.missionBrief,
        leadDisplay: mission.lead?.displayName || mission.lead?.handle || "Unassigned",
        updatedAtLabel: mission.updatedAt.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        logs: mission.logs.map((log: MissionLogRecord) => ({
          id: log.id,
          entryType: log.entryType,
          message: log.message,
          createdAtLabel: log.createdAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          authorDisplay: log.author?.displayName || log.author?.handle || "Guardian",
        })),
        participants: mission.participants.map((participant: MissionParticipantRecord) => ({
          id: participant.id,
          handle: participant.handle,
          role: participant.role,
          platform: participant.platform,
          status: participant.status,
          notes: participant.notes,
        })),
      },
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      mission: null,
      error: error instanceof Error ? error.message : "Failed to load mission detail.",
    };
  }
}

export async function getIntelPageData(userId: string): Promise<
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
    const org = await getOrgForUser(userId);
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
      items: reports.map((report: IntelReportRecord) => ({
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

export async function getRescuePageData(userId: string): Promise<
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
    const org = await getOrgForUser(userId);
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
      items: rescues.map((rescue: RescueRequestRecord) => ({
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
