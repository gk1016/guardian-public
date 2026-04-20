import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/roles";

const rescueUpdateSchema = z.object({
  status: z.enum(["open", "dispatching", "en_route", "on_scene", "recovered", "closed", "cancelled"]),
  operatorId: z.string().trim().optional(),
  survivorCondition: z.string().trim().max(400).optional(),
  rescueNotes: z.string().trim().max(2000).optional(),
  outcomeSummary: z.string().trim().max(1200).optional(),
});

type RouteContext = {
  params: Promise<{
    rescueId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Rescue updates require operations authority." }, { status: 403 });
  }

  const payload = rescueUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid rescue update payload." }, { status: 400 });
  }

  const { rescueId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const rescue = await prisma.rescueRequest.findFirst({
    where: {
      id: rescueId,
      orgId: org.id,
    },
    select: { id: true },
  });

  if (!rescue) {
    return NextResponse.json({ error: "Rescue request not found." }, { status: 404 });
  }

  const updated = await prisma.rescueRequest.update({
    where: { id: rescueId },
    data: {
      status: payload.data.status,
      operatorId: payload.data.operatorId || null,
      survivorCondition: payload.data.survivorCondition || null,
      rescueNotes: payload.data.rescueNotes || null,
      outcomeSummary: payload.data.outcomeSummary || null,
    },
    select: {
      id: true,
      status: true,
    },
  });

  return NextResponse.json({ ok: true, rescue: updated });
}
