import Link from "next/link";
import {
  AlertTriangle,
  Crosshair,
  Siren,
} from "lucide-react";
import { getCommandOverview } from "@/lib/guardian-data";
import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { LiveCounters } from "@/components/live-counters";
import { MissionQuickActions } from "@/components/mission-quick-actions";
import { canManageMissions } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const session = await requireSession("/command");
  const data = await getCommandOverview(session.userId);
  const canManageMission = canManageMissions(session.role);

  return (
    <OpsShell
      currentPath="/command"
      section="Command"
      title="Watch Floor"
      orgName={data.orgName}
      session={session}
    >
      <LiveCounters
        initialActiveMissions={data.activeMissionCount}
        initialQrfReady={data.qrfReadyCount}
        initialOpenRescues={data.openRescueCount}
        initialUnreadAlerts={data.unreadNotificationCount}
      />

      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {data.error}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div>
              <p className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-white">Mission Board</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Active and planning</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {data.missions.map((mission) => (
              <article key={mission.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-3">
                <Link href={`/missions/${mission.id}`} className="block">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-white">
                        {mission.callsign}
                      </p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-slate-500">{mission.missionType}</p>
                    </div>
                    <span className="rounded-[var(--radius-sm)] border border-white/8 bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-200">
                      {mission.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{mission.title}</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {mission.packageSummary.readyOrLaunched}/{mission.participantCount} ready / AO {mission.areaOfOperation ?? "pending"}
                  </p>
                  {mission.packageDiscipline.warnings.length > 0 ? (
                    <div className="mt-2 rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-[11px] text-red-200">
                      <div className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.1em]">
                        <AlertTriangle size={12} />
                        Package alert
                      </div>
                      <p className="mt-1">{mission.packageDiscipline.warnings[0]}</p>
                    </div>
                  ) : null}
                </Link>
                {canManageMission ? (
                  <MissionQuickActions
                    missionId={mission.id}
                    currentStatus={mission.status}
                    callsign={mission.callsign}
                    participantCount={mission.participantCount}
                    readyCount={mission.packageSummary.readyOrLaunched}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
            <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] pb-3">
              <Siren className="text-cyan-300" size={16} />
              <div>
                <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-white">QRF Board</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Availability and posture</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {data.qrf.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                  <div>
                    <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-white">{entry.callsign}</p>
                    <p className="text-[11px] text-slate-500">{entry.platform ?? "Platform pending"} / Crew {entry.availableCrew}</p>
                  </div>
                  <span className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-cyan-200">{entry.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
            <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] pb-3">
              <Crosshair className="text-red-300" size={16} />
              <div>
                <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-white">Threat Summary</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Intel queue</p>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {data.intel.map((item) => (
                <li key={item.id} className="rounded-[var(--radius-md)] border border-red-500/12 bg-red-500/5 px-3 py-2.5 text-sm leading-6 text-slate-300">
                  <span className="font-medium text-white">{item.title}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {item.locationName ?? "Unknown location"} / {item.hostileGroup ?? "Unconfirmed hostile"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4 panel-elevated">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Siren size={15} className="text-amber-300" />
            <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Rescue Queue</p>
          </div>
          <Link
            href="/rescues"
            className="text-[10px] uppercase tracking-[0.1em] text-slate-500 transition hover:text-white"
          >
            View all
          </Link>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {data.rescues.map((rescue) => (
            <div key={rescue.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-white">{rescue.survivorHandle}</p>
                <span className="rounded-[var(--radius-sm)] border border-amber-400/20 bg-amber-400/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-amber-200">{rescue.urgency}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{rescue.locationName ?? "Location pending"}</p>
              <p className="mt-0.5 text-[10px] text-slate-600">{rescue.status} / {rescue.escortRequired ? "Escort required" : "Escort discretionary"}</p>
            </div>
          ))}
        </div>
      </section>
    </OpsShell>
  );
}
