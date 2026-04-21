import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NotificationWriter = PrismaClient | Prisma.TransactionClient;

type NotificationInput = {
  orgId: string;
  createdById?: string | null;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  href?: string | null;
};

export async function createNotification(
  input: NotificationInput,
  writer?: NotificationWriter,
) {
  const db = writer ?? prisma;
  return db.notification.create({
    data: {
      orgId: input.orgId,
      createdById: input.createdById ?? null,
      category: input.category,
      severity: input.severity,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      status: "unread",
    },
  });
}

export async function acknowledgeNotification(
  notificationId: string,
  writer?: NotificationWriter,
) {
  const db = writer ?? prisma;
  return db.notification.update({
    where: { id: notificationId },
    data: {
      status: "acknowledged",
      acknowledgedAt: new Date(),
    },
  });
}
