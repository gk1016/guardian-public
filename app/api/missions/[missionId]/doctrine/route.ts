import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";

const missionDoctrineSchema = z.object({
  doctrineTemplateId: z.string().trim().nullable(),
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
    return NextResponse.json({ error: "Doctrine assignment requires command authority." }, { status: 403 });
  }

  const payload = missionDoctrineSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid doctrine assignment payload." }, { status: 400 });
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
    },
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }

  let doctrineTemplateId: string | null = null;
  let roeCode: string | null = null;
  let doctrineTitle: string | null = null;

  if (payload.data.doctrineTemplateId) {
    const doctrine = await prisma.doctrineTemplate.findFirst({
      where: {
        id: payload.data.doctrineTemplateId,
        orgId: org.id,
      },
      select: {
        id: true,
        code: true,
        title: true,
      },
    });

    if (!doctrine) {
      return NextResponse.json({ error: "Doctrine template not found." }, { status: 404 });
    }

    doctrineTemplateId = doctrine.id;
    roeCode = doctrine.code;
    doctrineTitle = doctrine.title;
  }

  const [updatedMission] = await prisma.$transaction([
    prisma.mission.update({
      where: { id: mission.id },
      data: {
        doctrineTemplateId,
        roeCode,
      },
      select: {
        id: true,
        callsign: true,
        roeCode: true,
        doctrineTemplate: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
    }),
    prisma.missionLog.create({
      data: {
        missionId: mission.id,
        authorId: session.userId,
        entryType: "doctrine",
        message: doctrineTitle
          ? `Doctrine attached: ${doctrineTitle} (${roeCode}).`
          : "Doctrine attachment cleared from mission package.",
      },
      select: { id: true },
    }),
  ]);

  return NextResponse.json({ ok: true, mission: updatedMission });
}
