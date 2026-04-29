import { useState } from "react";
import { Brain, Plus, ChevronDown, ChevronUp, Sparkles, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { useAssessments, useIntel, useThreatActors } from "@/hooks/use-views";
import { canManageOperations } from "@/lib/roles";
import { CollapsibleCard } from "@/components/collapsible-card";
import { AnalysisRequestForm } from "@/components/analysis-request-form";
import type { AssessmentItem } from "@/hooks/use-views";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
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

function typeBadgeClass(t: string): string {
  switch (t) {
    case "intsum":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "threat_assessment":
      return "border-red-400/30 bg-red-400/10 text-red-300";
    case "pattern_analysis":
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
    case "coa_prediction":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    default:
      return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  }
}

function typeLabel(t: string): string {
  switch (t) {
    case "intsum": return "INTSUM";
    case "threat_assessment": return "Threat Assessment";
    case "pattern_analysis": return "Pattern Analysis";
    case "coa_prediction": return "COA Prediction";
    default: return t;
  }
}

function confidenceBadgeClass(c: string): string {
  switch (c) {
    case "confirmed": return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "probable": return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
    case "possible": return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "doubtful": return "border-orange-400/30 bg-orange-400/10 text-orange-300";
    case "improbable": return "border-red-400/30 bg-red-400/10 text-red-300";
    default: return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  }
}

const SECTION_ORDER = ["intsum", "threat_assessment", "pattern_analysis", "coa_prediction"] as const;
const SECTION_LABELS: Record<string, string> = {
  intsum: "Intelligence Summaries",
  threat_assessment: "Threat Assessments",
  pattern_analysis: "Pattern Analyses",
  coa_prediction: "COA Predictions",
};
const SECTION_ICON_COLOR: Record<string, string> = {
  intsum: "text-amber-400",
  threat_assessment: "text-red-400",
  pattern_analysis: "text-cyan-400",
  coa_prediction: "text-emerald-400",
};

/* ------------------------------------------------------------------ */
/*  Assessment Card                                                    */
/* ------------------------------------------------------------------ */

function AssessmentCard({ item }: { item: AssessmentItem }) {
  const [showBody, setShowBody] = useState(false);

  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4 panel-elevated ${!item.isActive ? "opacity-50" : ""}`}>
      {/* Header */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${typeBadgeClass(item.assessmentType)}`}>
          {typeLabel(item.assessmentType)}
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${confidenceBadgeClass(item.confidence)}`}>
          {item.confidence}
        </span>
        <span className="flex-1 text-sm font-medium text-[var(--color-text-strong)]">{item.title}</span>
        {item.actorName && (
          <span className="rounded-full border border-red-400/20 bg-red-400/5 px-2 py-0.5 text-[10px] text-red-300/80">
            {item.actorName}
          </span>
        )}
      </div>

      {/* Summary */}
      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{item.summary}</p>

      {/* Key Findings */}
      {item.keyFindings.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Key Findings</p>
          <ol className="ml-4 list-decimal space-y-0.5">
            {item.keyFindings.map((f, i) => (
              <li key={i} className="text-xs text-[var(--color-text-secondary)]">{f}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Recommended Actions */}
      {item.recommendedActions.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Recommended Actions</p>
          <ul className="ml-4 list-disc space-y-0.5">
            {item.recommendedActions.map((a, i) => (
              <li key={i} className="text-xs text-[var(--color-text-secondary)]">{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Expand body */}
      {item.body && (
        <div className="mb-2">
          <button
            onClick={() => setShowBody(!showBody)}
            className="flex items-center gap-1 text-[10px] text-[var(--color-accent)] hover:underline"
          >
            {showBody ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showBody ? "Hide full analysis" : "Show full analysis"}
          </button>
          {showBody && (
            <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-secondary)]">
              {item.body}
            </pre>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[var(--color-text-faint)]">
          <span className="flex items-center gap-1">
            {item.generatedBy === "ai" ? <Sparkles className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            {item.generatedBy === "ai" ? "AI" : "Manual"}
            {item.modelUsed && ` / ${item.modelUsed}`}
          </span>
          <span>{item.sourceIntelIds.length} source report{item.sourceIntelIds.length !== 1 ? "s" : ""}</span>
          {item.createdByHandle && <span>by {item.createdByHandle}</span>}
        </div>
        <span className="text-[9px] text-[var(--color-text-faint)]">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function AssessmentsPage() {
  const session = useSession();
  const { data, isLoading, error } = useAssessments();
  const queryClient = useQueryClient();
  const isOpsManager = canManageOperations(session.role);

  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["intsum", "threat_assessment", "pattern_analysis", "coa_prediction"]),
  );

  // Lazy-load intel and actors only when form is open
  const intelQuery = useIntel();
  const actorsQuery = useThreatActors();

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["views", "assessments"] });
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  const allItems = data.items;
  const grouped: Record<string, AssessmentItem[]> = {};
  for (const item of allItems) {
    const key = item.assessmentType;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  const availableIntel = (intelQuery.data?.items ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    severity: i.severity,
  }));
  const availableActors = (actorsQuery.data?.items ?? []).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Analysis
        </h1>
        {isOpsManager && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
          >
            <Plus className="h-3 w-3" />
            Generate Analysis
          </button>
        )}
      </div>

      {allItems.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-12 text-center">
          <Brain className="mx-auto mb-3 h-8 w-8 text-[var(--color-text-faint)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">No assessments yet.</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Click "Generate Analysis" to create your first AI-powered intelligence assessment.
          </p>
        </div>
      )}

      {SECTION_ORDER.map((sectionType) => {
        const items = grouped[sectionType];
        if (!items || items.length === 0) return null;
        const iconColor = SECTION_ICON_COLOR[sectionType] ?? "text-[var(--color-text-tertiary)]";
        return (
          <CollapsibleCard
            key={sectionType}
            id={sectionType}
            expanded={expanded.has(sectionType)}
            onToggle={() => toggle(sectionType)}
            header={() => (
              <div className="flex items-center gap-3">
                <Brain className={`h-4 w-4 ${iconColor}`} />
                <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
                  {SECTION_LABELS[sectionType] ?? sectionType}
                </span>
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                  {items.length}
                </span>
              </div>
            )}
          >
            <div className="space-y-3">
              {items.map((item) => (
                <AssessmentCard key={item.id} item={item} />
              ))}
            </div>
          </CollapsibleCard>
        );
      })}

      {/* Show uncategorized assessments */}
      {Object.keys(grouped)
        .filter((k) => !SECTION_ORDER.includes(k as any))
        .map((sectionType) => {
          const items = grouped[sectionType];
          if (!items || items.length === 0) return null;
          return (
            <CollapsibleCard
              key={sectionType}
              id={sectionType}
              expanded={expanded.has(sectionType)}
              onToggle={() => toggle(sectionType)}
              header={() => (
                <div className="flex items-center gap-3">
                  <Brain className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
                    {sectionType}
                  </span>
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                    {items.length}
                  </span>
                </div>
              )}
            >
              <div className="space-y-3">
                {items.map((item) => (
                  <AssessmentCard key={item.id} item={item} />
                ))}
              </div>
            </CollapsibleCard>
          );
        })}

      {/* Form dialog */}
      {showForm && (
        <AnalysisRequestForm
          availableIntel={availableIntel}
          availableActors={availableActors}
          onClose={() => setShowForm(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
