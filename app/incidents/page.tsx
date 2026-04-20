import { AlertTriangle, FileWarning } from "lucide-react";
import { IncidentCreateForm } from "@/components/incident-create-form";
import { IncidentUpdateForm } from "@/components/incident-update-form";
import { OpsShell } from "@/components/ops-shell";
import { requireSession } from "@/lib/auth";
import { getIncidentPageData } from "@/lib/ops-data";
import { canManageOperations } from "@/lib/roles";

export const dynamic = "force-dynamic";

const severityTone = {
  1: "border-slate-500/20 bg-slate-500/10 text-slate-200",
  2: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
  3: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  4: "border-orange-500/20 bg-orange-500/10 text-orange-100",
  5: "border-red-500/20 bg-red-500/10 text-red-100",
};

export default async function IncidentsPage() {
  const session = await requireSession("/incidents");
  const data = await getIncidentPageData(session.userId);
  const canManage = canManageOperations(session.role);

  return (
    <OpsShell
      currentPath="/incidents"
      section="Incidents"
      title="Incident Review"
      description="Contact reports, rescue traps, and after-action lessons now live as first-class records instead of free-text drift."
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {data.error}
        </div>
      ) : null}

      {canManage ? (
        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
          <div className="flex items-center gap-3">
            <FileWarning size={18} className="text-amber-300" />
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
              File Incident
            </p>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Log the event, capture lessons, and publish a clean public summary without losing the internal detail.
          </p>
          <div className="mt-6">
            <IncidentCreateForm
              missionOptions={data.missionOptions}
              rescueOptions={data.rescueOptions}
            />
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        {data.items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.14em] text-white">
                  {item.title}
                </p>
                <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
                  {item.category}
                  {item.missionLabel ? ` / ${item.missionLabel}` : ""}
                  {item.rescueLabel ? ` / ${item.rescueLabel}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${severityTone[item.severity as keyof typeof severityTone] ?? severityTone[3]}`}>
                  Severity {item.severity}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200">
                  {item.status}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Summary</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.summary}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Lessons learned</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {item.lessonsLearned ?? "Lessons not yet filed."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Action items</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {item.actionItems ?? "No action items logged."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Public summary</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {item.publicSummary ?? "Public summary not yet published."}
                </p>
              </div>
            </div>

            <p className="mt-5 text-xs uppercase tracking-[0.16em] text-slate-400">
              Reporter {item.reporterDisplay} / Reviewer {item.reviewerDisplay} / Updated {item.updatedAtLabel}
              {item.closedAtLabel ? ` / Closed ${item.closedAtLabel}` : ""}
            </p>

            {canManage ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={16} className="text-cyan-300" />
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Review update</p>
                </div>
                <div className="mt-4">
                  <IncidentUpdateForm
                    incidentId={item.id}
                    initialIncident={{
                      status: item.status,
                      lessonsLearned: item.lessonsLearned,
                      actionItems: item.actionItems,
                      publicSummary: item.publicSummary,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </OpsShell>
  );
}
