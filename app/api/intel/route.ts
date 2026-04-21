import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/roles";

const intelCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  reportType: z.enum(["pirate_sighting", "route_hazard", "ganker_activity", "sector_control", "intel_tip"]),
  description: z.string().trim().max(1000).optional(),
  severity: z.number().int().min(1).max(5),
  locationName: z.string().trim().max(100).optional(),
  starSystem: z.string().trim().max(60).optional(),
  hostileGroup: z.string().trim().max(80).optional(),
  confidence: z.enum(["low", "medium", "high", "confirmed"]),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Intel filing requires operations authority." }, { status: 403 });
  }

  const payload = intelCreateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid intel payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const report = await prisma.intelReport.create({
    data: {
      orgId: org.id,
      title: payload.data.title.toUpperCase(),
      reportType: payload.data.reportType,
      description: payload.data.description || null,
      severity: payload.data.severity,
      locationName: payload.data.locationName || null,
      starSystem: payload.data.starSystem || null,
      hostileGroup: payload.data.hostileGroup || null,
      confidence: payload.data.confidence,
      tags: payload.data.tags ?? [],
      isActive: true,
      observedAt: new Date(),
    },
    select: {
      id: true,
      title: true,
      severity: true,
    },
  });

  return NextResponse.json({ ok: true, report });
}
