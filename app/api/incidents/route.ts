import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/roles";

const incidentCreateSchema = z.object({
  title: z.string().trim().min(4).max(140),
  category: z.string().trim().min(3).max(60),
  severity: z.number().int().min(1).max(5),
  status: z.enum(["open", "triage", "active", "closed"]),
  missionId: z.string().trim().optional(),
  rescueId: z.string().trim().optional(),
  summary: z.string().trim().min(12).max(2400),
  lessonsLearned: z.string().trim().max(1600).optional(),
  actionItems: z.string().trim().max(1600).optional(),
  publicSummary: z.string().trim().max(800).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Incident reporting requires operations authority." }, { status: 403 });
  }

  const payload = incidentCreateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid incident payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  if (payload.data.missionId) {
    const mission = await prisma.mission.findFirst({
      where: {
        id: payload.data.missionId,
        orgId: org.id,
      },
      select: { id: true },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission link is invalid." }, { status: 404 });
    }
  }

  if (payload.data.rescueId) {
    const rescue = await prisma.rescueRequest.findFirst({
      where: {
        id: payload.data.rescueId,
        orgId: org.id,
      },
      select: { id: true },
    });
    if (!rescue) {
      return NextResponse.json({ error: "Rescue link is invalid." }, { status: 404 });
    }
  }

  const incident = await prisma.incident.create({
    data: {
      orgId: org.id,
      missionId: payload.data.missionId || null,
      rescueId: payload.data.rescueId || null,
      reporterId: session.userId,
      reviewerId: payload.data.status === "closed" ? session.userId : null,
      title: payload.data.title,
      category: payload.data.category,
      severity: payload.data.severity,
      status: payload.data.status,
      summary: payload.data.summary,
      lessonsLearned: payload.data.lessonsLearned || null,
      actionItems: payload.data.actionItems || null,
      publicSummary: payload.data.publicSummary || null,
      closedAt: payload.data.status === "closed" ? new Date() : null,
    },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });

  return NextResponse.json({ ok: true, incident });
}
