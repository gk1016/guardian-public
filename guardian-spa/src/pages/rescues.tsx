import { HeartPulse, LifeBuoy, ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useRescues } from "@/hooks/use-views";
import { canManageOperations } from "@/lib/roles";
import type { RescueSummary } from "@/hooks/use-views";

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

const urgencyTone: Record<string, string> = {
  critical: "red",
  high: "amber",
  medium: "yellow",
  low: "slate",
};

const statusTone: Record<string, string> = {
  pending: "amber",
  dispatched: "sky",
  active: "emerald",
  resolved: "slate",
  cancelled: "red",
};

/* ------------------------------------------------------------------ */
/*  Rescue Card                                                        */
/* ------------------------------------------------------------------ */

function RescueCard({ r }: { r: RescueSummary }) {
  const uTone = urgencyTone[r.urgency] ?? "slate";
  const sTone = statusTone[r.status] ?? "slate";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <LifeBuoy className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <span className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          {r.survivorHandle}
        </span>
        <span className={`ml-auto rounded-full border border-${uTone}-400/30 bg-${uTone}-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-${uTone}-300`}>
          {r.urgency}
        </span>
      </div>

      {/* Location + status */}
      <div className="mb-2 flex items-center gap-2">
        {r.locationName && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            {r.locationName}
          </span>
        )}
        <span className={`rounded-full border border-${sTone}-400/30 bg-${sTone}-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-${sTone}-300`}>
          {r.status}
        </span>
      </div>

      {/* Threat summary */}
      {r.threatSummary && (
        <div className="mb-2 flex items-start gap-1.5">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/70" />
          <p className="text-xs text-[var(--color-text-secondary)]">{r.threatSummary}</p>
        </div>
      )}

      {/* Rescue notes */}
      {r.rescueNotes && (
        <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">{r.rescueNotes}</p>
      )}

      {/* Requirement badges */}
      <div className="mb-2 flex flex-wrap gap-2">
        {r.escortRequired && (
          <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">
            <ShieldAlert className="h-2.5 w-2.5" />
            Escort Required
          </span>
        )}
        {r.medicalRequired && (
          <span className="flex items-center gap-1 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] text-red-300">
            <HeartPulse className="h-2.5 w-2.5" />
            Medical Required
          </span>
        )}
      </div>

      {/* Payment */}
      {r.offeredPayment && (
        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Payment: {r.offeredPayment}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function RescuesPage() {
  const session = useSession();
  const { data, isLoading, error } = useRescues();
  const isOpsManager = canManageOperations(session.role);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Rescues
        </h1>
        {isOpsManager && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            {/* TODO: Create rescue button */}
            TODO: Create Rescue
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.items.map((r) => (
          <RescueCard key={r.id} r={r} />
        ))}
        {data.items.length === 0 && (
          <p className="col-span-2 py-12 text-center text-xs text-[var(--color-text-tertiary)]">
            No rescue operations
          </p>
        )}
      </div>
    </div>
  );
}
