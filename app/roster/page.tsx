import Link from "next/link";
import { Radar, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getRosterPageData } from "@/lib/guardian-data";
import { OpsShell } from "@/components/ops-shell";

export const dynamic = "force-dynamic";

const availabilityTone = {
  available: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  tasked: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  engaged: "border-red-500/20 bg-red-500/10 text-red-100",
};

export default async function RosterPage() {
  const session = await requireSession("/roster");
  const data = await getRosterPageData(session.userId);

  return (
    <OpsShell
      currentPath="/roster"
      section="Roster"
      title="Crew Availability"
      description="Live org and QRF roster with sortie commitments so command can build real packages instead of fantasy lineups."
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {data.error}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {data.items.map((crew) => (
          <article
            key={crew.handle}
            className="rounded-2xl border border-white/10 bg-slate-950/60 p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
                  {crew.displayName ?? crew.handle}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                  {crew.handle} / {crew.orgRole}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${availabilityTone[crew.availabilityLabel]}`}>
                {crew.availabilityLabel}
              </span>
            </div>

            <div className="mt-5 grid gap-3 text-sm text-slate-300">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Source</p>
                <p className="mt-2 uppercase tracking-[0.16em] text-white">
                  {crew.sourceLabel}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">QRF / Platform</p>
                <p className="mt-2 uppercase tracking-[0.16em] text-white">
                  {(crew.qrfStatus ?? "No QRF posture")} / {crew.suggestedPlatform ?? "Platform pending"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="flex items-center gap-3">
                <Radar size={16} className="text-cyan-300" />
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Current Commitments</p>
              </div>
              <div className="mt-3 space-y-3">
                {crew.commitments.length > 0 ? (
                  crew.commitments.map((commitment) => (
                    <Link
                      key={`${crew.handle}-${commitment.missionId}`}
                      href={`/missions/${commitment.missionId}`}
                      className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
                    >
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                        {commitment.callsign}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                        {commitment.assignmentStatus} / {commitment.role}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                        Mission status {commitment.missionStatus}
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    No active sortie commitment recorded.
                  </div>
                )}
              </div>
            </div>

            {crew.notes ? (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {crew.notes}
              </div>
            ) : null}
          </article>
        ))}

        {data.items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
            No crew loaded yet.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-slate-300">
        <div className="flex items-center gap-3">
          <Users size={16} className="text-amber-300" />
          <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
            Command Use
          </p>
        </div>
        <p className="mt-4">
          Use this board before package assignment. If a pilot is already marked <span className="font-semibold uppercase text-red-100">engaged</span>, treating them as free for another sortie is how command manufactures a fake roster.
        </p>
      </section>
    </OpsShell>
  );
}
