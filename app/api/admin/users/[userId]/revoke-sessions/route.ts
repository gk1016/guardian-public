import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageAdministration } from "@/lib/roles";
import { auditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

/**
 * POST /api/admin/users/[userId]/revoke-sessions
 * Immediately invalidate all active sessions for a user
 * without changing their role or status.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const { userId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  // Verify target user belongs to this org
  const membership = await prisma.orgMember.findFirst({
    where: { orgId: org.id, userId },
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "User not found in this organization." }, { status: 404 });
  }

  const target = await prisma.user.update({
    where: { id: userId },
    data: { sessionsInvalidatedAt: new Date() },
    select: { handle: true },
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "revoke_sessions",
    targetType: "user",
    targetId: userId,
    metadata: { handle: target.handle },
  });

  log.info("Sessions revoked", { targetHandle: target.handle, by: session.handle });

  return NextResponse.json({ ok: true, message: `All sessions revoked for ${target.handle}.` });
}
