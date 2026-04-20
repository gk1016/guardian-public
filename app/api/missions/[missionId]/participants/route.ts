import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";

const participantCreateSchema = z.object({
  handle: z.string().trim().min(2).max(32),
  role: z.string().trim().min(2).max(40),
  platform: z.string().trim().max(60).optional(),
  status: z.enum(["assigned", "ready", "launched", "rtb"]),
  notes: z.string().trim().max(500).optional(),
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
    return NextResponse.json({ error: "Participant assignment requires command authority." }, { status: 403 });
  }

  const payload = participantCreateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid participant payload." }, { status: 400 });
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

  const participant = await prisma.missionParticipant.create({
    data: {
      missionId: mission.id,
      handle: payload.data.handle.toUpperCase(),
      role: payload.data.role,
      platform: payload.data.platform || null,
      status: payload.data.status,
      notes: payload.data.notes || null,
    },
    select: {
      id: true,
      handle: true,
      role: true,
      platform: true,
      status: true,
      notes: true,
    },
  });

  await prisma.missionLog.create({
    data: {
      missionId: mission.id,
      authorId: session.userId,
      entryType: "package",
      message: `Participant assigned: ${participant.handle} / ${participant.role} / ${participant.status}.`,
    },
  });

  return NextResponse.json({ ok: true, participant });
}
