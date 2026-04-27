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

const tierTone: Record<string, string> = {
  active: "emerald",
  moderate: "amber",
  dormant: "slate",
  dark: "red",
};

const adminRoles = new Set(["commander", "director", "admin"]);

/* ------------------------------------------------------------------ */
/*  Member Card                                                        */
/* ------------------------------------------------------------------ */

function MemberCard({ m }: { m: RosterMember }) {
  const tone = tierTone[m.activityTier] ?? "slate";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
      {/* Handle + admin badge */}
      <div className="mb-2 flex items-center gap-2">
        <span className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          {m.handle}
        </span>
        {adminRoles.has(m.role) && (
          <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-sky-300">
            {m.role}
          </span>
        )}
      </div>

      {/* Display name */}
      {m.displayName && m.displayName !== m.handle && (
        <p className="mb-1 text-xs text-[var(--color-text-secondary)]">{m.displayName}</p>
      )}

      {/* Rank + title */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {m.rank && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            {m.rank}
          </span>
        )}
        {m.title && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            {m.title}
          </span>
        )}
      </div>

      {/* Activity */}
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full bg-${tone}-400`} />
        <span className={`text-[10px] uppercase tracking-[0.12em] text-${tone}-300`}>
          {m.activityTier}
        </span>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          Score: {m.activityScore}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Missions</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.missionCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Logs</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.logCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Last Seen</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.lastSeenLabel}</p>
        </div>
      </div>
    </div>
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
        <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Roster
        </h1>
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {data.items.length} member{data.items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {data.items.map((m) => (
          <MemberCard key={m.userId} m={m} />
        ))}
        {data.items.length === 0 && (
          <p className="col-span-3 py-12 text-center text-xs text-[var(--color-text-tertiary)]">
            No roster members found
          </p>
        )}
      </div>
    </div>
  );
}
