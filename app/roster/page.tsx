import Link from "next/link";
import { Radar } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getRosterPageData } from "@/lib/guardian-data";
import { OpsShell } from "@/components/ops-shell";

export const dynamic = "force-dynamic";

const availabilityTone = {
  available: "border-emerald-400/20 bg-emerald-400/8 text-emerald-200",
  tasked: "border-amber-400/20 bg-amber-400/8 text-amber-200",
  engaged: "border-red-500/20 bg-red-500/8 text-red-200",
};

export default async function RosterPage() {
  const session = await requireSession("/roster");
  const data = await getRosterPageData(session.userId);

  return (
    <OpsShell
      currentPath="/roster"
      section="Roster"
      title="Crew Availability"
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {data.items.map((crew) => (
          <article key={crew.handle} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-white">{crew.displayName ?? crew.handle}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-slate-500">{crew.handle} / {crew.orgRole}</p>
              </div>
              <span className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${availabilityTone[crew.availabilityLabel]}`}>{crew.availabilityLabel}</span>
            </div>

            <div className="mt-3 grid gap-2 text-[11px]">
              <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2">
                <span className="text-slate-500">Source:</span> <span className="text-white">{crew.sourceLabel}</span>
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2">
                <span className="text-slate-500">QRF:</span> <span className="text-white">{crew.qrfStatus ?? "None"}</span> / <span className="text-slate-500">Platform:</span> <span className="text-white">{crew.suggestedPlatform ?? "Pending"}</span>
              </div>
            </div>

            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/15 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Radar size={13} className="text-cyan-300" />
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Commitments</p>
              </div>
              <div className="mt-2 space-y-1.5">
                {crew.commitments.length > 0 ? crew.commitments.map((c) => (
                  <Link key={`${crew.handle}-${c.missionId}`} href={`/missions/${c.missionId}`} className="block rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2 transition hover:bg-white/5">
                    <p className="text-xs font-medium text-white">{c.callsign}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{c.assignmentStatus} / {c.role}</p>
                  </Link>
                )) : (
                  <p className="text-[11px] text-emerald-300">No active commitments.</p>
                )}
              </div>
            </div>

            {crew.notes ? <p className="mt-2 text-sm leading-6 text-slate-400">{crew.notes}</p> : null}
          </article>
        ))}
        {data.items.length === 0 ? <p className="text-sm text-slate-500">No crew loaded.</p> : null}
      </section>
    </OpsShell>
  );
}
