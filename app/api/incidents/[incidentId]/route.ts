import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/roles";

const incidentUpdateSchema = z.object({
  status: z.enum(["open", "triage", "active", "closed", "archived"]),
  lessonsLearned: z.string().trim().max(1600).optional(),
  actionItems: z.string().trim().max(1600).optional(),
  publicSummary: z.string().trim().max(800).optional(),
});

type RouteContext = {
  params: Promise<{
    incidentId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Incident updates require operations authority." }, { status: 403 });
  }

  const payload = incidentUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid incident update payload." }, { status: 400 });
  }

  const { incidentId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const incident = await prisma.incident.findFirst({
    where: {
      id: incidentId,
      orgId: org.id,
    },
    select: { id: true },
  });

  if (!incident) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  const updated = await prisma.incident.update({
    where: { id: incidentId },
    data: {
      status: payload.data.status,
      lessonsLearned: payload.data.lessonsLearned || null,
      actionItems: payload.data.actionItems || null,
      publicSummary: payload.data.publicSummary || null,
      reviewerId: session.userId,
      closedAt: payload.data.status === "closed" || payload.data.status === "archived" ? new Date() : null,
    },
    select: {
      id: true,
      status: true,
    },
  });

  await createNotification({
    orgId: org.id,
    createdById: session.userId,
    category: "incident",
    severity:
      payload.data.status === "closed" || payload.data.status === "archived"
        ? "info"
        : "warning",
    title: `Incident ${updated.status}`,
    body: `Incident ${incidentId} changed to ${updated.status}.`,
    href: "/incidents",
  });

  return NextResponse.json({ ok: true, incident: updated });
}
