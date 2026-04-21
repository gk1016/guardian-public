import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookCheck,
  Clock3,
  Crosshair,
  Siren,
} from "lucide-react";
import { getCommandOverview } from "@/lib/guardian-data";
import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const session = await requireSession("/command");
  const data = await getCommandOverview(session.userId);

  return (
    <OpsShell
      currentPath="/command"
      section="Command Deck"
      title="Watch Floor"
      description="Guardian is now reading seeded operational data from Postgres behind a signed session cookie and middleware gate."
      orgName={data.orgName}
      session={session}
    >
      <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Active Missions</p>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                {data.activeMissionCount.toString().padStart(2, "0")}
              </p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">QRF Posture</p>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                {data.qrfReadyCount.toString().padStart(2, "0")}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-100">Open Rescue</p>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                {data.openRescueCount.toString().padStart(2, "0")}
              </p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-red-100">Unread Alerts</p>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                {data.unreadNotificationCount.toString().padStart(2, "0")}
              </p>
            </div>
      </div>

        {data.error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {data.error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.18em] text-white">
                  Mission Board
                </p>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                  Current stack and status gates
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {data.missions.map((mission) => (
                <article
                  key={mission.id}
                  className="rounded-xl border border-white/10 bg-white/4 px-5 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
                        {mission.callsign}
                      </p>
                      <p className="mt-1 text-sm uppercase tracking-[0.16em] text-slate-400">
                        {mission.missionType}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">
                      {mission.status}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{mission.title}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {mission.packageSummary.readyOrLaunched}/{mission.participantCount} ready or launched / AO {mission.areaOfOperation ?? "pending"}
                  </p>
                  {mission.packageDiscipline.warnings.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-200">
                        <AlertTriangle size={14} />
                        Package alert
                      </div>
                      <p className="mt-2 leading-7">{mission.packageDiscipline.warnings[0]}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <Siren className="text-cyan-300" size={20} />
                <div>
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.18em] text-white">
                    QRF Board
                  </p>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                    Availability and launch posture
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {data.qrf.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3"
                  >
                    <div>
                      <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.14em] text-white">
                        {entry.callsign}
                      </p>
                      <p className="text-sm text-slate-400">
                        {entry.platform ?? "Platform pending"} / Crew {entry.availableCrew}
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                      {entry.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <Crosshair className="text-red-300" size={20} />
                <div>
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.18em] text-white">
                    Threat Summary
                  </p>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                    Intelligence queue
                  </p>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {data.intel.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3 text-sm leading-7 text-slate-200"
                  >
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="mt-1 text-slate-300">
                      {item.locationName ?? "Unknown location"} / {item.hostileGroup ?? "Unconfirmed hostile"}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center gap-3">
              <Activity size={18} className="text-amber-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Live Modules
              </p>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
              <li>
                <Link href="/missions" className="transition hover:text-white">Mission board</Link>
              </li>
              <li>
                <Link href="/qrf" className="transition hover:text-white">QRF dispatch</Link>
              </li>
              <li>
                <Link href="/intel" className="transition hover:text-white">Threat picture</Link>
              </li>
              <li>
                <Link href="/rescues" className="transition hover:text-white">Rescue board</Link>
              </li>
              <li>
                <Link href="/incidents" className="transition hover:text-white">Incident review</Link>
              </li>
              <li>
                <Link href="/doctrine" className="transition hover:text-white">ROE and doctrine</Link>
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center gap-3">
              <Clock3 size={18} className="text-cyan-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Dispatch Notes
              </p>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              QRF dispatch, CSAR intake, incident review, and the public ops pages are now online alongside mission control. The shape is here; now the job is hardening and refinement.
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center gap-3">
              <BookCheck size={18} className="text-lime-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Doctrine
              </p>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              Doctrine templates now exist as reusable org assets. ROE and execution guidance can be attached directly to sorties instead of dying in mission briefs or chat fragments.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-red-300" />
              <div>
                <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                  Ops Alerts
                </p>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Persisted notification feed</p>
              </div>
            </div>
            <Link
              href="/notifications"
              className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
            >
              Open alerts
            </Link>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {data.notifications.map((notification) => (
              <article key={notification.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                    {notification.title}
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                    {notification.severity}
                  </span>
                </div>
                {notification.href ? (
                  <Link href={notification.href} className="mt-3 inline-flex text-xs uppercase tracking-[0.16em] text-cyan-100 transition hover:text-white">
                    Open source
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <Siren size={18} className="text-amber-300" />
            <div>
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Rescue Queue
              </p>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Current active requests</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {data.rescues.map((rescue) => (
              <article key={rescue.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.12em] text-white">
                    {rescue.survivorHandle}
                  </p>
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-amber-100">
                    {rescue.urgency}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{rescue.locationName ?? "Location pending"}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {rescue.status} / {rescue.escortRequired ? "Escort required" : "Escort discretionary"}
                </p>
              </article>
            ))}
          </div>
        </section>
    </OpsShell>
  );
}
