import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/roles";

const intelUpdateSchema = z.object({
  severity: z.number().int().min(1).max(5).optional(),
  confidence: z.enum(["low", "medium", "high", "confirmed"]).optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(1000).optional(),
  hostileGroup: z.string().trim().max(80).optional(),
  locationName: z.string().trim().max(100).optional(),
});

type RouteContext = {
  params: Promise<{
    intelId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Intel updates require operations authority." }, { status: 403 });
  }

  const payload = intelUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
  }

  const { intelId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const existing = await prisma.intelReport.findFirst({
    where: { id: intelId, orgId: org.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Intel report not found." }, { status: 404 });
  }

  const updated = await prisma.intelReport.update({
    where: { id: intelId },
    data: {
      ...(payload.data.severity !== undefined && { severity: payload.data.severity }),
      ...(payload.data.confidence !== undefined && { confidence: payload.data.confidence }),
      ...(payload.data.isActive !== undefined && { isActive: payload.data.isActive }),
      ...(payload.data.description !== undefined && { description: payload.data.description }),
      ...(payload.data.hostileGroup !== undefined && { hostileGroup: payload.data.hostileGroup }),
      ...(payload.data.locationName !== undefined && { locationName: payload.data.locationName }),
    },
    select: { id: true, title: true },
  });

  return NextResponse.json({ ok: true, report: updated });
}
