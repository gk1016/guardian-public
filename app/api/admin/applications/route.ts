import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { canManageAdministration } from "@/lib/roles";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";

// GET — list applications with optional status filter
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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: any = { orgId: org.id };
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    where.status = status;
  }

  const [items, pendingCount] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.application.count({
      where: { orgId: org.id, status: "pending" },
    }),
  ]);

  return NextResponse.json({ ok: true, items, pendingCount });
}
