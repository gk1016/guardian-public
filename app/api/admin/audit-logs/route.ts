import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageAdministration } from "@/lib/roles";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const url = new URL(request.url);
  const targetType = url.searchParams.get("targetType");
  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("userId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const cursor = url.searchParams.get("cursor");

  const where: Record<string, unknown> = { orgId: org.id };
  if (targetType) where.targetType = targetType;
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (cursor) where.createdAt = { lt: new Date(cursor) };

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      user: {
        select: {
          handle: true,
          displayName: true,
        },
      },
    },
  });

  const nextCursor = logs.length === limit ? logs[logs.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({
    ok: true,
    items: logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      actor: l.user.displayName ?? l.user.handle,
    })),
    nextCursor,
  });
}
