import { Link } from "react-router";
import { Radar, ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useIntel } from "@/hooks/use-views";
import { canManageOperations } from "@/lib/roles";
import type { IntelItem } from "@/hooks/use-views";

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
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

/* ------------------------------------------------------------------ */
/*  Intel Card                                                         */
/* ------------------------------------------------------------------ */

function IntelCard({ item }: { item: IntelItem }) {
  const tone = severityColor(item.severity);
  const label = severityLabel(item.severity);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Radar className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <span className="text-sm font-medium text-[var(--color-text-strong)]">{item.title}</span>
        <span className={`ml-auto rounded-full border border-${tone}-400/30 bg-${tone}-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-${tone}-300`}>
          {label} ({item.severity})
        </span>
      </div>

      {/* Report type + confidence */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {item.reportType.replaceAll("_", " ")}
        </span>
        {item.confidence && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Confidence: {item.confidence}
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
        </span>
        <span className="flex items-center gap-1 text-[10px] text-red-300/80">
          <ShieldAlert className="h-2.5 w-2.5" />
          {item.hostileGroup || "Unconfirmed hostile group"}
        </span>
      </div>

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]"
            >
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function IntelPage() {
  const session = useSession();
  const { data, isLoading, error } = useIntel();
  const isOpsManager = canManageOperations(session.role);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Threat Picture
        </h1>
        {isOpsManager && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            {/* TODO: Create intel button */}
            TODO: Create Intel
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.items.map((item) => (
          <IntelCard key={item.id} item={item} />
        ))}
        {data.items.length === 0 && (
          <p className="col-span-2 py-12 text-center text-xs text-[var(--color-text-tertiary)]">
            No intel reports
          </p>
        )}
      </div>
    </div>
  );
}
