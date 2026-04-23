import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";
import { auditLog } from "@/lib/audit";

const missionLogSchema = z.object({
  entryType: z.enum(["status", "contact", "command", "aar"]),
  message: z.string().trim().min(4).max(1200),
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
    return NextResponse.json({ error: "Mission log updates require command authority." }, { status: 403 });
  }

  const payload = missionLogSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid mission log payload." }, { status: 400 });
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
    },
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }

  const log = await prisma.missionLog.create({
    data: {
      missionId: mission.id,
      authorId: session.userId,
      entryType: payload.data.entryType,
      message: payload.data.message,
    },
    select: {
      id: true,
      entryType: true,
      message: true,
      createdAt: true,
    },
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "create",
    targetType: "mission_log",
    targetId: log.id,
    metadata: { missionId, entryType: payload.data.entryType },
  });

  return NextResponse.json({ ok: true, log });
}
