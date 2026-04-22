"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, NotebookText } from "lucide-react";

const logEntryOptions = [
  { value: "status", label: "Status" },
  { value: "contact", label: "Contact" },
  { value: "command", label: "Command" },
  { value: "aar", label: "AAR" },
] as const;

type MissionLogFormProps = {
  missionId: string;
};

export function MissionLogForm({ missionId }: MissionLogFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [entryType, setEntryType] =
    useState<(typeof logEntryOptions)[number]["value"]>("status");
  const [message, setMessage] = useState(
    "Package checked in. Threat picture stable and sortie remains on timeline.",
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/missions/${missionId}/logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryType,
            message,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Mission log update failed.");
          return;
        }

        setEntryType("status");
        setMessage("Package checked in. Threat picture stable and sortie remains on timeline.");
        router.refresh();
      } catch {
        setError("Mission log update failed.");
      }
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Entry Type</span>
        <select
          value={entryType}
          onChange={(event) => setEntryType(event.target.value as (typeof logEntryOptions)[number]["value"])}
          className="w-full rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-[var(--color-text-strong)] outline-none transition focus:border-amber-300/40"
        >
          {logEntryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Timeline Entry</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
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
        className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/35 bg-amber-300 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <NotebookText size={16} />}
        {isPending ? "Logging" : "Add timeline entry"}
      </button>
    </form>
  );
}
