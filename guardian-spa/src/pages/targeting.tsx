import { useState } from "react";
import { Target, Plus, Pencil, CheckCircle, ClipboardCheck, MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { useTargets, useThreatActors } from "@/hooks/use-views";
import { canManageOperations, canManageMissions } from "@/lib/roles";
import { CollapsibleCard } from "@/components/collapsible-card";
import { TargetForm } from "@/components/target-form";
import { api } from "@/lib/api";
import type { TargetItem } from "@/hooks/use-views";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const F3EAD_PHASES = [
  { key: "find", label: "FIND", color: "slate" },
  { key: "fix", label: "FIX", color: "cyan" },
  { key: "finish", label: "FINISH", color: "amber" },
  { key: "exploit", label: "EXPLOIT", color: "red" },
  { key: "analyze", label: "ANALYZE", color: "emerald" },
  { key: "disseminate", label: "DISSEMINATE", color: "violet" },
] as const;

const PHASE_BORDER: Record<string, string> = {
  find: "border-slate-400/30",
  fix: "border-cyan-400/30",
  finish: "border-amber-400/30",
  exploit: "border-red-400/30",
  analyze: "border-emerald-400/30",
  disseminate: "border-violet-400/30",
};

const PHASE_HEADER_BG: Record<string, string> = {
  find: "bg-slate-400/8",
  fix: "bg-cyan-400/8",
  finish: "bg-amber-400/8",
  exploit: "bg-red-400/8",
  analyze: "bg-emerald-400/8",
  disseminate: "bg-violet-400/8",
};

const PHASE_TEXT: Record<string, string> = {
  find: "text-slate-300",
  fix: "text-cyan-300",
  finish: "text-amber-300",
  exploit: "text-red-300",
  analyze: "text-emerald-300",
  disseminate: "text-violet-300",
};

/* ------------------------------------------------------------------ */
/*  Badge helpers                                                      */
/* ------------------------------------------------------------------ */

function typeBadgeClass(t: string): string {
  switch (t) {
    case "hvt": return "border-red-400/30 bg-red-400/10 text-red-300";
    case "hpt": return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "tsa": return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
    default: return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  }
}

function typeLabel(t: string): string {
  switch (t) {
    case "hvt": return "HVT";
    case "hpt": return "HPT";
    case "tsa": return "TSA";
    default: return t.toUpperCase();
  }
}

function priorityBadgeClass(p: number): string {
  switch (p) {
    case 1: return "border-red-400/30 bg-red-400/10 text-red-300";
    case 2: return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case 3: return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
    default: return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  }
}

function priorityLabel(p: number): string {
  switch (p) {
    case 1: return "P1 CRITICAL";
    case 2: return "P2 HIGH";
    case 3: return "P3 MEDIUM";
    case 4: return "P4 LOW";
    case 5: return "P5 LOWEST";
    default: return `P${p}`;
  }
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case "nominated": return "border-slate-400/30 bg-slate-400/10 text-slate-300";
    case "approved": return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "active": return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
    case "engaged": return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "bda_pending": return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
    case "completed": return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "cancelled": return "border-red-400/30 bg-red-400/10 text-red-300";
    default: return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  }
}

function bdaBadgeClass(a: string): string {
  switch (a) {
    case "destroyed": return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "damaged": return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "ineffective": return "border-red-400/30 bg-red-400/10 text-red-300";
    default: return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  }
}

/* ------------------------------------------------------------------ */
/*  Loading / Error                                                    */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Loading...</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Approve Dialog                                                     */
/* ------------------------------------------------------------------ */

function ApproveDialog({
  target,
  onClose,
  onApproved,
}: {
  target: TargetItem;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [guidance, setGuidance] = useState(target.engagementGuidance ?? "");
  const [saving, setSaving] = useState(false);

  async function handleApprove() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (guidance.trim()) payload.engagementGuidance = guidance.trim();
      await api.post(`/api/targets/${target.id}/approve`, payload);
      onApproved();
      onClose();
    } catch {
      /* swallow */
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-backdrop)]">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 shadow-xl">
        <h3 className="mb-3 font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Approve Target: {target.name}
        </h3>
        <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
          This will set the target status to APPROVED and clear it for engagement.
        </p>
        <div className="mb-4">
          <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Engagement Guidance (optional)
          </label>
          <textarea className={inputClass} rows={3} value={guidance} onChange={(e) => setGuidance(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-overlay-subtle)]"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={saving}
            className="rounded-[var(--radius-md)] border border-emerald-400/40 bg-emerald-400/10 px-4 py-1.5 text-xs text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40"
          >
            {saving ? "Approving..." : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BDA Dialog                                                         */
/* ------------------------------------------------------------------ */

function BdaDialog({
  target,
  onClose,
  onSubmitted,
}: {
  target: TargetItem;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [assessment, setAssessment] = useState("unknown");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!summary.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/targets/${target.id}/bda`, {
        bdaSummary: summary.trim(),
        bdaAssessment: assessment,
      });
      onSubmitted();
      onClose();
    } catch {
      /* swallow */
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-backdrop)]">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 shadow-xl">
        <h3 className="mb-3 font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          BDA: {target.name}
        </h3>
        <div className="mb-3">
          <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            BDA Summary *
          </label>
          <textarea className={inputClass} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Assessment
          </label>
          <select className={inputClass} value={assessment} onChange={(e) => setAssessment(e.target.value)}>
            <option value="unknown">Unknown</option>
            <option value="destroyed">Destroyed</option>
            <option value="damaged">Damaged</option>
            <option value="ineffective">Ineffective</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-overlay-subtle)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !summary.trim()}
            className="rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-1.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-40"
          >
            {saving ? "Submitting..." : "Submit BDA"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Target Card                                                        */
/* ------------------------------------------------------------------ */

function TargetCard({
  item,
  isCommander,
  isOps,
  onEdit,
  onApprove,
  onBda,
}: {
  item: TargetItem;
  isCommander: boolean;
  isOps: boolean;
  onEdit: () => void;
  onApprove: () => void;
  onBda: () => void;
}) {
  return (
    <div className={`rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-3 panel-elevated ${!item.isActive ? "opacity-50" : ""}`}>
      {/* Header badges */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${typeBadgeClass(item.targetType)}`}>
          {typeLabel(item.targetType)}
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${priorityBadgeClass(item.priority)}`}>
          {priorityLabel(item.priority)}
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${statusBadgeClass(item.status)}`}>
          {item.status.replace("_", " ")}
        </span>
      </div>

      {/* Name */}
      <p className="mb-1 text-sm font-medium text-[var(--color-text-strong)]">{item.name}</p>

      {/* Description */}
      {item.description && (
        <p className="mb-2 text-xs text-[var(--color-text-secondary)]">{item.description}</p>
      )}

      {/* Actor */}
      {item.actorName && (
        <p className="mb-1 text-[10px] text-[var(--color-text-tertiary)]">
          Actor: <span className="text-red-300/80">{item.actorName}</span>
        </p>
      )}

      {/* Location */}
      {(item.lastKnownLocation || item.starSystem || item.gridReference) && (
        <p className="mb-1 flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
          <MapPin className="h-2.5 w-2.5" />
          {[item.lastKnownLocation, item.starSystem, item.gridReference].filter(Boolean).join(" / ")}
        </p>
      )}

      {/* Engagement guidance */}
      {item.engagementGuidance && item.status !== "nominated" && (
        <div className="mb-1">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">Engagement Guidance</p>
          <p className="text-[11px] text-[var(--color-text-secondary)]">{item.engagementGuidance}</p>
        </div>
      )}

      {/* Collateral concerns */}
      {item.collateralConcerns && (
        <div className="mb-1">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">Collateral Concerns</p>
          <p className="text-[11px] text-amber-300/80">{item.collateralConcerns}</p>
        </div>
      )}

      {/* Mission link */}
      {item.missionCallsign && (
        <p className="mb-1 text-[10px] text-[var(--color-text-tertiary)]">
          Mission: <span className="text-cyan-300/80">{item.missionCallsign}</span>
        </p>
      )}

      {/* BDA */}
      {item.bdaSummary && (
        <div className="mb-1">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">BDA Summary</p>
          <p className="text-[11px] text-[var(--color-text-secondary)]">{item.bdaSummary}</p>
          {item.bdaAssessment && (
            <span className={`mt-0.5 inline-block rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${bdaBadgeClass(item.bdaAssessment)}`}>
              {item.bdaAssessment}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-[var(--color-border)] pt-2">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-[var(--color-text-faint)]">
          {item.nominatedByHandle && <span>Nom: {item.nominatedByHandle}</span>}
          {item.approvedByHandle && <span>Appr: {item.approvedByHandle}</span>}
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="flex gap-1">
          {isOps && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)] hover:bg-[var(--color-overlay-subtle)]"
            >
              <Pencil className="h-2.5 w-2.5" /> Edit
            </button>
          )}
          {isCommander && item.status === "nominated" && (
            <button
              onClick={onApprove}
              className="flex items-center gap-1 rounded-[var(--radius-md)] border border-emerald-400/30 bg-emerald-400/8 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-400/15"
            >
              <CheckCircle className="h-2.5 w-2.5" /> Approve
            </button>
          )}
          {isOps && ["approved", "active", "engaged"].includes(item.status) && (
            <button
              onClick={onBda}
              className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-2 py-0.5 text-[10px] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15"
            >
              <ClipboardCheck className="h-2.5 w-2.5" /> BDA
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function TargetingPage() {
  const session = useSession();
  const { data, isLoading, error } = useTargets();
  const actorsQuery = useThreatActors();
  const queryClient = useQueryClient();

  const isOps = canManageOperations(session.role);
  const isCommander = canManageMissions(session.role);

  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetItem | null>(null);
  const [approveTarget, setApproveTarget] = useState<TargetItem | null>(null);
  const [bdaTarget, setBdaTarget] = useState<TargetItem | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["views", "targets"] });
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  const allItems = data.items;
  const activeItems = allItems.filter((t) => t.isActive && !(["completed", "cancelled"].includes(t.status)));
  const closedItems = allItems.filter((t) => !t.isActive || ["completed", "cancelled"].includes(t.status));

  // Group active targets by F3EAD phase
  const phaseGroups: Record<string, TargetItem[]> = {};
  for (const phase of F3EAD_PHASES) {
    phaseGroups[phase.key] = [];
  }
  for (const item of activeItems) {
    const key = item.f3eadPhase;
    if (phaseGroups[key]) {
      phaseGroups[key].push(item);
    } else {
      // fallback to find
      phaseGroups["find"].push(item);
    }
  }

  const availableActors = (actorsQuery.data?.items ?? []).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Targeting
        </h1>
        {isOps && (
          <button
            onClick={() => { setEditingTarget(null); setShowForm(true); }}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
          >
            <Plus className="h-3 w-3" />
            Nominate Target
          </button>
        )}
      </div>

      {/* Empty state */}
      {allItems.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-12 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-[var(--color-text-faint)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">No targets nominated.</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Click "Nominate Target" to begin the F3EAD targeting cycle.
          </p>
        </div>
      )}

      {/* F3EAD Pipeline */}
      {activeItems.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {F3EAD_PHASES.map((phase) => {
            const items = phaseGroups[phase.key];
            return (
              <div
                key={phase.key}
                className={`rounded-[var(--radius-lg)] border ${PHASE_BORDER[phase.key]} bg-[var(--color-panel)]`}
              >
                <div className={`flex items-center justify-between rounded-t-[var(--radius-lg)] px-3 py-2 ${PHASE_HEADER_BG[phase.key]}`}>
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${PHASE_TEXT[phase.key]}`}>
                    {phase.label}
                  </span>
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2 p-2">
                  {items.length === 0 && (
                    <p className="py-4 text-center text-[10px] text-[var(--color-text-faint)]">No targets</p>
                  )}
                  {items.map((item) => (
                    <TargetCard
                      key={item.id}
                      item={item}
                      isCommander={isCommander}
                      isOps={isOps}
                      onEdit={() => { setEditingTarget(item); setShowForm(true); }}
                      onApprove={() => setApproveTarget(item)}
                      onBda={() => setBdaTarget(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed / Cancelled */}
      {closedItems.length > 0 && (
        <CollapsibleCard
          id="completed-targets"
          expanded={showCompleted}
          onToggle={() => setShowCompleted(!showCompleted)}
          header={() => (
            <div className="flex items-center gap-3">
              <Target className="h-4 w-4 text-[var(--color-text-tertiary)]" />
              <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
                Completed / Cancelled
              </span>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                {closedItems.length}
              </span>
            </div>
          )}
        >
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {closedItems.map((item) => (
              <TargetCard
                key={item.id}
                item={item}
                isCommander={isCommander}
                isOps={isOps}
                onEdit={() => { setEditingTarget(item); setShowForm(true); }}
                onApprove={() => setApproveTarget(item)}
                onBda={() => setBdaTarget(item)}
              />
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* Dialogs */}
      {showForm && (
        <TargetForm
          editing={editingTarget}
          availableActors={availableActors}
          onClose={() => setShowForm(false)}
          onSaved={refresh}
        />
      )}
      {approveTarget && (
        <ApproveDialog
          target={approveTarget}
          onClose={() => setApproveTarget(null)}
          onApproved={refresh}
        />
      )}
      {bdaTarget && (
        <BdaDialog
          target={bdaTarget}
          onClose={() => setBdaTarget(null)}
          onSubmitted={refresh}
        />
      )}
    </div>
  );
}
