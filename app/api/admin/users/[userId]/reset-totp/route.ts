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
 * POST /api/admin/users/[userId]/reset-totp
 * Admin-initiated TOTP reset — clears the user's TOTP secret
 * and disables MFA so they can re-enroll.
 * Also revokes all sessions to force re-authentication.
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
    data: {
      totpSecret: null,
      totpEnabled: false,
      sessionsInvalidatedAt: new Date(),
    },
    select: { handle: true, totpEnabled: true },
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "admin_reset_totp",
    targetType: "user",
    targetId: userId,
    metadata: { handle: target.handle },
  });

  log.info("Admin TOTP reset", { targetHandle: target.handle, by: session.handle });

  return NextResponse.json({
    ok: true,
    message: `TOTP cleared and sessions revoked for ${target.handle}. User can re-enroll.`,
  });
}
