import { useState } from "react";
import { AlertTriangle, FileCheck2, LoaderCircle } from "lucide-react";

const finalStatusOptions = [
  { value: "complete", label: "Complete" },
  { value: "aborted", label: "Aborted" },
] as const;

type MissionCloseoutFormProps = {
  missionId: string;
  initialFinalStatus: "complete" | "aborted";
  initialCloseoutSummary: string;
  initialAarSummary: string;
  onSuccess?: () => void;
};

export function MissionCloseoutForm({
  missionId,
  initialFinalStatus,
  initialCloseoutSummary,
  initialAarSummary,
  onSuccess,
}: MissionCloseoutFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [finalStatus, setFinalStatus] =
    useState<(typeof finalStatusOptions)[number]["value"]>(initialFinalStatus);
  const [closeoutSummary, setCloseoutSummary] = useState(initialCloseoutSummary);
  const [aarSummary, setAarSummary] = useState(initialAarSummary);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const response = await fetch(`/api/missions/${missionId}/closeout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          finalStatus,
          closeoutSummary,
          aarSummary,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Mission closeout failed.");
        return;
      }

      onSuccess?.();
    } catch {
      setError("Mission closeout failed.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Final Status</span>
        <select
          value={finalStatus}
          onChange={(event) => setFinalStatus(event.target.value as (typeof finalStatusOptions)[number]["value"])}
          className="w-full rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-[var(--color-text-strong)] outline-none transition focus:border-amber-300/40"
        >
          {finalStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Closeout Summary</span>
        <textarea
          value={closeoutSummary}
          onChange={(event) => setCloseoutSummary(event.target.value)}
          rows={4}
          className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-[var(--color-text-strong)] outline-none transition focus:border-amber-300/40"
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">AAR Package</span>
        <textarea
          value={aarSummary}
          onChange={(event) => setAarSummary(event.target.value)}
          rows={6}
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
        className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/35 bg-amber-300 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
        {isPending ? "Closing mission" : "Close mission"}
      </button>
    </form>
  );
}
