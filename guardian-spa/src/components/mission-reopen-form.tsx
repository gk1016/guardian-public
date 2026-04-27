import { useState } from "react";
import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";

const reopenStatusOptions = [
  { value: "planning", label: "Planning" },
  { value: "ready", label: "Ready" },
  { value: "active", label: "Active" },
] as const;

type MissionReopenFormProps = {
  missionId: string;
  onSuccess?: () => void;
};

export function MissionReopenForm({ missionId, onSuccess }: MissionReopenFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<(typeof reopenStatusOptions)[number]["value"]>("planning");
  const [reason, setReason] = useState(
    "Threat picture changed after closeout. Reopening sortie to revise package tasking and republish the mission brief.",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const response = await fetch(`/api/missions/${missionId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status,
          reason,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Mission reopen failed.");
        return;
      }

      onSuccess?.();
    } catch {
      setError("Mission reopen failed.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Reopen To</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as (typeof reopenStatusOptions)[number]["value"])}
          className="w-full rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-[var(--color-text-strong)] outline-none transition focus:border-amber-300/40"
        >
          {reopenStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Revision Reason</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={5}
          className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-[var(--color-text-strong)] outline-none transition focus:border-amber-300/40"
        />
      </label>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-300 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <RotateCcw size={16} />}
        {isPending ? "Reopening mission" : "Reopen mission"}
      </button>
    </form>
  );
}
