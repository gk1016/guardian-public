import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";
import { auditLog } from "@/lib/audit";

const missionReopenSchema = z.object({
  status: z.enum(["planning", "ready", "active"]),
  reason: z.string().trim().min(12).max(1200),
});

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
    return NextResponse.json({ error: "Mission reopen requires command authority." }, { status: 403 });
  }

  const payload = missionReopenSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid mission reopen payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const { missionId } = await context.params;

  const mission = await prisma.mission.findFirst({
    where: {
      id: missionId,
      orgId: org.id,
    },
    select: {
      id: true,
      callsign: true,
      status: true,
      revisionNumber: true,
      closeoutSummary: true,
      aarSummary: true,
    },
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }

  if (!["complete", "aborted"].includes(mission.status)) {
    return NextResponse.json({ error: "Only closed missions can be reopened." }, { status: 400 });
  }

  const nextRevision = mission.revisionNumber + 1;
  const archiveLines = [
    `REV ${nextRevision} REOPENED FROM ${mission.status.toUpperCase()}: ${payload.data.reason}`,
    mission.closeoutSummary ? `Archived closeout: ${mission.closeoutSummary}` : null,
    mission.aarSummary ? `Archived AAR: ${mission.aarSummary}` : null,
  ].filter(Boolean);

  const [updatedMission] = await prisma.$transaction([
    prisma.mission.update({
      where: { id: mission.id },
      data: {
        status: payload.data.status,
        revisionNumber: nextRevision,
        completedAt: null,
        closeoutSummary: null,
        aarSummary: null,
      },
      select: {
        id: true,
        callsign: true,
        status: true,
        revisionNumber: true,
      },
    }),
    prisma.missionLog.create({
      data: {
        missionId: mission.id,
        authorId: session.userId,
        entryType: "reopen",
        message: archiveLines.join("\n"),
      },
      select: { id: true },
    }),
  ]);

  await createNotification({
    orgId: org.id,
    createdById: session.userId,
    category: "mission",
    severity: "warning",
    title: `Mission reopened / ${mission.callsign}`,
    body: `${mission.callsign} moved back to ${payload.data.status} for revision ${updatedMission.revisionNumber}.`,
    href: `/missions/${mission.id}`,
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "reopen",
    targetType: "mission",
    targetId: missionId,
    metadata: { callsign: mission.callsign, fromStatus: mission.status, toStatus: payload.data.status },
  });

  return NextResponse.json({ ok: true, mission: updatedMission });
}
