import { PublicShell } from "@/components/public-shell";
import { getPublicAarData } from "@/lib/ops-data";

export const dynamic = "force-dynamic";

export default async function AarPage() {
  const data = await getPublicAarData();

  return (
    <PublicShell
      eyebrow="After-Action Reviews"
      title="Review is where the org gets sharper."
      description="Guardian publishes controlled after-action notes so useful lessons can be shared without dumping internal operational detail onto the public web."
    >
      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-6">
          <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.14em] text-white">
            Incident Reviews
          </p>
          <div className="mt-5 space-y-4">
            {data.incidents.map((incident) => (
              <div key={incident.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                  {incident.title}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {incident.category} / Updated {incident.updatedAtLabel}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{incident.summary}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-6">
          <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.14em] text-white">
            Mission AARs
          </p>
          <div className="mt-5 space-y-4">
            {data.missions.map((mission) => (
              <div key={mission.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                  {mission.callsign} / {mission.title}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                  Updated {mission.updatedAtLabel}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{mission.aarSummary}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </PublicShell>
  );
}
