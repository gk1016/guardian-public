import { Link } from "react-router";
import { CheckCircle2, Crosshair, ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useMissions } from "@/hooks/use-views";
import { canManageMissions } from "@/lib/roles";
import type { MissionSummary } from "@/hooks/use-views";

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

const statusTone: Record<string, string> = {
  planning: "slate",
  ready: "amber",
  active: "emerald",
  launched: "emerald",
  complete: "sky",
  cancelled: "red",
};

function statusClasses(status: string) {
  const tone = statusTone[status] ?? "slate";
  return `border-${tone}-400/40 bg-${tone}-400/10 text-${tone}-300`;
}

const priorityTone: Record<string, string> = {
  critical: "red",
  high: "amber",
  routine: "slate",
  low: "slate",
};

/* ------------------------------------------------------------------ */
/*  Mission Card                                                       */
/* ------------------------------------------------------------------ */

function MissionCard({ m }: { m: MissionSummary }) {
  const pkg = m.packageSummary;
  const disc = m.packageDiscipline;
  const pTone = priorityTone[m.priority] ?? "slate";

  return (
    <Link
      to={`/missions/${m.id}`}
      className="block rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated transition-colors hover:border-[var(--color-border-hover)]"
    >
      {/* Top row: callsign + status */}
      <div className="mb-2 flex items-center gap-2">
        <Crosshair className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <span className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          {m.callsign}
        </span>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${statusClasses(m.status)}`}>
          {m.status}
        </span>
      </div>

      {/* Title + brief */}
      <p className="mb-1 text-sm font-medium text-[var(--color-text-strong)]">{m.title}</p>
      {m.missionBrief && (
        <p className="mb-2 line-clamp-2 text-xs text-[var(--color-text-secondary)]">{m.missionBrief}</p>
      )}

      {/* Meta row */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {m.missionType}
        </span>
        <span className={`rounded-full border border-${pTone}-400/30 bg-${pTone}-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-${pTone}-300`}>
          {m.priority}
        </span>
        {m.areaOfOperation && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            AO: {m.areaOfOperation}
          </span>
        )}
      </div>

      {/* Package readiness */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-3 w-3 text-[var(--color-text-tertiary)]" />
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Readiness
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">{pkg.readinessLabel}</span>
        <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
          {pkg.readyOrLaunched}/{pkg.total}
        </span>
      </div>

      {/* Discipline warnings */}
      {disc.warnings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {disc.warnings.map((w, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300"
            >
              <ShieldAlert className="h-2.5 w-2.5" />
              {w}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function MissionsPage() {
  const session = useSession();
  const { data, isLoading, error } = useMissions();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Missions
        </h1>
        {canManageMissions(session.role) && (
          <Link
            to="/missions/new"
            className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] px-4 py-2 text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-strong)]"
          >
            Create Mission
          </Link>
        )}
      </div>

      {/* Grid */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {data.items.map((m) => (
          <MissionCard key={m.id} m={m} />
        ))}
        {data.items.length === 0 && (
          <p className="col-span-3 py-12 text-center text-xs text-[var(--color-text-tertiary)]">
            No missions found
          </p>
        )}
      </div>
    </div>
  );
}
