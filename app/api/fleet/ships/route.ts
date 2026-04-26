import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const addShipSchema = z.object({
  shipSpecId: z.string().min(1),
  shipName: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/fleet/ships — list org fleet
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const ships = await prisma.fleetShip.findMany({
    where: { orgId: org.id, status: "active" },
    include: {
      shipSpec: {
        select: {
          id: true,
          name: true,
          manufacturer: true,
          classification: true,
          focus: true,
          crewMin: true,
          crewMax: true,
          cargo: true,
          imageUrl: true,
        },
      },
      user: {
        select: { handle: true, displayName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ships });
}

// POST /api/fleet/ships — add ship to member fleet
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const payload = addShipSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  // Verify ship spec exists
  const spec = await prisma.shipSpec.findUnique({
    where: { id: payload.data.shipSpecId },
    select: { id: true, name: true },
  });
  if (!spec) {
    return NextResponse.json({ error: "Ship spec not found." }, { status: 404 });
  }

  const ship = await prisma.fleetShip.create({
    data: {
      userId: session.userId,
      orgId: org.id,
      shipSpecId: payload.data.shipSpecId,
      shipName: payload.data.shipName || null,
      notes: payload.data.notes || null,
    },
  });

  await auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "add_fleet_ship",
    targetType: "fleet_ship",
    targetId: ship.id,
    metadata: { shipSpec: spec.name, shipName: payload.data.shipName },
  });

  return NextResponse.json({ ok: true, ship });
}
