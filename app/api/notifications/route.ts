import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { createNotification } from "@/lib/notifications";
import { canManageOperations } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const notificationCreateSchema = z.object({
  category: z.enum(["ops", "intel", "admin", "rescue", "maintenance"]),
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(1000),
  href: z.string().trim().max(200).optional(),
});

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const severity = url.searchParams.get("severity");
  const status = url.searchParams.get("status");

  const where: Record<string, unknown> = { orgId: org.id };
  if (category && category !== "all") where.category = category;
  if (severity && severity !== "all") where.severity = severity;
  if (status && status !== "all") where.status = status;

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const counts = await prisma.notification.groupBy({
    by: ["status"],
    where: { orgId: org.id },
    _count: true,
  });

  const severityCounts = await prisma.notification.groupBy({
    by: ["severity"],
    where: { orgId: org.id, status: "unread" },
    _count: true,
  });

  const unreadCount = counts.find((c) => c.status === "unread")?._count ?? 0;
  const totalCount = counts.reduce((sum, c) => sum + c._count, 0);

  return NextResponse.json({
    ok: true,
    items: notifications.map((n) => ({
      id: n.id,
      category: n.category,
      severity: n.severity,
      title: n.title,
      body: n.body,
      href: n.href,
      status: n.status,
      createdAt: n.createdAt.toISOString(),
      acknowledgedAt: n.acknowledgedAt?.toISOString() ?? null,
    })),
    stats: {
      total: totalCount,
      unread: unreadCount,
      acknowledged: totalCount - unreadCount,
      bySeverity: {
        info: severityCounts.find((c) => c.severity === "info")?._count ?? 0,
        warning: severityCounts.find((c) => c.severity === "warning")?._count ?? 0,
        critical: severityCounts.find((c) => c.severity === "critical")?._count ?? 0,
      },
    },
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Alert creation requires operations authority." }, { status: 403 });
  }

  const payload = notificationCreateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid notification payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const notification = await createNotification({
    orgId: org.id,
    createdById: session.userId,
    category: payload.data.category,
    severity: payload.data.severity,
    title: payload.data.title,
    body: payload.data.body,
    href: payload.data.href || null,
  });

  return NextResponse.json({ ok: true, notification: { id: notification.id } });
}
