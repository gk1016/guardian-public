import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileWarning } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { canManageOperations } from "@/lib/roles";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { IncidentCreateForm } from "@/components/incident-create-form";
import { IncidentUpdateForm } from "@/components/incident-update-form";

interface SelectOption { id: string; label: string; detail?: string | null }

interface IncidentItem {
  id: string;
  title: string;
  category: string;
  severity: number;
  status: string;
  summary: string;
  lessonsLearned: string | null;
  actionItems: string | null;
  publicSummary: string | null;
  reporterDisplay: string;
  reviewerDisplay: string;
  missionLabel: string | null;
  rescueLabel: string | null;
  updatedAtLabel: string;
  closedAtLabel: string | null;
}

interface IncidentView {
  items: IncidentItem[];
  missionOptions: SelectOption[];
  rescueOptions: SelectOption[];
  error?: string;
}

const severityTone: Record<number, string> = {
  1: "border-slate-500/20 bg-slate-500/8 text-slate-300",
  2: "border-cyan-400/20 bg-cyan-400/8 text-cyan-200",
  3: "border-amber-400/20 bg-amber-400/8 text-amber-200",
  4: "border-orange-500/20 bg-orange-500/8 text-orange-200",
  5: "border-red-500/20 bg-red-500/8 text-red-200",
};

export function IncidentsPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const canManage = canManageOperations(session.role);

  const { data, isLoading } = useQuery<IncidentView>({
    queryKey: ["views", "incidents"],
    queryFn: () => api("/api/views/incidents"),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["views", "incidents"] });

  if (isLoading) {
    return <p className="py-8 text-center text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">Loading incidents...</p>;
  }

  return (
    <>
      {data?.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      {canManage ? (
        <CollapsiblePanel label="File Incident" icon={<FileWarning size={16} className="text-[var(--color-accent)]" />}>
          <IncidentCreateForm missionOptions={data?.missionOptions ?? []} rescueOptions={data?.rescueOptions ?? []} onSuccess={refetch} />
        </CollapsiblePanel>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {(data?.items ?? []).map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.08em] text-[var(--color-text-strong)]">{item.title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">{item.category}{item.missionLabel ? ` / ${item.missionLabel}` : ""}{item.rescueLabel ? ` / ${item.rescueLabel}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${severityTone[item.severity] ?? severityTone[3]}`}>Sev {item.severity}</span>
                <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] uppercase text-[var(--color-text-secondary)]">{item.status}</span>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Summary</p>
                <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">{item.summary}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Lessons</p>
                <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">{item.lessonsLearned ?? "Not filed."}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Action Items</p>
                <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">{item.actionItems ?? "None."}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Public Summary</p>
                <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">{item.publicSummary ?? "Not published."}</p>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-[var(--color-text-tertiary)]">
              Reporter {item.reporterDisplay} / Reviewer {item.reviewerDisplay} / {item.updatedAtLabel}
              {item.closedAtLabel ? ` / Closed ${item.closedAtLabel}` : ""}
            </p>
            {canManage ? (
              <div className="mt-4">
                <CollapsiblePanel label="Review update" variant="inline" icon={<AlertTriangle size={13} className="text-cyan-300" />}>
                  <IncidentUpdateForm incidentId={item.id} initialIncident={{ status: item.status, lessonsLearned: item.lessonsLearned, actionItems: item.actionItems, publicSummary: item.publicSummary }} onSuccess={refetch} />
                </CollapsiblePanel>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}
