import Link from "next/link";
import { Bell, ShieldAlert } from "lucide-react";
import { NotificationAckForm } from "@/components/notification-ack-form";
import { OpsShell } from "@/components/ops-shell";
import { requireSession } from "@/lib/auth";
import { getNotificationPageData } from "@/lib/ops-data";

export const dynamic = "force-dynamic";

const severityTone = {
  info: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  critical: "border-red-500/20 bg-red-500/10 text-red-100",
};

export default async function NotificationsPage() {
  const session = await requireSession("/notifications");
  const data = await getNotificationPageData(session.userId);

  return (
    <OpsShell
      currentPath="/notifications"
      section="Notifications"
      title="Ops Alerts"
      description="Unread operational alerts, dispatch changes, rescue warnings, and review items now persist as a real feed."
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {data.error}
        </div>
      ) : null}

      <section className="grid gap-6">
        {data.items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.14em] text-white">
                  {item.title}
                </p>
                <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
                  {item.category} / {item.createdAtLabel}
                  {item.acknowledgedAtLabel ? ` / Acknowledged ${item.acknowledgedAtLabel}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${severityTone[item.severity as keyof typeof severityTone] ?? severityTone.info}`}>
                  {item.severity}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200">
                  {item.status}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-300">
              {item.body}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {item.href ? (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-400/20"
                >
                  <Bell size={14} />
                  Open source
                </Link>
              ) : null}
              <NotificationAckForm
                notificationId={item.id}
                disabled={item.status === "acknowledged"}
              />
            </div>
          </article>
        ))}

        {data.items.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 text-sm text-slate-300">
            No notifications are currently queued.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-slate-300">
        <div className="flex items-center gap-3">
          <ShieldAlert size={16} className="text-amber-300" />
          <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
            Use
          </p>
        </div>
        <p className="mt-4">
          This feed is for actionable operational alerts, not vanity activity spam. If a notice does not change a decision, it does not belong here.
        </p>
      </section>
    </OpsShell>
  );
}
