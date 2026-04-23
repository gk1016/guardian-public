import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";
import { auditLog } from "@/lib/audit";

const transitionSchema = z.object({
  targetStatus: z.enum(["planning", "ready", "active", "aborted"]),
});

/** Valid transitions: source → allowed targets */
const STATE_MACHINE: Record<string, string[]> = {
  planning: ["ready", "aborted"],
  ready: ["active", "planning", "aborted"],
  active: ["planning", "aborted"],
  // complete and aborted are terminal — use closeout API for complete
};

type RouteContext = {
  params: Promise<{
    missionId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageMissions(session.role)) {
    return NextResponse.json({ error: "Mission transitions require command authority." }, { status: 403 });
  }

  const payload = transitionSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid transition payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const { missionId } = await context.params;
  const { targetStatus } = payload.data;

  const mission = await prisma.mission.findFirst({
    where: {
      id: missionId,
      orgId: org.id,
    },
    select: {
      id: true,
      callsign: true,
      title: true,
      status: true,
      revisionNumber: true,
      participants: {
        select: {
          id: true,
          status: true,
          handle: true,
        },
      },
    },
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }

  // Validate state machine
  const allowed = STATE_MACHINE[mission.status];
  if (!allowed || !allowed.includes(targetStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${mission.status} to ${targetStatus}.` },
      { status: 422 },
    );
  }

  // Validate package readiness for specific transitions
  if (targetStatus === "ready") {
    const assignedCount = mission.participants.filter(
      (p) => p.status !== "open" && p.handle !== "OPEN SLOT",
    ).length;
    if (assignedCount < 1) {
      return NextResponse.json(
        { error: "Ready check failed: at least 1 assigned participant required." },
        { status: 422 },
      );
    }
  }

  if (targetStatus === "active") {
    const readyCount = mission.participants.filter(
      (p) => p.status === "ready" || p.status === "launched",
    ).length;
    if (readyCount < 1) {
      return NextResponse.json(
        { error: "Activation failed: at least 1 ready or launched participant required." },
        { status: 422 },
      );
    }
  }

  // Build transition data
  const transitionLabel = `${mission.status} → ${targetStatus}`;
  const now = new Date();
  const updateData: Record<string, unknown> = {
    status: targetStatus,
    revisionNumber: mission.revisionNumber + 1,
  };

  if (targetStatus === "active") {
    updateData.startsAt = now;
  }
  if (targetStatus === "planning") {
    updateData.startsAt = null; // stand-down clears start time
  }
  if (targetStatus === "aborted") {
    updateData.completedAt = now;
  }

  // Execute transition in a transaction
  const [updatedMission] = await prisma.$transaction([
    prisma.mission.update({
      where: { id: mission.id },
      data: updateData,
      select: {
        id: true,
        callsign: true,
        status: true,
        revisionNumber: true,
        startsAt: true,
        completedAt: true,
      },
    }),
    prisma.missionLog.create({
      data: {
        missionId: mission.id,
        authorId: session.userId,
        entryType: "status",
        message: `Status transition: ${transitionLabel}. Rev ${mission.revisionNumber + 1}.`,
      },
      select: { id: true },
    }),
  ]);

  // Notification severity based on transition type
  const severity =
    targetStatus === "aborted" ? "warning" :
    targetStatus === "active" ? "critical" :
    "info";

  const verbMap: Record<string, string> = {
    ready: "passed ready check",
    active: "activated",
    planning: "stood down to planning",
    aborted: "aborted",
  };

  await createNotification({
    orgId: org.id,
    createdById: session.userId,
    category: "mission",
    severity,
    title: `${mission.callsign} ${verbMap[targetStatus]}`,
    body: `${mission.title} / ${transitionLabel}`,
    href: `/missions/${mission.id}`,
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "transition",
    targetType: "mission",
    targetId: missionId,
    metadata: { callsign: mission.callsign, from: mission.status, to: targetStatus },
  });

  return NextResponse.json({ ok: true, mission: updatedMission });
}
