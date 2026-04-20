import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";

const participantUpdateSchema = z.object({
  status: z.enum(["assigned", "ready", "launched", "rtb"]),
});

type RouteContext = {
  params: Promise<{
    missionId: string;
    participantId: string;
  }>;
};

async function getScopedParticipant(
  userId: string,
  missionId: string,
  participantId: string,
) {
  const org = await getOrgForUser(userId);
  if (!org) {
    return { org: null, participant: null };
  }

  const participant = await prisma.missionParticipant.findFirst({
    where: {
      id: participantId,
      missionId,
      mission: {
        orgId: org.id,
      },
    },
    select: {
      id: true,
      missionId: true,
    },
  });

  return { org, participant };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageMissions(session.role)) {
    return NextResponse.json({ error: "Participant updates require command authority." }, { status: 403 });
  }

  const payload = participantUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid participant payload." }, { status: 400 });
  }

  const { missionId, participantId } = await context.params;
  const { org, participant } = await getScopedParticipant(session.userId, missionId, participantId);

  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  if (!participant) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  const updatedParticipant = await prisma.missionParticipant.update({
    where: { id: participantId },
    data: {
      status: payload.data.status,
    },
    select: {
      id: true,
      handle: true,
      status: true,
    },
  });

  return NextResponse.json({ ok: true, participant: updatedParticipant });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageMissions(session.role)) {
    return NextResponse.json({ error: "Participant removal requires command authority." }, { status: 403 });
  }

  const { missionId, participantId } = await context.params;
  const { org, participant } = await getScopedParticipant(session.userId, missionId, participantId);

  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  if (!participant) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  await prisma.missionParticipant.delete({
    where: { id: participantId },
  });

  return NextResponse.json({ ok: true, participantId });
}
