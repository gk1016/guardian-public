import { prisma } from "@/lib/prisma";
import { getOrgForUser } from "@/lib/guardian-data";

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "Pending";
  }

  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type PagePayload<T> = {
  ok: boolean;
  orgName: string;
  items: T[];
  error?: string;
};

type SelectOption = {
  id: string;
  label: string;
  detail?: string | null;
};

export type QrfPagePayload = PagePayload<{
  id: string;
  callsign: string;
  status: string;
  platform: string | null;
  locationName: string | null;
  availableCrew: number;
  notes: string | null;
  dispatches: {
    id: string;
    status: string;
    notes: string | null;
    targetLabel: string;
    targetHref: string | null;
    dispatchedAtLabel: string;
    arrivedAtLabel: string | null;
    rtbAtLabel: string | null;
  }[];
}>;

export type RescueWorkflowPayload = PagePayload<{
  id: string;
  survivorHandle: string;
  locationName: string | null;
  status: string;
  urgency: string;
  threatSummary: string | null;
  rescueNotes: string | null;
  survivorCondition: string | null;
  outcomeSummary: string | null;
  escortRequired: boolean;
  medicalRequired: boolean;
  offeredPayment: number | null;
  requesterDisplay: string;
  operatorId: string;
  operatorDisplay: string;
  dispatches: {
    id: string;
    qrfCallsign: string;
    status: string;
    platform: string | null;
    dispatchedAtLabel: string;
    notes: string | null;
  }[];
}>;

export type IncidentPagePayload = PagePayload<{
  id: string;
  title: string;
  category: string;
  severity: number;
  status: string;
  summary: string;
  lessonsLearned: string | null;
  actionItems: string | null;
  publicSummary: string | null;
  missionLabel: string | null;
  rescueLabel: string | null;
  reporterDisplay: string;
  reviewerDisplay: string;
  closedAtLabel: string | null;
  updatedAtLabel: string;
}>;

export async function getQrfPageData(
  userId: string,
): Promise<QrfPagePayload & { missionOptions: SelectOption[]; rescueOptions: SelectOption[] }> {
  try {
    const org = await getOrgForUser(userId);
    if (!org) {
      return {
        ok: true,
        orgName: "Guardian",
        items: [],
        missionOptions: [],
        rescueOptions: [],
      };
    }

    const [qrf, missions, rescues] = await Promise.all([
      prisma.qrfReadiness.findMany({
        where: { orgId: org.id },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        include: {
          dispatches: {
            orderBy: { dispatchedAt: "desc" },
            take: 6,
            include: {
              mission: {
                select: {
                  id: true,
                  callsign: true,
                  status: true,
                },
              },
              rescue: {
                select: {
                  id: true,
                  survivorHandle: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      prisma.mission.findMany({
        where: {
          orgId: org.id,
          status: { in: ["planning", "ready", "active"] },
        },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          callsign: true,
          title: true,
          status: true,
        },
      }),
      prisma.rescueRequest.findMany({
        where: {
          orgId: org.id,
          status: { in: ["open", "dispatching", "en_route", "on_scene"] },
        },
        orderBy: [{ urgency: "asc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          survivorHandle: true,
          locationName: true,
          status: true,
        },
      }),
    ]);

    return {
      ok: true,
      orgName: org.name,
      missionOptions: missions.map((mission) => ({
        id: mission.id,
        label: `${mission.callsign} / ${mission.title}`,
        detail: mission.status,
      })),
      rescueOptions: rescues.map((rescue) => ({
        id: rescue.id,
        label: rescue.survivorHandle,
        detail: `${rescue.status} / ${rescue.locationName ?? "location pending"}`,
      })),
      items: qrf.map((entry) => ({
        id: entry.id,
        callsign: entry.callsign,
        status: entry.status,
        platform: entry.platform,
        locationName: entry.locationName,
        availableCrew: entry.availableCrew,
        notes: entry.notes,
        dispatches: entry.dispatches.map((dispatch) => {
          const targetLabel = dispatch.mission
            ? `${dispatch.mission.callsign} / ${dispatch.mission.status}`
            : dispatch.rescue
              ? `${dispatch.rescue.survivorHandle} / ${dispatch.rescue.status}`
              : "Unlinked target";

          const targetHref = dispatch.mission
            ? `/missions/${dispatch.mission.id}`
            : dispatch.rescue
              ? `/rescues#${dispatch.rescue.id}`
              : null;

          return {
            id: dispatch.id,
            status: dispatch.status,
            notes: dispatch.notes,
            targetLabel,
            targetHref,
            dispatchedAtLabel: formatDateTime(dispatch.dispatchedAt),
            arrivedAtLabel: dispatch.arrivedAt ? formatDateTime(dispatch.arrivedAt) : null,
            rtbAtLabel: dispatch.rtbAt ? formatDateTime(dispatch.rtbAt) : null,
          };
        }),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      items: [],
      missionOptions: [],
      rescueOptions: [],
      error: error instanceof Error ? error.message : "Failed to load QRF board.",
    };
  }
}

export async function getRescueWorkflowData(
  userId: string,
): Promise<RescueWorkflowPayload & { operatorOptions: SelectOption[] }> {
  try {
    const org = await getOrgForUser(userId);
    if (!org) {
      return {
        ok: true,
        orgName: "Guardian",
        items: [],
        operatorOptions: [],
      };
    }

    const [rescues, operators] = await Promise.all([
      prisma.rescueRequest.findMany({
        where: { orgId: org.id },
        orderBy: [{ urgency: "asc" }, { updatedAt: "desc" }],
        include: {
          requester: {
            select: {
              handle: true,
              displayName: true,
            },
          },
          operator: {
            select: {
              handle: true,
              displayName: true,
            },
          },
          dispatches: {
            orderBy: { dispatchedAt: "desc" },
            include: {
              qrf: {
                select: {
                  callsign: true,
                  platform: true,
                },
              },
            },
          },
        },
      }),
      prisma.orgMember.findMany({
        where: { orgId: org.id },
        orderBy: [{ rank: "asc" }, { joinedAt: "asc" }],
        select: {
          user: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      ok: true,
      orgName: org.name,
      operatorOptions: operators.map((entry) => ({
        id: entry.user.id,
        label: entry.user.displayName ?? entry.user.handle,
        detail: `${entry.user.handle} / ${entry.user.role}`,
      })),
      items: rescues.map((rescue) => ({
        id: rescue.id,
        survivorHandle: rescue.survivorHandle,
        locationName: rescue.locationName,
        status: rescue.status,
        urgency: rescue.urgency,
        threatSummary: rescue.threatSummary,
        rescueNotes: rescue.rescueNotes,
        survivorCondition: rescue.survivorCondition,
        outcomeSummary: rescue.outcomeSummary,
        escortRequired: rescue.escortRequired,
        medicalRequired: rescue.medicalRequired,
        offeredPayment: rescue.offeredPayment,
        requesterDisplay: rescue.requester.displayName ?? rescue.requester.handle,
        operatorId: rescue.operatorId ?? "",
        operatorDisplay: rescue.operator
          ? rescue.operator.displayName ?? rescue.operator.handle
          : "Unassigned",
        dispatches: rescue.dispatches.map((dispatch) => ({
          id: dispatch.id,
          qrfCallsign: dispatch.qrf.callsign,
          status: dispatch.status,
          platform: dispatch.qrf.platform,
          dispatchedAtLabel: formatDateTime(dispatch.dispatchedAt),
          notes: dispatch.notes,
        })),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      items: [],
      operatorOptions: [],
      error: error instanceof Error ? error.message : "Failed to load rescue workflow.",
    };
  }
}

export async function getIncidentPageData(
  userId: string,
): Promise<IncidentPagePayload & { missionOptions: SelectOption[]; rescueOptions: SelectOption[] }> {
  try {
    const org = await getOrgForUser(userId);
    if (!org) {
      return {
        ok: true,
        orgName: "Guardian",
        items: [],
        missionOptions: [],
        rescueOptions: [],
      };
    }

    const [incidents, missions, rescues] = await Promise.all([
      prisma.incident.findMany({
        where: { orgId: org.id },
        orderBy: [{ status: "asc" }, { severity: "desc" }, { updatedAt: "desc" }],
        include: {
          mission: {
            select: {
              callsign: true,
              status: true,
            },
          },
          rescue: {
            select: {
              survivorHandle: true,
              status: true,
            },
          },
          reporter: {
            select: {
              handle: true,
              displayName: true,
            },
          },
          reviewer: {
            select: {
              handle: true,
              displayName: true,
            },
          },
        },
      }),
      prisma.mission.findMany({
        where: { orgId: org.id },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          callsign: true,
          status: true,
        },
      }),
      prisma.rescueRequest.findMany({
        where: { orgId: org.id },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          survivorHandle: true,
          status: true,
        },
      }),
    ]);

    return {
      ok: true,
      orgName: org.name,
      missionOptions: missions.map((mission) => ({
        id: mission.id,
        label: mission.callsign,
        detail: mission.status,
      })),
      rescueOptions: rescues.map((rescue) => ({
        id: rescue.id,
        label: rescue.survivorHandle,
        detail: rescue.status,
      })),
      items: incidents.map((incident) => ({
        id: incident.id,
        title: incident.title,
        category: incident.category,
        severity: incident.severity,
        status: incident.status,
        summary: incident.summary,
        lessonsLearned: incident.lessonsLearned,
        actionItems: incident.actionItems,
        publicSummary: incident.publicSummary,
        missionLabel: incident.mission
          ? `${incident.mission.callsign} / ${incident.mission.status}`
          : null,
        rescueLabel: incident.rescue
          ? `${incident.rescue.survivorHandle} / ${incident.rescue.status}`
          : null,
        reporterDisplay: incident.reporter.displayName ?? incident.reporter.handle,
        reviewerDisplay: incident.reviewer
          ? incident.reviewer.displayName ?? incident.reviewer.handle
          : "Pending review",
        closedAtLabel: incident.closedAt ? formatDateTime(incident.closedAt) : null,
        updatedAtLabel: formatDateTime(incident.updatedAt),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      orgName: "Guardian",
      items: [],
      missionOptions: [],
      rescueOptions: [],
      error: error instanceof Error ? error.message : "Failed to load incidents.",
    };
  }
}

export async function getPublicAarData() {
  const org = await prisma.organization.findFirst({
    where: { isPublic: true },
    orderBy: { createdAt: "asc" },
  });

  if (!org) {
    return {
      orgName: "Guardian",
      incidents: [],
      missions: [],
    };
  }

  const [incidents, missions] = await Promise.all([
    prisma.incident.findMany({
      where: {
        orgId: org.id,
        status: { in: ["closed", "archived"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        category: true,
        publicSummary: true,
        lessonsLearned: true,
        updatedAt: true,
      },
    }),
    prisma.mission.findMany({
      where: {
        orgId: org.id,
        status: { in: ["complete", "aborted"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        callsign: true,
        title: true,
        aarSummary: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    orgName: org.name,
    incidents: incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      category: incident.category,
      summary: incident.publicSummary ?? incident.lessonsLearned ?? "Review complete.",
      updatedAtLabel: formatDateTime(incident.updatedAt),
    })),
    missions: missions.map((mission) => ({
      id: mission.id,
      callsign: mission.callsign,
      title: mission.title,
      aarSummary: mission.aarSummary ?? "After-action review pending publication.",
      updatedAtLabel: formatDateTime(mission.updatedAt),
    })),
  };
}
