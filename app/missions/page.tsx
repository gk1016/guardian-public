import Link from "next/link";
import { CheckCircle2, Crosshair, ShieldAlert } from "lucide-react";
import { getMissionPageData } from "@/lib/guardian-data";
import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { canManageMissions } from "@/lib/roles";

export const dynamic = "force-dynamic";

const statusTone = {
  planning: "text-slate-300 border-slate-500/20 bg-slate-500/8",
  ready: "text-amber-200 border-amber-400/20 bg-amber-400/8",
  active: "text-emerald-200 border-emerald-400/20 bg-emerald-400/8",
};

export default async function MissionsPage() {
  const session = await requireSession("/missions");
  const data = await getMissionPageData(session.userId);
  const canCreateMission = canManageMissions(session.role);

  return (
    <OpsShell
      currentPath="/missions"
      section="Missions"
      title="Mission Board"
      orgName={data.orgName}
      session={session}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)]">
        <span>{data.items.length} missions loaded</span>
        {canCreateMission ? (
          <Link
            href="/missions/new"
            className="rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-amber-200"
          >
            Create mission
          </Link>
        ) : null}
      </div>

      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {data.items.map((mission) => (
          <Link
            key={mission.id}
            href={`/missions/${mission.id}`}
            className="block rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated transition hover:border-amber-300/20 hover:bg-[var(--color-panel-strong)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.08em] text-[var(--color-text-strong)]">{mission.callsign}</p>
                  <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Rev {mission.revisionNumber}</span>
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">{mission.missionType}</p>
              </div>
              <span className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${statusTone[mission.status as keyof typeof statusTone] ?? statusTone.planning}`}>{mission.status}</span>
            </div>

            <h2 className="mt-3 text-sm font-medium text-[var(--color-text-strong)]">{mission.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{mission.missionBrief ?? "Mission brief pending."}</p>

            <div className="mt-4 grid gap-2 text-[11px] text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-2">
                <ShieldAlert size={13} className="text-[var(--color-accent)]" />
                <span className="uppercase tracking-[0.1em]">{mission.priority}</span>
              </div>
              <div className="flex items-center gap-2">
                <Crosshair size={13} className="text-cyan-300" />
                <span>{mission.areaOfOperation ?? "AO pending"}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-300" />
                <span>{mission.packageSummary.readyOrLaunched}/{mission.participantCount} package ready</span>
              </div>
            </div>

            {mission.packageDiscipline.warnings.length > 0 ? (
              <div className="mt-3 rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-[11px] text-red-200">
                <span className="font-semibold uppercase tracking-[0.1em]">Package alert</span> / {mission.packageDiscipline.warnings[0]}
              </div>
            ) : (
              <div className="mt-3 rounded-[var(--radius-sm)] border border-emerald-400/20 bg-emerald-400/8 px-3 py-2 text-[11px] text-emerald-200">
                Package structured
              </div>
            )}
          </Link>
        ))}

        {data.items.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-3 text-sm text-[var(--color-text-secondary)]">No missions loaded yet.</div>
        ) : null}
      </section>
    </OpsShell>
  );
}
