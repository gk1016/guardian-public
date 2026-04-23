import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { acknowledgeNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const notificationUpdateSchema = z.object({
  status: z.enum(["acknowledged"]),
});

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = notificationUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid notification payload." }, { status: 400 });
  }

  const { notificationId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      orgId: org.id,
    },
    select: { id: true },
  });

  if (!notification) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }

  await acknowledgeNotification(notificationId);

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "acknowledge",
    targetType: "notification",
    targetId: notificationId,
  });

  return NextResponse.json({ ok: true });
}
