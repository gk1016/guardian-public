import { useState } from "react";
import { ChevronRight, Play, Shield, XCircle } from "lucide-react";

type MissionQuickActionsProps = {
  missionId: string;
  currentStatus: string;
  callsign: string;
  participantCount: number;
  readyCount: number;
  onSuccess?: () => void;
};

const transitionConfig: Record<string, { target: string; label: string; icon: React.ReactNode; color: string }[]> = {
  planning: [
    {
      target: "ready",
      label: "Ready Check",
      icon: <Shield size={11} />,
      color: "border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20",
    },
    {
      target: "aborted",
      label: "Abort",
      icon: <XCircle size={11} />,
      color: "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
    },
  ],
  ready: [
    {
      target: "active",
      label: "Activate",
      icon: <Play size={11} />,
      color: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20",
    },
    {
      target: "planning",
      label: "Stand Down",
      icon: <ChevronRight size={11} className="rotate-180" />,
      color: "border-slate-400/30 bg-slate-400/10 text-slate-300 hover:bg-slate-400/20",
    },
  ],
  active: [
    {
      target: "planning",
      label: "Stand Down",
      icon: <ChevronRight size={11} className="rotate-180" />,
      color: "border-slate-400/30 bg-slate-400/10 text-slate-300 hover:bg-slate-400/20",
    },
    {
      target: "aborted",
      label: "Abort",
      icon: <XCircle size={11} />,
      color: "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
    },
  ],
};

export function MissionQuickActions({
  missionId,
  currentStatus,
  callsign,
  participantCount,
  readyCount,
  onSuccess,
}: MissionQuickActionsProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = transitionConfig[currentStatus];
  if (!actions || actions.length === 0) return null;

  async function handleTransition(targetStatus: string) {
    setPending(targetStatus);
    setError(null);

    try {
      const res = await fetch(`/api/missions/${missionId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Transition failed.");
        return;
      }

      onSuccess?.();
    } catch {
      setError("Network error.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((action) => (
          <button
            key={action.target}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleTransition(action.target);
            }}
            disabled={pending !== null}
            className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition disabled:opacity-50 ${action.color}`}
          >
            {pending === action.target ? (
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
            ) : (
              action.icon
            )}
            {action.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="mt-1.5 text-[10px] text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
