"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, UserPlus } from "lucide-react";

const participantStatusOptions = [
  { value: "open", label: "Open Slot" },
  { value: "assigned", label: "Assigned" },
  { value: "ready", label: "Ready" },
  { value: "launched", label: "Launched" },
  { value: "rtb", label: "RTB" },
] as const;

type ParticipantAssignFormProps = {
  missionId: string;
};

export function ParticipantAssignForm({ missionId }: ParticipantAssignFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [handle, setHandle] = useState("SABER1");
  const [role, setRole] = useState("Escort Lead");
  const [platform, setPlatform] = useState("F7A Mk II");
  const [status, setStatus] =
    useState<(typeof participantStatusOptions)[number]["value"]>("assigned");
  const [notes, setNotes] = useState("Hold high cover and prosecute pirate interceptors.");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/missions/${missionId}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            handle,
            role,
            platform,
            status,
            notes,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Participant assignment failed.");
          return;
        }

        setHandle("SABER1");
        setRole("Escort Lead");
        setPlatform("F7A Mk II");
        setStatus("assigned");
        setNotes("Hold high cover and prosecute pirate interceptors.");
        router.refresh();
      } catch {
        setError("Participant assignment failed.");
      }
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Handle</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            className="w-full rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-[var(--color-text-strong)] outline-none transition focus:border-amber-300/40"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Role</span>
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-[var(--color-text-strong)] outline-none transition focus:border-amber-300/40"
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Platform</span>
          <input
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            className="w-full rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-[var(--color-text-strong)] outline-none transition focus:border-amber-300/40"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Readiness</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as (typeof participantStatusOptions)[number]["value"])}
            className="w-full rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-[var(--color-text-strong)] outline-none transition focus:border-amber-300/40"
          >
            {participantStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
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
        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <UserPlus size={16} />}
        {isPending ? "Assigning" : "Assign participant"}
      </button>
    </form>
  );
}
