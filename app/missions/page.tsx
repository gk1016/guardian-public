import Link from "next/link";
import { CheckCircle2, Clock3, Crosshair, ShieldAlert } from "lucide-react";
import { getMissionPageData } from "@/lib/guardian-data";
import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { canManageMissions } from "@/lib/roles";

export const dynamic = "force-dynamic";

const statusTone = {
  planning: "text-slate-300 border-slate-500/20 bg-slate-500/10",
  ready: "text-amber-200 border-amber-400/20 bg-amber-400/10",
  active: "text-emerald-200 border-emerald-400/20 bg-emerald-400/10",
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
      description="Mission views are now authenticated and scoped through the active operator session."
      orgName={data.orgName}
      session={session}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
        <span>Mission board is live. Commander-gated mission creation is now online.</span>
        {canCreateMission ? (
          <Link
            href="/missions/new"
            className="rounded-md border border-amber-300/30 bg-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-amber-200"
          >
            Create mission
          </Link>
        ) : null}
      </div>

        {data.error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {data.error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {data.items.map((mission) => (
            <Link
              key={mission.id}
              href={`/missions/${mission.id}`}
              className="block rounded-2xl border border-white/10 bg-slate-950/60 p-6 transition hover:border-amber-300/25 hover:bg-slate-950/80"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                      {mission.callsign}
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                      Rev {mission.revisionNumber}
                    </span>
                  </div>
                  <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
                    {mission.missionType}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${statusTone[mission.status as keyof typeof statusTone] ?? statusTone.planning}`}>
                  {mission.status}
                </span>
              </div>

              <h2 className="mt-5 text-xl font-semibold text-white">{mission.title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">{mission.missionBrief ?? "Mission brief pending."}</p>

              <div className="mt-6 grid gap-3 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <ShieldAlert size={16} className="text-amber-300" />
                  <span className="uppercase tracking-[0.16em]">{mission.priority}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Crosshair size={16} className="text-cyan-300" />
                  <span>{mission.areaOfOperation ?? "AO pending"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-300" />
                  <span>{mission.packageSummary.readyOrLaunched}/{mission.participantCount} package ready</span>
                </div>
              </div>
            </Link>
          ))}

          {data.items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
              No missions are loaded yet.
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-slate-300">
          <div className="flex items-center gap-3">
            <Clock3 size={16} className="text-cyan-300" />
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
              Next slice
            </p>
          </div>
          <p className="mt-4">
            Mission creation, detail views, closeout, reopen, participant assignment, intel linkage, and doctrine attachment are live. Next up is deeper package control, not more placeholder pages.
          </p>
        </section>
    </OpsShell>
  );
}
