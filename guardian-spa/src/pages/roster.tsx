import { Link } from "react-router";
import { Radar, Users } from "lucide-react";
import { useRoster } from "@/hooks/use-views";
import type { RosterMember } from "@/hooks/use-views";

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

const availabilityTone: Record<string, string> = {
  available: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  tasked: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  engaged: "border-red-500/20 bg-red-500/10 text-red-100",
};

/* ------------------------------------------------------------------ */
/*  Crew Card                                                          */
/* ------------------------------------------------------------------ */

function CrewCard({ crew }: { crew: RosterMember }) {
  const tone = availabilityTone[crew.availabilityLabel] ?? "border-[var(--color-border)] bg-[var(--color-overlay-subtle)] text-[var(--color-text-secondary)]";

  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
      {/* Header: name + availability badge */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
            {crew.displayName ?? crew.handle}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            {crew.handle} / {crew.orgRole}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${tone}`}>
          {crew.availabilityLabel}
        </span>
      </div>

      {/* Source + QRF / Platform */}
      <div className="mt-4 grid gap-2">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Source</p>
          <p className="mt-1 text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
            {crew.sourceLabel}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">QRF / Platform</p>
          <p className="mt-1 text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
            {crew.qrfStatus ?? "No QRF posture"} / {crew.suggestedPlatform ?? "Platform pending"}
          </p>
        </div>
      </div>

      {/* Current Commitments */}
      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-medium)] px-3 py-3">
        <div className="flex items-center gap-2">
          <Radar size={12} className="text-[var(--color-cyan)]" />
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Current Commitments</p>
        </div>
        <div className="mt-2 space-y-2">
          {crew.commitments.length > 0 ? (
            crew.commitments.map((c) => (
              <Link
                key={`${crew.handle}-${c.missionId}`}
                to={`/missions/${c.missionId}`}
                className="block rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2 transition hover:border-[var(--color-border-bright)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
                  {c.callsign}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  {c.assignmentStatus} / {c.role}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
                  Mission status {c.missionStatus}
                </p>
              </Link>
            ))
          ) : (
            <div className="rounded-[var(--radius-md)] border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] text-emerald-100">
              No active sortie commitment recorded.
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {crew.notes ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
          {crew.notes}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function RosterPage() {
  const { data, isLoading, error } = useRoster();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
            Crew Availability
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Live org and QRF roster with sortie commitments
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {data.items.length} crew
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {data.items.map((crew) => (
          <CrewCard key={crew.handle} crew={crew} />
        ))}
        {data.items.length === 0 && (
          <p className="col-span-3 py-12 text-center text-xs text-[var(--color-text-tertiary)]">
            No crew loaded yet.
          </p>
        )}
      </div>

      {/* Command Use advisory */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] p-5">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-amber-300" />
          <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
            Command Use
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          Use this board before package assignment. If a pilot is already marked{" "}
          <span className="font-semibold uppercase text-red-300">engaged</span>,
          treating them as free for another sortie is how command manufactures a fake roster.
        </p>
      </div>
    </div>
  );
}
