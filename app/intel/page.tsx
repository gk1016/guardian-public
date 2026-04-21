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
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {data.items.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-white">{item.title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-slate-500">{item.reportType.replaceAll("_", " ")}</p>
              </div>
              <span className="rounded-[var(--radius-sm)] border border-red-400/20 bg-red-400/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-red-200">Sev {item.severity}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{item.description ?? "No description logged."}</p>
            <div className="mt-3 grid gap-1.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-2"><Radar size={13} className="text-cyan-300" />{item.locationName ?? "Unknown location"}</div>
              <div className="flex items-center gap-2"><ShieldAlert size={13} className="text-amber-300" />{item.hostileGroup ?? "Unconfirmed hostile"}</div>
              <div className="text-slate-500">Confidence: {item.confidence}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-[var(--radius-sm)] border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-400">{tag}</span>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Linked sorties</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.linkedMissions.map((m) => (
                  <Link key={m.id} href={`/missions/${m.id}`} className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-cyan-200 transition hover:bg-cyan-400/15">{m.callsign} / {m.status}</Link>
                ))}
                {item.linkedMissions.length === 0 ? <span className="text-[10px] text-slate-600">Unlinked</span> : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </OpsShell>
  );
}
