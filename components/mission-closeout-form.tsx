"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
};

export function MissionCloseoutForm({
  missionId,
  initialFinalStatus,
  initialCloseoutSummary,
  initialAarSummary,
}: MissionCloseoutFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [finalStatus, setFinalStatus] =
    useState<(typeof finalStatusOptions)[number]["value"]>(initialFinalStatus);
  const [closeoutSummary, setCloseoutSummary] = useState(initialCloseoutSummary);
  const [aarSummary, setAarSummary] = useState(initialAarSummary);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/missions/${missionId}/closeout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

        router.refresh();
      } catch {
        setError("Mission closeout failed.");
      }
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Final Status</span>
        <select
          value={finalStatus}
          onChange={(event) => setFinalStatus(event.target.value as (typeof finalStatusOptions)[number]["value"])}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
        >
          {finalStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Closeout Summary</span>
        <textarea
          value={closeoutSummary}
          onChange={(event) => setCloseoutSummary(event.target.value)}
          rows={4}
          className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition focus:border-amber-300/40"
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">AAR Package</span>
        <textarea
          value={aarSummary}
          onChange={(event) => setAarSummary(event.target.value)}
          rows={6}
          className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition focus:border-amber-300/40"
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
