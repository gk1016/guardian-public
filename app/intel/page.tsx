import Link from "next/link";
import { Radar, ShieldAlert } from "lucide-react";
import { getIntelPageData } from "@/lib/guardian-data";
import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";

export const dynamic = "force-dynamic";

export default async function IntelPage() {
  const session = await requireSession("/intel");
  const data = await getIntelPageData(session.userId);

  return (
    <OpsShell
      currentPath="/intel"
      section="Intelligence"
      title="Threat Picture"
      description="Threat reports are now behind authenticated access so the ops surface is no longer public by accident."
      orgName={data.orgName}
      session={session}
    >

        {data.error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {data.error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          {data.items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.12em] text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
                    {item.reportType.replaceAll("_", " ")}
                  </p>
                </div>
                <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-red-200">
                  Severity {item.severity}
                </span>
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-300">{item.description ?? "No description logged."}</p>

              <div className="mt-6 grid gap-3 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <Radar size={16} className="text-cyan-300" />
                  <span>{item.locationName ?? "Unknown location"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldAlert size={16} className="text-amber-300" />
                  <span>{item.hostileGroup ?? "Unconfirmed hostile group"}</span>
                </div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Confidence: {item.confidence}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Linked sorties
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.linkedMissions.map((mission) => (
                    <Link
                      key={mission.id}
                      href={`/missions/${mission.id}`}
                      className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      {mission.callsign} / {mission.status}
                    </Link>
                  ))}

                  {item.linkedMissions.length === 0 ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      Unlinked
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>
    </OpsShell>
  );
}
