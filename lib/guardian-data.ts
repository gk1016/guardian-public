import { prisma } from "@/lib/prisma";
import { evaluatePackageDiscipline, type PackageDiscipline } from "@/lib/package-discipline";

type MissionWithParticipants = {
  id: string;
  callsign: string;
  title: string;
  missionType: string;
  status: string;
  priority: string;
  revisionNumber: number;
  areaOfOperation: string | null;
  missionBrief: string | null;
  closeoutSummary: string | null;
  aarSummary: string | null;
  lead?: {
    handle: string;
    displayName: string | null;
  } | null;
  updatedAt?: Date;
  participants: unknown[];
};

type DoctrineTemplateRecord = {
  id: string;
  code: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  escalation: string | null;
  isDefault: boolean;
};

type MissionParticipantRecord = {
  id: string;
  handle: string;
  role: string;
  platform: string | null;
  status: string;
  notes: string | null;
};

type PackageSummary = {
  total: number;
  open: number;
  staffedTotal: number;
  assigned: number;
  ready: number;
  launched: number;
  rtb: number;
  readyOrLaunched: number;
  readinessLabel: string;
};

type CrewCandidate = {
  handle: string;
  displayName: string | null;
  orgRole: string;
  membershipTitle: string | null;
  qrfStatus: string | null;
  suggestedPlatform: string | null;
  sourceLabel: string;
  notes: string | null;
  commitments: {
    missionId: string;
    callsign: string;
    missionStatus: string;
    assignmentStatus: string;
    role: string;
  }[];
  availabilityLabel: "available" | "tasked" | "engaged";
};

type RosterCrewItem = CrewCandidate & {
  userId: string;
  email: string;
  rank: string;
  status: string;
  activityScore: number;
  activityTier: "active" | "moderate" | "dormant" | "dark";
  lastActiveLabel: string | null;
  missionCount: number;
  logCount: number;
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
  missionLinks?: {
    mission: {
      id: string;
      callsign: string;
      status: string;
    };
  }[];
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
  notes: string | null;
};

export type OverviewPayload = {
  ok: boolean;
  orgName: string;
  activeMissionCount: number;
  openRescueCount: number;
  activeIntelCount: number;
  qrfReadyCount: number;
  unreadNotificationCount: number;
  missions: {
    id: string;
    callsign: string;
    title: string;
    missionType: string;
    status: string;
    priority: string;
    revisionNumber: number;
    areaOfOperation: string | null;
    participantCount: number;
    packageSummary: PackageSummary;
    packageDiscipline: PackageDiscipline;
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
  notifications: {
    id: string;
    severity: string;
    title: string;
    href: string | null;
  }[];
  error?: string;
};

type PagePayload<T> = {
  ok: boolean;
  orgName: string;
  items: T[];
  error?: string;
};

type DoctrinePagePayload = {
  ok: boolean;
  orgName: string;
  items: {
    id: string;
    code: string;
    title: string;
    category: string;
    summary: string;
    body: string;
    escalation: string | null;
    isDefault: boolean;
    missionCount: number;
  }[];
  error?: string;
};

type RosterPagePayload = {
  ok: boolean;
  orgName: string;
  items: RosterCrewItem[];
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
    revisionNumber: number;
    areaOfOperation: string | null;
    missionBrief: string | null;
    closeoutSummary: string | null;
    aarSummary: string | null;
    roeCode: string | null;
    completedAtLabel: string | null;
    leadDisplay: string;
    updatedAtLabel: string;
    packageSummary: PackageSummary;
    packageDiscipline: PackageDiscipline;
    doctrineTemplate: {
      id: string;
      code: string;
      title: string;
      category: string;
      summary: string;
      body: string;
      escalation: string | null;
    } | null;
    availableDoctrineTemplates: {
      id: string;
      code: string;
      title: string;
      category: string;
      summary: string;
    }[];
    linkedIntel: {
      id: string;
      intelId: string;
      title: string;
      severity: number;
      reportType: string;
      locationName: string | null;
      hostileGroup: string | null;
    }[];
    availableIntel: {
      id: string;
      title: string;
      severity: number;
    }[];
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
    availableCrew: CrewCandidate[];
  } | null;
  error?: string;
};

async function getPrimaryOrg() {
  return prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

function normalizeHandle(value: string | null | undefined) {
  return (value ?? "").replaceAll(/\s+/g, "").trim().toUpperCase();
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function computeActivityTier(score: number): "active" | "moderate" | "dormant" | "dark" {
  if (score >= 60) return "active";
  if (score >= 30) return "moderate";
  if (score >= 10) return "dormant";
  return "dark";
}

function buildCrewCandidates(
  members: Array<{
    title: string | null;
    user: {
      handle: string;
      displayName: string | null;
      role: string;
    };
  }>,
  qrfEntries: QrfReadinessRecord[],
  activeMissionAssignments: Array<{
    id: string;
    callsign: string;
    status: string;
    lead: {
      handle: string;
      displayName: string | null;
    } | null;
    participants: MissionParticipantRecord[];
  }>,
  currentMissionId: string,
) {
  const commitmentsByHandle = new Map<
    string,
    {
      missionId: string;
      callsign: string;
      missionStatus: string;
      assignmentStatus: string;
      role: string;
    }[]
  >();

  for (const mission of activeMissionAssignments) {
    if (mission.id === currentMissionId) {
      continue;
    }

    if (mission.lead?.handle) {
      const normalizedLead = normalizeHandle(mission.lead.handle);
      const existingLeadCommitments = commitmentsByHandle.get(normalizedLead) ?? [];
      existingLeadCommitments.push({
        missionId: mission.id,
        callsign: mission.callsign,
        missionStatus: mission.status,
        assignmentStatus: "lead",
        role: "mission lead",
      });
      commitmentsByHandle.set(normalizedLead, existingLeadCommitments);
    }

    for (const participant of mission.participants) {
      if (participant.status === "open") {
        continue;
      }

      const normalizedHandle = normalizeHandle(participant.handle);
      const existingCommitments = commitmentsByHandle.get(normalizedHandle) ?? [];
      existingCommitments.push({
        missionId: mission.id,
        callsign: mission.callsign,
        missionStatus: mission.status,
        assignmentStatus: participant.status,
        role: participant.role,
      });
      commitmentsByHandle.set(normalizedHandle, existingCommitments);
    }
  }

  const qrfByHandle = new Map(
    qrfEntries.map((entry) => [
      normalizeHandle(entry.callsign),
      entry,
    ]),
  );

  const candidates = members.map((member) => {
    const qrfEntry = qrfByHandle.get(normalizeHandle(member.user.handle)) ?? null;
    const commitments = commitmentsByHandle.get(normalizeHandle(member.user.handle)) ?? [];
    const hasEngagedCommitment = commitments.some((commitment) =>
      ["ready", "launched", "lead"].includes(commitment.assignmentStatus),
    );

    return {
      handle: member.user.handle,
      displayName: member.user.displayName,
      orgRole: member.user.role,
      membershipTitle: member.title,
      qrfStatus: qrfEntry?.status ?? null,
      suggestedPlatform: qrfEntry?.platform ?? null,
      sourceLabel: qrfEntry ? "QRF + Org" : "Org roster",
      notes: qrfEntry?.notes ?? member.title ?? null,
      commitments,
      availabilityLabel: hasEngagedCommitment ? "engaged" : commitments.length > 0 ? "tasked" : "available",
    } satisfies CrewCandidate;
  });

  for (const qrfEntry of qrfEntries) {
    const handle = normalizeHandle(qrfEntry.callsign);
    if (candidates.some((candidate) => normalizeHandle(candidate.handle) === handle)) {
      continue;
    }

    candidates.push({
      handle: qrfEntry.callsign.replaceAll(" ", "").toUpperCase(),
      displayName: qrfEntry.callsign,
      orgRole: "watchfloor",
      membershipTitle: null,
      qrfStatus: qrfEntry.status,
      suggestedPlatform: qrfEntry.platform,
      sourceLabel: "QRF board",
      notes: qrfEntry.locationName ?? null,
      commitments: commitmentsByHandle.get(handle) ?? [],
      availabilityLabel: (commitmentsByHandle.get(handle) ?? []).some((commitment) =>
        ["ready", "launched", "lead"].includes(commitment.assignmentStatus),
      )
        ? "engaged"
        : (commitmentsByHandle.get(handle) ?? []).length > 0
          ? "tasked"
          : "available",
    });
  }

  return candidates.sort((left, right) => {
    const leftQrf = left.qrfStatus ? 0 : 1;
    const rightQrf = right.qrfStatus ? 0 : 1;
    if (leftQrf !== rightQrf) {
      return leftQrf - rightQrf;
    }

    return left.handle.localeCompare(right.handle);
  });
}

function summarizePackageStatus(participants: MissionParticipantRecord[]): PackageSummary {
  const summary = participants.reduce(
    (current, participant) => {
      if (participant.status === "open") {
        current.open += 1;
      } else if (participant.status === "assigned") {
        current.assigned += 1;
      } else if (participant.status === "ready") {
        current.ready += 1;
      } else if (participant.status === "launched") {
        current.launched += 1;
      } else if (participant.status === "rtb") {
        current.rtb += 1;
      }

      return current;
    },
    {
      total: participants.length,
      open: 0,
      assigned: 0,
      ready: 0,
      launched: 0,
      rtb: 0,
    },
  );

  const readyOrLaunched = summary.ready + summary.launched;
  const staffedTotal = summary.total - summary.open;

  return {
    ...summary,
    staffedTotal,
    readyOrLaunched,
    readinessLabel:
      summary.total === 0
        ? "unassigned"
        : staffedTotal === 0
          ? "skeleton"
          : readyOrLaunched === staffedTotal && summary.open === 0
            ? "green"
            : readyOrLaunched > 0
              ? "partial"
              : "cold",
  };
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
        unreadNotificationCount: 0,
        missions: [],
        rescues: [],
        intel: [],
        qrf: [],
        notifications: [],
      };
    }

    const [missions, rescues, intel, qrf, notifications, activeMissionCount, openRescueCount, activeIntelCount, qrfReadyCount, unreadNotificationCount] =
      await Promise.all([
        prisma.mission.findMany({
          where: { orgId: org.id },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          take: 4,
          include: {
            participants: true,
            lead: {
              select: {
                handle: true,
                displayName: true,
              },
            },
          },
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
        prisma.notification.findMany({
          where: { orgId: org.id },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          take: 4,
          select: {
            id: true,
            severity: true,
            title: true,
            href: true,
          },
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
        prisma.notification.count({
          where: { orgId: org.id, status: "unread" },
        }),
      ]);

    return {
      ok: true,
      orgName: org.name,
      activeMissionCount,
      openRescueCount,
      activeIntelCount,
      qrfReadyCount,
      unreadNotificationCount,
      missions: missions.map((mission: MissionWithParticipants) => {
        const packageSummary = summarizePackageStatus(mission.participants as MissionParticipantRecord[]);

        return {
          id: mission.id,
          callsign: mission.callsign,
          title: mission.title,
          missionType: mission.missionType,
          status: mission.status,
          priority: mission.priority,
          revisionNumber: mission.revisionNumber,
          areaOfOperation: mission.areaOfOperation,
          participantCount: mission.participants.length,
          packageSummary,
          packageDiscipline: evaluatePackageDiscipline(
            mission.missionType,
            mission.participants as MissionParticipantRecord[],
            mission.lead?.displayName || mission.lead?.handle || "Unassigned",
            packageSummary.readinessLabel,
            packageSummary.readyOrLaunched,
            packageSummary.total,
            packageSummary.open,
            packageSummary.staffedTotal,
          ),
        };
      }),
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
      notifications,
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      activeMissionCount: 0,
      openRescueCount: 0,
      activeIntelCount: 0,
      qrfReadyCount: 0,
      unreadNotificationCount: 0,
      missions: [],
      rescues: [],
      intel: [],
      qrf: [],
      notifications: [],
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
    revisionNumber: number;
    areaOfOperation: string | null;
    missionBrief: string | null;
    participantCount: number;
    packageSummary: PackageSummary;
    packageDiscipline: PackageDiscipline;
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
      include: {
        participants: true,
        lead: {
          select: {
            handle: true,
            displayName: true,
          },
        },
      },
    });

    return {
      ok: true,
      orgName: org.name,
      items: missions.map((mission: MissionWithParticipants) => {
        const packageSummary = summarizePackageStatus(mission.participants as MissionParticipantRecord[]);

        return {
          id: mission.id,
          callsign: mission.callsign,
          title: mission.title,
          missionType: mission.missionType,
          status: mission.status,
          priority: mission.priority,
          revisionNumber: mission.revisionNumber,
          areaOfOperation: mission.areaOfOperation,
          missionBrief: mission.missionBrief,
          participantCount: mission.participants.length,
          packageSummary,
          packageDiscipline: evaluatePackageDiscipline(
            mission.missionType,
            mission.participants as MissionParticipantRecord[],
            mission.lead?.displayName || mission.lead?.handle || "Unassigned",
            packageSummary.readinessLabel,
            packageSummary.readyOrLaunched,
            packageSummary.total,
            packageSummary.open,
            packageSummary.staffedTotal,
          ),
        };
      }),
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
        doctrineTemplate: {
          select: {
            id: true,
            code: true,
            title: true,
            category: true,
            summary: true,
            body: true,
            escalation: true,
          },
        },
        lead: {
          select: {
            handle: true,
            displayName: true,
          },
        },
        participants: {
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        },
        intelLinks: {
          include: {
            intel: {
              select: {
                id: true,
                title: true,
                severity: true,
                reportType: true,
                locationName: true,
                hostileGroup: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
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

    const availableDoctrineTemplates = await prisma.doctrineTemplate.findMany({
      where: {
        orgId: org.id,
      },
      orderBy: [{ isDefault: "desc" }, { category: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        category: true,
        summary: true,
      },
    });

    const availableIntel = await prisma.intelReport.findMany({
      where: {
        orgId: org.id,
        isActive: true,
        missionLinks: {
          none: {
            missionId: mission.id,
          },
        },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        severity: true,
      },
    });

    const [members, qrfEntries] = await Promise.all([
      prisma.orgMember.findMany({
        where: {
          orgId: org.id,
        },
        orderBy: [{ rank: "asc" }, { joinedAt: "asc" }],
        select: {
          title: true,
          user: {
            select: {
              handle: true,
              displayName: true,
              role: true,
            },
          },
        },
      }),
      prisma.qrfReadiness.findMany({
        where: {
          orgId: org.id,
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          callsign: true,
          status: true,
          platform: true,
          locationName: true,
          availableCrew: true,
          notes: true,
        },
      }),
    ]);

    const activeMissionAssignments = await prisma.mission.findMany({
      where: {
        orgId: org.id,
        status: {
          in: ["planning", "ready", "active"],
        },
      },
      select: {
        id: true,
        callsign: true,
        status: true,
        lead: {
          select: {
            handle: true,
            displayName: true,
          },
        },
        participants: {
          select: {
            id: true,
            handle: true,
            role: true,
            platform: true,
            status: true,
            notes: true,
          },
        },
      },
    });

    const packageSummary = summarizePackageStatus(mission.participants as MissionParticipantRecord[]);

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
        revisionNumber: mission.revisionNumber,
        areaOfOperation: mission.areaOfOperation,
        missionBrief: mission.missionBrief,
        closeoutSummary: mission.closeoutSummary,
        aarSummary: mission.aarSummary,
        roeCode: mission.roeCode,
        completedAtLabel: mission.completedAt
          ? mission.completedAt.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
        leadDisplay: mission.lead?.displayName || mission.lead?.handle || "Unassigned",
        updatedAtLabel: mission.updatedAt.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        packageSummary,
        packageDiscipline: evaluatePackageDiscipline(
          mission.missionType,
          mission.participants as MissionParticipantRecord[],
          mission.lead?.displayName || mission.lead?.handle || "Unassigned",
          packageSummary.readinessLabel,
          packageSummary.readyOrLaunched,
          packageSummary.total,
          packageSummary.open,
          packageSummary.staffedTotal,
        ),
        doctrineTemplate: mission.doctrineTemplate,
        availableDoctrineTemplates,
        linkedIntel: mission.intelLinks.map((link) => ({
          id: link.id,
          intelId: link.intel.id,
          title: link.intel.title,
          severity: link.intel.severity,
          reportType: link.intel.reportType,
          locationName: link.intel.locationName,
          hostileGroup: link.intel.hostileGroup,
        })),
        availableIntel,
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
        availableCrew: buildCrewCandidates(members, qrfEntries, activeMissionAssignments, mission.id),
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

export async function getDoctrinePageData(userId: string): Promise<DoctrinePagePayload> {
  try {
    const org = await getOrgForUser(userId);
    if (!org) {
      return { ok: true, orgName: "Guardian", items: [] };
    }

    const templates = await prisma.doctrineTemplate.findMany({
      where: { orgId: org.id },
      orderBy: [{ isDefault: "desc" }, { category: "asc" }, { code: "asc" }],
      include: {
        _count: {
          select: {
            missions: true,
          },
        },
      },
    });

    return {
      ok: true,
      orgName: org.name,
      items: templates.map((template: DoctrineTemplateRecord & { _count: { missions: number } }) => ({
        id: template.id,
        code: template.code,
        title: template.title,
        category: template.category,
        summary: template.summary,
        body: template.body,
        escalation: template.escalation,
        isDefault: template.isDefault,
        missionCount: template._count.missions,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      items: [],
      error: error instanceof Error ? error.message : "Failed to load doctrine.",
    };
  }
}

export async function getRosterPageData(userId: string): Promise<RosterPagePayload> {
  try {
    const org = await getOrgForUser(userId);
    if (!org) {
      return { ok: true, orgName: "Guardian", items: [] };
    }

    const [members, qrfEntries, activeMissionAssignments] = await Promise.all([
      prisma.orgMember.findMany({
        where: {
          orgId: org.id,
        },
        orderBy: [{ rank: "asc" }, { joinedAt: "asc" }],
        select: {
          title: true,
          rank: true,
          user: {
            select: {
              id: true,
              email: true,
              handle: true,
              displayName: true,
              role: true,
              status: true,
            },
          },
        },
      }),
      prisma.qrfReadiness.findMany({
        where: {
          orgId: org.id,
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          callsign: true,
          status: true,
          platform: true,
          locationName: true,
          availableCrew: true,
          notes: true,
        },
      }),
      prisma.mission.findMany({
        where: {
          orgId: org.id,
          status: {
            in: ["planning", "ready", "active"],
          },
        },
        select: {
          id: true,
          callsign: true,
          status: true,
          lead: {
            select: {
              handle: true,
              displayName: true,
            },
          },
          participants: {
            select: {
              id: true,
              handle: true,
              role: true,
              platform: true,
              status: true,
              notes: true,
            },
          },
        },
      }),
    ]);

    // Activity scoring: batch queries for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [participantActivity, logActivity] = await Promise.all([
      prisma.$queryRaw<{ handle: string; count: number; lastActive: Date }[]>`
        SELECT mp."handle", COUNT(*)::int as count, MAX(mp."createdAt") as "lastActive"
        FROM "MissionParticipant" mp
        JOIN "Mission" m ON mp."missionId" = m."id"
        WHERE m."orgId" = ${org.id}
        AND mp."createdAt" >= ${thirtyDaysAgo}
        GROUP BY mp."handle"
      `,
      prisma.$queryRaw<{ authorId: string; count: number; lastActive: Date }[]>`
        SELECT ml."authorId", COUNT(*)::int as count, MAX(ml."createdAt") as "lastActive"
        FROM "MissionLog" ml
        JOIN "Mission" m ON ml."missionId" = m."id"
        WHERE m."orgId" = ${org.id}
        AND ml."authorId" IS NOT NULL
        AND ml."createdAt" >= ${thirtyDaysAgo}
        GROUP BY ml."authorId"
      `,
    ]);

    const participantMap = new Map(
      participantActivity.map((p) => [normalizeHandle(p.handle), p])
    );
    const logMap = new Map(
      logActivity.map((l) => [l.authorId, l])
    );

    // Build userId lookup from members
    const userIdByHandle = new Map(
      members.map((m) => [normalizeHandle(m.user.handle), m.user.id])
    );

    const candidates = buildCrewCandidates(members, qrfEntries, activeMissionAssignments, "");

    const enrichedItems: RosterCrewItem[] = candidates.map((crew) => {
      const nh = normalizeHandle(crew.handle);
      const pActivity = participantMap.get(nh);
      const uid = userIdByHandle.get(nh);
      const lActivity = uid ? logMap.get(uid) : undefined;

      const missionCount = pActivity?.count ?? 0;
      const logCount = lActivity?.count ?? 0;
      const hasCommitments = crew.commitments.length > 0;
      const hasQrf = crew.qrfStatus !== null;

      // Weighted score: missions 40%, logs 30%, active commitments 20%, QRF 10%
      const participationScore = Math.min(missionCount / 3, 1) * 40;
      const logScore = Math.min(logCount / 10, 1) * 30;
      const commitmentScore = hasCommitments ? 20 : 0;
      const qrfScore = hasQrf ? 10 : 0;
      const activityScore = Math.round(participationScore + logScore + commitmentScore + qrfScore);

      // Most recent activity across participation and log authorship
      const dates = [pActivity?.lastActive, lActivity?.lastActive].filter(Boolean) as Date[];
      const lastActive = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

      // Look up member record for admin fields
      const memberRecord = members.find(m => m.user.handle === crew.handle);
      return {
        ...crew,
        userId: memberRecord?.user.id ?? '',
        email: memberRecord?.user.email ?? '',
        rank: memberRecord?.rank ?? 'member',
        status: memberRecord?.user.status ?? 'active',
        activityScore,
        activityTier: computeActivityTier(activityScore),
        lastActiveLabel: lastActive ? formatRelativeTime(lastActive) : null,
        missionCount,
        logCount,
      };
    });

    return {
      ok: true,
      orgName: org.name,
      items: enrichedItems,
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      items: [],
      error: error instanceof Error ? error.message : "Failed to load roster.",
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
    linkedMissions: {
      id: string;
      callsign: string;
      status: string;
    }[];
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
      include: {
        missionLinks: {
          include: {
            mission: {
              select: {
                id: true,
                callsign: true,
                status: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
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
        linkedMissions: (report.missionLinks ?? []).map((link) => ({
          id: link.mission.id,
          callsign: link.mission.callsign,
          status: link.mission.status,
        })),
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
