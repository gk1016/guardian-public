import Link from "next/link";
import { Bell } from "lucide-react";
import { NotificationAckForm } from "@/components/notification-ack-form";
import { NotificationCreateForm } from "@/components/notification-create-form";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { OpsShell } from "@/components/ops-shell";
import { requireSession } from "@/lib/auth";
import { getNotificationPageData } from "@/lib/ops-data";
import { canManageOperations } from "@/lib/roles";

export const dynamic = "force-dynamic";

const severityTone = {
  info: "border-cyan-400/20 bg-cyan-400/8 text-cyan-200",
  warning: "border-amber-400/20 bg-amber-400/8 text-amber-200",
  critical: "border-red-500/20 bg-red-500/8 text-red-200",
};

export default async function NotificationsPage() {
  const session = await requireSession("/notifications");
  const data = await getNotificationPageData(session.userId);
  const canCreateAlert = canManageOperations(session.role);

  return (
    <OpsShell
      currentPath="/notifications"
      section="Notifications"
      title="Ops Alerts"
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      {canCreateAlert ? (
        <CollapsiblePanel label="Send Alert" icon={<Bell size={14} className="text-amber-300" />}>
          <NotificationCreateForm />
        </CollapsiblePanel>
      ) : null}

      <section className="flex flex-col gap-4">
        {data.items.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-white">{item.title}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-slate-500">{item.category} / {item.createdAtLabel}{item.acknowledgedAtLabel ? ` / Ack ${item.acknowledgedAtLabel}` : ""}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${severityTone[item.severity as keyof typeof severityTone] ?? severityTone.info}`}>{item.severity}</span>
                <span className="rounded-[var(--radius-sm)] border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] uppercase text-slate-400">{item.status}</span>
              </div>
            </div>
            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5 text-sm leading-6 text-slate-400">{item.body}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.href ? (
                <Link href={item.href} className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-cyan-400/20 bg-cyan-400/8 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-cyan-200 transition hover:bg-cyan-400/15"><Bell size={12} />Open source</Link>
              ) : null}
              <NotificationAckForm notificationId={item.id} disabled={item.status === "acknowledged"} />
            </div>
          </article>
        ))}
        {data.items.length === 0 ? <p className="text-sm text-slate-500">No alerts queued.</p> : null}
      </section>
    </OpsShell>
  );
}
