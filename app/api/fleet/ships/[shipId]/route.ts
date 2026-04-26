import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { canManageAdministration } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

// DELETE /api/fleet/ships/:shipId — remove ship from fleet
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ shipId: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { shipId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const ship = await prisma.fleetShip.findUnique({
    where: { id: shipId },
    include: { shipSpec: { select: { name: true } } },
  });

  if (!ship || ship.orgId !== org.id) {
    return NextResponse.json({ error: "Ship not found." }, { status: 404 });
  }

  // Members can remove their own ships; admins can remove any
  if (ship.userId !== session.userId && !canManageAdministration(session.role)) {
    return NextResponse.json({ error: "You can only remove your own ships." }, { status: 403 });
  }

  await prisma.fleetShip.delete({ where: { id: shipId } });

  await auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "remove_fleet_ship",
    targetType: "fleet_ship",
    targetId: shipId,
    metadata: { shipSpec: ship.shipSpec.name, shipName: ship.shipName },
  });

  return NextResponse.json({ ok: true });
}
