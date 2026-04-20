import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/roles";

const qrfCreateSchema = z.object({
  callsign: z.string().trim().min(2).max(40),
  status: z.enum(["redcon1", "redcon2", "redcon3", "redcon4"]),
  platform: z.string().trim().max(60).optional(),
  locationName: z.string().trim().max(80).optional(),
  availableCrew: z.number().int().min(1).max(12),
  notes: z.string().trim().max(400).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "QRF management requires operations authority." }, { status: 403 });
  }

  const payload = qrfCreateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid QRF payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const callsign = payload.data.callsign.toUpperCase();
  const existing = await prisma.qrfReadiness.findFirst({
    where: {
      orgId: org.id,
      callsign,
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ error: "QRF callsign already exists." }, { status: 409 });
  }

  const qrf = await prisma.qrfReadiness.create({
    data: {
      orgId: org.id,
      callsign,
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

  return NextResponse.json({ ok: true, qrf });
}
