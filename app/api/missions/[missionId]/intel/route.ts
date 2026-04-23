import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";
import { auditLog } from "@/lib/audit";

const missionIntelSchema = z.object({
  intelId: z.string().min(1),
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
    return NextResponse.json({ error: "Intel linkage requires command authority." }, { status: 403 });
  }

  const payload = missionIntelSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid intel linkage payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const { missionId } = await context.params;

  const [mission, intel] = await Promise.all([
    prisma.mission.findFirst({
      where: {
        id: missionId,
        orgId: org.id,
      },
      select: { id: true },
    }),
    prisma.intelReport.findFirst({
      where: {
        id: payload.data.intelId,
        orgId: org.id,
      },
      select: { id: true, title: true },
    }),
  ]);

  if (!mission) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }

  if (!intel) {
    return NextResponse.json({ error: "Intel report not found." }, { status: 404 });
  }

  const link = await prisma.missionIntelLink.upsert({
    where: {
      missionId_intelId: {
        missionId: mission.id,
        intelId: intel.id,
      },
    },
    update: {},
    create: {
      missionId: mission.id,
      intelId: intel.id,
    },
    select: {
      id: true,
      intel: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "link",
    targetType: "mission_intel",
    targetId: missionId,
    metadata: { intelId: intel.id },
  });

  return NextResponse.json({ ok: true, link });
}
