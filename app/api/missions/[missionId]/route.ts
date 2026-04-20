import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";

const missionUpdateSchema = z.object({
  callsign: z.string().trim().min(2).max(24),
  title: z.string().trim().min(4).max(120),
  missionType: z.string().trim().min(3).max(40),
  status: z.enum(["planning", "ready", "active", "complete", "aborted"]),
  priority: z.enum(["routine", "priority", "critical"]),
  areaOfOperation: z.string().trim().max(80).optional(),
  missionBrief: z.string().trim().max(2000).optional(),
});

type RouteContext = {
  params: Promise<{
    missionId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageMissions(session.role)) {
    return NextResponse.json({ error: "Mission update requires command authority." }, { status: 403 });
  }

  const payload = missionUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid mission payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const { missionId } = await context.params;

  const existingMission = await prisma.mission.findFirst({
    where: {
      id: missionId,
      orgId: org.id,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existingMission) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }

  const mission = await prisma.mission.update({
    where: { id: missionId },
    data: {
      callsign: payload.data.callsign.toUpperCase(),
      title: payload.data.title,
      missionType: payload.data.missionType,
      status: payload.data.status,
      priority: payload.data.priority,
      areaOfOperation: payload.data.areaOfOperation || null,
      missionBrief: payload.data.missionBrief || null,
      completedAt:
        payload.data.status === "complete"
          ? new Date()
          : existingMission.status === "complete"
            ? null
            : undefined,
    },
    select: {
      id: true,
      callsign: true,
      status: true,
      title: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, mission });
}
