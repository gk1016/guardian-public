import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";

type RouteContext = {
  params: Promise<{
    missionId: string;
    intelId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageMissions(session.role)) {
    return NextResponse.json({ error: "Intel unlink requires command authority." }, { status: 403 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const { missionId, intelId } = await context.params;

  const existingLink = await prisma.missionIntelLink.findFirst({
    where: {
      missionId,
      intelId,
      mission: {
        orgId: org.id,
      },
      intel: {
        orgId: org.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!existingLink) {
    return NextResponse.json({ error: "Intel link not found." }, { status: 404 });
  }

  await prisma.missionIntelLink.delete({
    where: { id: existingLink.id },
  });

  return NextResponse.json({ ok: true, intelId });
}
