import { useState } from "react";
import { Link } from "react-router";
import { Crosshair, Plus, Pencil, Archive, Filter } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { useThreatActors } from "@/hooks/use-views";
import { canManageOperations } from "@/lib/roles";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ThreatActorForm } from "@/components/threat-actor-form";
import { api } from "@/lib/api";
import type { ThreatActorItem } from "@/hooks/use-views";

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

function threatLevelColor(level: string): string {
  switch (level) {
    case "critical": return "red";
    case "high": return "amber";
    case "medium": return "yellow";
    default: return "slate";
  }
}

function actorTypeLabel(t: string): string {
  return t.replaceAll("_", " ");
}

function threatScore(cap: number, intent: number, opp: number): string {
  return ((cap + intent + opp) / 3).toFixed(1);
}

/* ------------------------------------------------------------------ */
/*  Rating Bar                                                         */
/* ------------------------------------------------------------------ */

function RatingBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 8 ? "bg-red-400" : value >= 5 ? "bg-amber-400" : "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-[var(--color-overlay-subtle)]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-4 text-[10px] font-semibold text-[var(--color-text-secondary)]">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Actor Card                                                         */
/* ------------------------------------------------------------------ */

function ActorCard({
  item,
  isOps,
  onEdit,
  onArchive,
}: {
  item: ThreatActorItem;
  isOps: boolean;
  onEdit: (item: ThreatActorItem) => void;
  onArchive: (id: string) => void;
}) {
  const tone = threatLevelColor(item.threatLevel);
  const score = threatScore(item.capabilityRating, item.intentRating, item.opportunityRating);

  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated ${!item.isActive ? "opacity-50" : ""}`}>
      {/* Header row */}
      <div className="mb-2 flex items-center gap-2">
        <Crosshair className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <span className="text-sm font-medium text-[var(--color-text-strong)]">{item.name}</span>
        <span className={`ml-auto rounded-full border border-${tone}-400/30 bg-${tone}-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-${tone}-300`}>
          {item.threatLevel}
        </span>
      </div>

      {/* Meta row: type + score */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
          {actorTypeLabel(item.actorType)}
        </span>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          Threat Score: <span className="font-semibold text-[var(--color-text-secondary)]">{score}</span>
        </span>
        {item.aliases.length > 0 && (
          <span className="text-[10px] text-[var(--color-text-faint)]">
            AKA: {item.aliases.join(", ")}
          </span>
        )}
        {!item.isActive && (
          <span className="rounded-full border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-red-300">
            archived
          </span>
        )}
      </div>

      {/* Ratings */}
      <div className="mb-3 space-y-1">
        <RatingBar label="CAP" value={item.capabilityRating} />
        <RatingBar label="INT" value={item.intentRating} />
        <RatingBar label="OPP" value={item.opportunityRating} />
      </div>

      {/* Description */}
      <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
        {item.description || "No description."}
      </p>

      {/* TTPs */}
      {item.knownTtps.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Known TTPs</p>
          <div className="flex flex-wrap gap-1">
            {item.knownTtps.map((ttp) => (
              <span key={ttp} className="rounded-full border border-red-400/20 bg-red-400/5 px-2 py-0.5 text-[10px] text-red-300/80">
                {ttp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Assets */}
      {item.knownAssets.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Known Assets</p>
          <div className="flex flex-wrap gap-1">
            {item.knownAssets.map((asset) => (
              <span key={asset} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                {asset}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Area of Operations + Location */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {item.areaOfOperations.length > 0 && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            AO: {item.areaOfOperations.join(", ")}
          </span>
        )}
        {item.lastKnownLocation && (
          <span className="text-[10px] text-[var(--color-text-faint)]">
            Last seen: {item.lastKnownLocation}
          </span>
        )}
      </div>

      {/* Linked intel */}
      <div className="mt-3 border-t border-[var(--color-border)] pt-2">
        <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Linked Intel
        </p>
        {item.linkedIntel.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.linkedIntel.map((li) => (
              <span
                key={li.intelId}
                className="rounded-full border border-[var(--color-border-bright)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)]"
              >
                {li.intelTitle} ({li.linkType})
              </span>
            ))}
          </div>
        ) : (
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-faint)]">
            No linked intel
          </span>
        )}
      </div>

      {/* Timestamps + actions */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
        <div className="flex gap-3 text-[9px] text-[var(--color-text-faint)]">
          {item.lastActivityAt && <span>Last activity: {new Date(item.lastActivityAt).toLocaleDateString()}</span>}
          {item.firstObserved && <span>First observed: {new Date(item.firstObserved).toLocaleDateString()}</span>}
          {item.createdAt && <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>}
        </div>
        {isOps && item.isActive && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(item)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-1.5 text-[var(--color-text-tertiary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              title="Edit actor"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onArchive(item.id)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-1.5 text-[var(--color-text-tertiary)] hover:border-red-400 hover:text-red-400"
              title="Archive actor"
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

export function ThreatActorsPage() {
  const session = useSession();
  const { data, isLoading, error } = useThreatActors();
  const queryClient = useQueryClient();
  const isOpsManager = canManageOperations(session.role);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ThreatActorItem | null>(null);
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
    queryClient.invalidateQueries({ queryKey: ["views", "threat-actors"] });
  }

  async function handleArchive(id: string) {
    try {
      await api.post(`/api/threat-actors/${id}/archive`);
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
          Threat Actors
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
              New Threat Actor
            </button>
          )}
        </div>
      </div>

      {/* Active Actors */}
      <CollapsibleCard
        id="active"
        expanded={expanded.has("active")}
        onToggle={() => toggle("active")}
        header={(isOpen) => (
          <div className="flex items-center gap-3">
            <Crosshair className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
              Active Threat Actors
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
              {activeItems.length}
            </span>
            {!isOpen && activeItems.length > 0 && (
              <span className="text-[10px] text-[var(--color-text-faint)]">
                Highest: {activeItems[0]?.threatLevel}
              </span>
            )}
          </div>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {activeItems.map((item) => (
            <ActorCard
              key={item.id}
              item={item}
              isOps={isOpsManager}
              onEdit={setEditTarget}
              onArchive={handleArchive}
            />
          ))}
          {activeItems.length === 0 && (
            <p className="col-span-2 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
              No active threat actors
            </p>
          )}
        </div>
      </CollapsibleCard>

      {/* Archived Actors */}
      {showArchived && archivedItems.length > 0 && (
        <CollapsibleCard
          id="archived"
          expanded={expanded.has("archived")}
          onToggle={() => toggle("archived")}
          header={(isOpen) => (
            <div className="flex items-center gap-3">
              <Archive className="h-4 w-4 text-[var(--color-text-tertiary)]" />
              <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
                Archived Threat Actors
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
              <ActorCard
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
        <ThreatActorForm onClose={() => setShowCreate(false)} onSaved={refresh} />
      )}

      {/* Edit dialog */}
      {editTarget && (
        <ThreatActorForm existing={editTarget} onClose={() => setEditTarget(null)} onSaved={refresh} />
      )}
    </div>
  );
}
