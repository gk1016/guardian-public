import { CheckCircle2, Clock3, Crosshair, ShieldAlert } from "lucide-react";
import { getMissionPageData } from "@/lib/guardian-data";
import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";

export const dynamic = "force-dynamic";

const statusTone = {
  planning: "text-slate-300 border-slate-500/20 bg-slate-500/10",
  ready: "text-amber-200 border-amber-400/20 bg-amber-400/10",
  active: "text-emerald-200 border-emerald-400/20 bg-emerald-400/10",
};

export default async function MissionsPage() {
  const session = await requireSession("/missions");
  const data = await getMissionPageData(session.userId);

  return (
    <OpsShell
      currentPath="/missions"
      section="Missions"
      title="Mission Board"
      description="Mission views are now authenticated and scoped through the active operator session."
      orgName={data.orgName}
      session={session}
    >
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
        Seeded demo data is live. CRUD and role-gated mutation are next.
      </div>

        {data.error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {data.error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {data.items.map((mission) => (
            <article key={mission.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                    {mission.callsign}
                  </p>
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
                  <span>{mission.participantCount} assigned participants</span>
                </div>
              </div>
            </article>
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
            Mission creation, approvals, ROE attachment, and assignment workflow should be the next build
            increment. The data model is already in place.
          </p>
        </section>
    </OpsShell>
  );
}
