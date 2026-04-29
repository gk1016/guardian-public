import { useState } from "react";
import { Link } from "react-router";
import { Radar, ShieldAlert, Plus, Pencil, Archive, Filter, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { useIntel } from "@/hooks/use-views";
import { canManageOperations } from "@/lib/roles";
import { CollapsibleCard } from "@/components/collapsible-card";
import { IntelForm } from "@/components/intel-form";
import { api } from "@/lib/api";
import type { IntelItem } from "@/hooks/use-views";

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

function severityLabel(severity: number): string {
  if (severity >= 9) return "critical";
  if (severity >= 7) return "high";
  if (severity >= 4) return "medium";
  return "low";
}

function severityColor(severity: number): string {
  if (severity >= 9) return "red";
  if (severity >= 7) return "amber";
  if (severity >= 4) return "yellow";
  return "slate";
}

function phaseColor(phase: string): string {
  switch (phase) {
    case "analyzed": return "emerald";
    case "processed": return "cyan";
    default: return "slate";
  }
}

function natoRating(src: string, cred: number): string {
  return `${src}${cred}`;
}

/* ------------------------------------------------------------------ */
/*  Intel Card                                                         */
/* ------------------------------------------------------------------ */

function IntelCard({
  item,
  isOps,
  onEdit,
  onArchive,
}: {
  item: IntelItem;
  isOps: boolean;
  onEdit: (item: IntelItem) => void;
  onArchive: (id: string) => void;
}) {
  const tone = severityColor(item.severity);
  const label = severityLabel(item.severity);
  const pTone = phaseColor(item.reportPhase);
  const rating = natoRating(item.sourceReliability, item.infoCredibility);

  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated ${!item.isActive ? "opacity-50" : ""}`}>
      {/* Header row */}
      <div className="mb-2 flex items-center gap-2">
        <Radar className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <span className="text-sm font-medium text-[var(--color-text-strong)]">{item.title}</span>
        {item.isVerified && (
          <CheckCircle className="h-3 w-3 text-emerald-400" />
        )}
        <span className={`ml-auto rounded-full border border-${tone}-400/30 bg-${tone}-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-${tone}-300`}>
          {label} ({item.severity})
        </span>
      </div>

      {/* Meta row: type + confidence + NATO rating + phase */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {item.reportType.replaceAll("_", " ")}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Confidence: {item.confidence}
        </span>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.1em] text-[var(--color-text-secondary)]">
          {rating}
        </span>
        <span className={`rounded-full border border-${pTone}-400/30 bg-${pTone}-400/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-${pTone}-300`}>
          {item.reportPhase}
        </span>
        {!item.isActive && (
          <span className="rounded-full border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-red-300">
            archived
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
        {item.description || "No description logged."}
      </p>

      {/* Location + hostile */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {item.locationName || "Unknown location"}
          {item.starSystem ? ` / ${item.starSystem}` : ""}
        </span>
        {item.hostileGroup && (
          <span className="flex items-center gap-1 text-[10px] text-red-300/80">
            <ShieldAlert className="h-2.5 w-2.5" />
            {item.hostileGroup}
          </span>
        )}
      </div>

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Linked sorties */}
      <div className="mt-3 border-t border-[var(--color-border)] pt-2">
        <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Linked sorties
        </p>
        {item.linkedMissions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.linkedMissions.map((lm) => (
              <Link
                key={lm.missionId}
                to={`/missions/${lm.missionId}`}
                className="rounded-full border border-[var(--color-border-bright)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-strong)]"
              >
                {lm.callsign} ({lm.missionStatus})
              </Link>
            ))}
          </div>
        ) : (
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-faint)]">
            Unlinked
          </span>
        )}
      </div>

      {/* Timestamps + actions */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
        <div className="flex gap-3 text-[9px] text-[var(--color-text-faint)]">
          {item.observedAt && <span>Observed: {new Date(item.observedAt).toLocaleDateString()}</span>}
          {item.createdAt && <span>Filed: {new Date(item.createdAt).toLocaleDateString()}</span>}
        </div>
        {isOps && item.isActive && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(item)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-1.5 text-[var(--color-text-tertiary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              title="Edit report"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onArchive(item.id)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-1.5 text-[var(--color-text-tertiary)] hover:border-red-400 hover:text-red-400"
              title="Archive report"
            >
              <Archive className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function IntelPage() {
  const session = useSession();
  const { data, isLoading, error } = useIntel();
  const queryClient = useQueryClient();
  const isOpsManager = canManageOperations(session.role);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<IntelItem | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["active", "archived"]));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["views", "intel"] });
  }

  async function handleArchive(id: string) {
    try {
      await api.post(`/api/intel/${id}/archive`);
      refresh();
    } catch { /* silently fail */ }
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  const activeItems = data.items.filter((i) => i.isActive);
  const archivedItems = data.items.filter((i) => !i.isActive);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Threat Picture
        </h1>
        <div className="flex items-center gap-2">
          {archivedItems.length > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-1 rounded-[var(--radius-md)] border px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] transition ${
                showArchived
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-bright)]"
              }`}
            >
              <Filter className="h-3 w-3" />
              Archived ({archivedItems.length})
            </button>
          )}
          {isOpsManager && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
            >
              <Plus className="h-3 w-3" />
              New Report
            </button>
          )}
        </div>
      </div>

      {/* Active Reports */}
      <CollapsibleCard
        id="active"
        expanded={expanded.has("active")}
        onToggle={() => toggle("active")}
        header={(isOpen) => (
          <div className="flex items-center gap-3">
            <Radar className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
              Active Reports
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
              {activeItems.length}
            </span>
            {!isOpen && activeItems.length > 0 && (
              <span className="text-[10px] text-[var(--color-text-faint)]">
                Highest: {severityLabel(Math.max(...activeItems.map((i) => i.severity)))} severity
              </span>
            )}
          </div>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {activeItems.map((item) => (
            <IntelCard
              key={item.id}
              item={item}
              isOps={isOpsManager}
              onEdit={setEditTarget}
              onArchive={handleArchive}
            />
          ))}
          {activeItems.length === 0 && (
            <p className="col-span-2 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
              No active intel reports
            </p>
          )}
        </div>
      </CollapsibleCard>

      {/* Archived Reports */}
      {showArchived && archivedItems.length > 0 && (
        <CollapsibleCard
          id="archived"
          expanded={expanded.has("archived")}
          onToggle={() => toggle("archived")}
          header={(isOpen) => (
            <div className="flex items-center gap-3">
              <Archive className="h-4 w-4 text-[var(--color-text-tertiary)]" />
              <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
                Archived Reports
              </span>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                {archivedItems.length}
              </span>
              {!isOpen && (
                <span className="text-[10px] text-[var(--color-text-faint)]">
                  Click to expand
                </span>
              )}
            </div>
          )}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {archivedItems.map((item) => (
              <IntelCard
                key={item.id}
                item={item}
                isOps={false}
                onEdit={() => {}}
                onArchive={() => {}}
              />
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* Create dialog */}
      {showCreate && (
        <IntelForm onClose={() => setShowCreate(false)} onSaved={refresh} />
      )}

      {/* Edit dialog */}
      {editTarget && (
        <IntelForm existing={editTarget} onClose={() => setEditTarget(null)} onSaved={refresh} />
      )}
    </div>
  );
}
