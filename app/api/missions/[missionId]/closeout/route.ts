import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";

const missionCloseoutSchema = z.object({
  finalStatus: z.enum(["complete", "aborted"]),
  closeoutSummary: z.string().trim().min(12).max(1200),
  aarSummary: z.string().trim().min(12).max(2400),
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
    return NextResponse.json({ error: "Mission closeout requires command authority." }, { status: 403 });
  }

  const payload = missionCloseoutSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid mission closeout payload." }, { status: 400 });
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
      title: true,
    },
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }

  const [updatedMission] = await prisma.$transaction([
    prisma.mission.update({
      where: { id: mission.id },
      data: {
        status: payload.data.finalStatus,
        completedAt: new Date(),
        closeoutSummary: payload.data.closeoutSummary,
        aarSummary: payload.data.aarSummary,
      },
      select: {
        id: true,
        callsign: true,
        status: true,
        completedAt: true,
      },
    }),
    prisma.missionLog.create({
      data: {
        missionId: mission.id,
        authorId: session.userId,
        entryType: "aar",
        message: `${payload.data.finalStatus.toUpperCase()}: ${payload.data.closeoutSummary}`,
      },
      select: { id: true },
    }),
  ]);

  return NextResponse.json({ ok: true, mission: updatedMission });
}
