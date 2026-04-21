import { Bell } from "lucide-react";
import { NotificationCreateForm } from "@/components/notification-create-form";
import { NotificationCenter } from "@/components/notification-center";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { OpsShell } from "@/components/ops-shell";
import { requireSession } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { canManageOperations } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await requireSession("/notifications");
  const org = await getOrgForUser(session.userId);
  const orgName = org?.name ?? "Guardian";
  const canCreate = canManageOperations(session.role);

  let initialItems: {
    id: string;
    category: string;
    severity: string;
    title: string;
    body: string;
    href: string | null;
    status: string;
    createdAt: string;
    acknowledgedAt: string | null;
  }[] = [];

  let initialStats = {
    total: 0,
    unread: 0,
    acknowledged: 0,
    bySeverity: { info: 0, warning: 0, critical: 0 },
  };

  if (org) {
    const [notifications, counts, severityCounts] = await Promise.all([
      prisma.notification.findMany({
        where: { orgId: org.id },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 100,
      }),
      prisma.notification.groupBy({
        by: ["status"],
        where: { orgId: org.id },
        _count: true,
      }),
      prisma.notification.groupBy({
        by: ["severity"],
        where: { orgId: org.id, status: "unread" },
        _count: true,
      }),
    ]);

    initialItems = notifications.map((n) => ({
      id: n.id,
      category: n.category,
      severity: n.severity,
      title: n.title,
      body: n.body,
      href: n.href,
      status: n.status,
      createdAt: n.createdAt.toISOString(),
      acknowledgedAt: n.acknowledgedAt?.toISOString() ?? null,
    }));

    const unreadCount = counts.find((c) => c.status === "unread")?._count ?? 0;
    const totalCount = counts.reduce((sum, c) => sum + c._count, 0);

    initialStats = {
      total: totalCount,
      unread: unreadCount,
      acknowledged: totalCount - unreadCount,
      bySeverity: {
        info: severityCounts.find((c) => c.severity === "info")?._count ?? 0,
        warning: severityCounts.find((c) => c.severity === "warning")?._count ?? 0,
        critical: severityCounts.find((c) => c.severity === "critical")?._count ?? 0,
      },
    };
  }

  return (
    <OpsShell
      currentPath="/notifications"
      section="Notifications"
      title="Ops Alerts"
      orgName={orgName}
      session={session}
    >
      {canCreate ? (
        <CollapsiblePanel label="Send Alert" icon={<Bell size={14} className="text-amber-300" />}>
          <NotificationCreateForm />
        </CollapsiblePanel>
      ) : null}

      <NotificationCenter
        initialItems={initialItems}
        initialStats={initialStats}
        canCreate={canCreate}
      />
    </OpsShell>
  );
}
