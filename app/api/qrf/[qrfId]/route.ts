import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/roles";

const qrfUpdateSchema = z.object({
  status: z.enum(["redcon1", "redcon2", "redcon3", "redcon4", "tasked", "launched", "rtb"]),
  platform: z.string().trim().max(60).optional(),
  locationName: z.string().trim().max(80).optional(),
  availableCrew: z.number().int().min(1).max(12),
  notes: z.string().trim().max(400).optional(),
});

type RouteContext = {
  params: Promise<{
    qrfId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "QRF management requires operations authority." }, { status: 403 });
  }

  const payload = qrfUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid QRF update payload." }, { status: 400 });
  }

  const { qrfId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const qrf = await prisma.qrfReadiness.findFirst({
    where: {
      id: qrfId,
      orgId: org.id,
    },
    select: { id: true },
  });

  if (!qrf) {
    return NextResponse.json({ error: "QRF asset not found." }, { status: 404 });
  }

  const updated = await prisma.qrfReadiness.update({
    where: { id: qrfId },
    data: {
      status: payload.data.status,
      platform: payload.data.platform || null,
      locationName: payload.data.locationName || null,
      availableCrew: payload.data.availableCrew,
      notes: payload.data.notes || null,
    },
    select: {
      id: true,
      callsign: true,
      status: true,
    },
  });

  return NextResponse.json({ ok: true, qrf: updated });
}
