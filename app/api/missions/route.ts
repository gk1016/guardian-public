import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { getMissionTemplate } from "@/lib/mission-templates";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";

const missionCreateSchema = z.object({
  callsign: z.string().trim().min(2).max(24),
  templateCode: z.string().trim().min(2).max(40).optional(),
  title: z.string().trim().min(4).max(120),
  missionType: z.string().trim().min(3).max(40),
  status: z.enum(["planning", "ready", "active"]),
  priority: z.enum(["routine", "priority", "critical"]),
  areaOfOperation: z.string().trim().max(80).optional(),
  missionBrief: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageMissions(session.role)) {
    return NextResponse.json({ error: "Mission creation requires command authority." }, { status: 403 });
  }

  const payload = missionCreateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid mission payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const template = getMissionTemplate(payload.data.templateCode || payload.data.missionType);
  const doctrineTemplate = await prisma.doctrineTemplate.findFirst({
    where: {
      orgId: org.id,
      code: template.doctrineCode,
    },
  });

  const mission = await prisma.$transaction(async (tx) => {
    const createdMission = await tx.mission.create({
      data: {
        orgId: org.id,
        leadId: session.userId,
        doctrineTemplateId: doctrineTemplate?.id ?? null,
        callsign: payload.data.callsign.toUpperCase(),
        title: payload.data.title,
        missionType: payload.data.missionType,
        status: payload.data.status,
        priority: payload.data.priority,
        areaOfOperation: payload.data.areaOfOperation || null,
        missionBrief: payload.data.missionBrief || null,
        roeCode: doctrineTemplate?.code ?? null,
      },
      select: {
        id: true,
        callsign: true,
        status: true,
        title: true,
      },
    });

    if (template.slots.length > 0) {
      await tx.missionParticipant.createMany({
        data: template.slots.map((slot) => ({
          missionId: createdMission.id,
          handle: "OPEN SLOT",
          role: slot.role,
          platform: slot.platform,
          status: "open",
          notes: slot.notes,
        })),
      });
    }

    await tx.missionLog.create({
      data: {
        missionId: createdMission.id,
        authorId: session.userId,
        entryType: "package",
        message: `Template seeded: ${template.label} / ${template.slots.length} open slot${template.slots.length === 1 ? "" : "s"}.`,
      },
    });

    if (doctrineTemplate) {
      await tx.missionLog.create({
        data: {
          missionId: createdMission.id,
          authorId: session.userId,
          entryType: "doctrine",
          message: `Doctrine attached automatically: ${doctrineTemplate.title} / ${doctrineTemplate.code}.`,
        },
      });
    }

    return createdMission;
  });

  return NextResponse.json({ ok: true, mission });
}
