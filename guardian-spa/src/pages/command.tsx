import { Link } from "react-router";
import { AlertTriangle, Crosshair, Siren } from "lucide-react";
import { useCommandOverview } from "@/hooks/use-views";
import type { MissionSummary, QrfSummary, IntelSummary, RescueSummary } from "@/hooks/use-views";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
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

function statusBorderClass(status: string) {
  const tone = statusTone[status] ?? "slate";
  return `border-${tone}-400/40 bg-${tone}-400/10 text-${tone}-300`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MissionCard({ m }: { m: MissionSummary }) {
  const pkg = m.packageSummary;
  const disc = m.packageDiscipline;

  return (
    <Link
      to={`/missions/${m.id}`}
      className="block rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated transition-colors hover:border-[var(--color-border-hover)]"
    >
      <div className="mb-2 flex items-center gap-2">
        <Crosshair className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <span className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          {m.callsign}
        </span>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${statusBorderClass(m.status)}`}>
          {m.status}
        </span>
      </div>

      <p className="mb-1 text-xs text-[var(--color-text-secondary)]">{m.title}</p>
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {m.missionType} &middot; {m.priority} &middot; {m.areaOfOperation}
      </p>

      {/* Package readiness */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Readiness
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">{pkg.readinessLabel}</span>
        {/* TODO: ReadinessGauge component */}
      </div>

      {/* Discipline warnings */}
      {disc.warnings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {disc.warnings.map((w, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {w}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function QrfCard({ q }: { q: QrfSummary }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4 panel-elevated">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          {q.callsign}
        </span>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${statusBorderClass(q.status)}`}>
          {q.status}
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {q.platform} &middot; {q.locationName}
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        Crew: {q.availableCrew}
      </p>
      {q.notes && (
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{q.notes}</p>
      )}
    </div>
  );
}

function IntelCard({ item }: { item: IntelSummary }) {
  const severityTone: Record<string, string> = {
    critical: "red",
    high: "amber",
    medium: "yellow",
    low: "slate",
  };
  const tone = severityTone[item.severity] ?? "slate";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4 panel-elevated">
      <div className="mb-1 flex items-center gap-2">
        <Crosshair className="h-3 w-3 text-[var(--color-text-tertiary)]" />
        <span className="text-xs font-medium text-[var(--color-text-strong)]">{item.title}</span>
        <span className={`ml-auto rounded-full border border-${tone}-400/30 bg-${tone}-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-${tone}-300`}>
          {item.severity}
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {item.reportType} &middot; {item.locationName}
      </p>
      {item.hostileGroup && (
        <p className="mt-1 text-xs text-red-300/80">{item.hostileGroup}</p>
      )}
    </div>
  );
}

function RescueCard({ r }: { r: RescueSummary }) {
  const urgencyTone: Record<string, string> = {
    critical: "red",
    high: "amber",
    medium: "yellow",
    low: "slate",
  };
  const tone = urgencyTone[r.urgency] ?? "slate";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4 panel-elevated">
      <div className="mb-1 flex items-center gap-2">
        <Siren className="h-3.5 w-3.5 text-red-400" />
        <span className="text-xs font-medium text-[var(--color-text-strong)]">{r.survivorHandle}</span>
        <span className={`ml-auto rounded-full border border-${tone}-400/30 bg-${tone}-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-${tone}-300`}>
          {r.urgency}
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {r.locationName} &middot; {r.status}
      </p>
      {r.threatSummary && (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{r.threatSummary}</p>
      )}
      <div className="mt-2 flex gap-2">
        {r.escortRequired && (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">
            Escort
          </span>
        )}
        {r.medicalRequired && (
          <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] text-red-300">
            Medical
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function CommandPage() {
  const { data, isLoading, error } = useCommandOverview();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Command Overview
        </h1>
        {/* TODO: LiveCounters component */}
      </div>

      {/* Stat counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Active Missions", value: data.activeMissionCount },
          { label: "Open Rescues", value: data.openRescueCount },
          { label: "Active Intel", value: data.activeIntelCount },
          { label: "QRF Ready", value: data.qrfReadyCount },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4 panel-elevated text-center"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {s.label}
            </p>
            <p className="mt-1 font-[family:var(--font-display)] text-2xl text-[var(--color-text-strong)]">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main grid: missions left, qrf+intel right */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mission board — 2 cols wide */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
              Mission Board
            </h2>
            <Link
              to="/missions"
              className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.missions.slice(0, 4).map((m) => (
              <MissionCard key={m.id} m={m} />
            ))}
            {data.missions.length === 0 && (
              <p className="col-span-2 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
                No active missions
              </p>
            )}
          </div>
          {/* TODO: CommandTimeline component */}
        </div>

        {/* Right column: QRF + Intel */}
        <div className="space-y-6">
          {/* QRF Board */}
          <div className="space-y-3">
            <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
              QRF Board
            </h2>
            <div className="space-y-3">
              {data.qrf.slice(0, 4).map((q) => (
                <QrfCard key={q.id} q={q} />
              ))}
              {data.qrf.length === 0 && (
                <p className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">
                  No QRF elements
                </p>
              )}
            </div>
          </div>

          {/* Threat Summary */}
          <div className="space-y-3">
            <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
              Threat Summary
            </h2>
            <div className="space-y-3">
              {data.intel.slice(0, 4).map((item) => (
                <IntelCard key={item.id} item={item} />
              ))}
              {data.intel.length === 0 && (
                <p className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">
                  No active intel
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rescue queue — full width, 3-column grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
            Rescue Queue
          </h2>
          <Link
            to="/rescues"
            className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
          >
            View all
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.rescues.slice(0, 6).map((r) => (
            <RescueCard key={r.id} r={r} />
          ))}
          {data.rescues.length === 0 && (
            <p className="col-span-3 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
              No open rescues
            </p>
          )}
        </div>
      </div>

      {/* TODO: MissionQuickActions component */}
    </div>
  );
}
