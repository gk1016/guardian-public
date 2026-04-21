import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { createNotification } from "@/lib/notifications";
import { canManageOperations } from "@/lib/roles";

const notificationCreateSchema = z.object({
  category: z.enum(["ops", "intel", "admin", "rescue", "maintenance"]),
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(1000),
  href: z.string().trim().max(200).optional(),
});

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
