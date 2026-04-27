import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PublicShell } from "@/components/public-shell";

interface AarIncident {
  id: string;
  title: string;
  category: string;
  summary: string;
  updatedAtLabel: string;
}

interface AarMission {
  id: string;
  callsign: string;
  title: string;
  aarSummary: string;
  updatedAtLabel: string;
}

interface AarView {
  orgName: string;
  incidents: AarIncident[];
  missions: AarMission[];
}

export function AarPage() {
  const { data, isLoading } = useQuery<AarView>({
    queryKey: ["views", "aar"],
    queryFn: () => api("/api/views/aar"),
  });

  return (
    <PublicShell
      eyebrow="After-Action Reviews"
      title="Review is where the org gets sharper."
      description="Guardian publishes controlled after-action notes so useful lessons can be shared without dumping internal operational detail onto the public web."
    >
      {isLoading ? (
        <p className="text-center text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Loading reviews...
        </p>
      ) : (
        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/60 p-6">
            <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.14em] text-[var(--color-text-strong)]">
              Incident Reviews
            </p>
            <div className="mt-5 space-y-4">
              {(data?.incidents ?? []).map((incident) => (
                <div key={incident.id} className="rounded-2xl border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-text-strong)]">
                    {incident.title}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                    {incident.category} / Updated {incident.updatedAtLabel}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{incident.summary}</p>
                </div>
              ))}
              {(data?.incidents ?? []).length === 0 && (
                <p className="text-xs text-[var(--color-text-faint)]">No incident reviews published yet.</p>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/60 p-6">
            <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.14em] text-[var(--color-text-strong)]">
              Mission AARs
            </p>
            <div className="mt-5 space-y-4">
              {(data?.missions ?? []).map((mission) => (
                <div key={mission.id} className="rounded-2xl border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-text-strong)]">
                    {mission.callsign} / {mission.title}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                    Updated {mission.updatedAtLabel}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{mission.aarSummary}</p>
                </div>
              ))}
              {(data?.missions ?? []).length === 0 && (
                <p className="text-xs text-[var(--color-text-faint)]">No mission AARs published yet.</p>
              )}
            </div>
          </article>
        </section>
      )}
    </PublicShell>
  );
}
