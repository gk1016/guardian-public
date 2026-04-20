"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Save } from "lucide-react";

const statusOptions = [
  { value: "planning", label: "Planning" },
  { value: "ready", label: "Ready" },
  { value: "active", label: "Active" },
  { value: "complete", label: "Complete" },
  { value: "aborted", label: "Aborted" },
] as const;

const priorityOptions = [
  { value: "routine", label: "Routine" },
  { value: "priority", label: "Priority" },
  { value: "critical", label: "Critical" },
] as const;

type MissionEditFormProps = {
  missionId: string;
  initialMission: {
    callsign: string;
    title: string;
    missionType: string;
    status: string;
    priority: string;
    areaOfOperation: string | null;
    missionBrief: string | null;
  };
};

export function MissionEditForm({ missionId, initialMission }: MissionEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [callsign, setCallsign] = useState(initialMission.callsign);
  const [title, setTitle] = useState(initialMission.title);
  const [missionType, setMissionType] = useState(initialMission.missionType);
  const [status, setStatus] = useState(initialMission.status);
  const [priority, setPriority] = useState(initialMission.priority);
  const [areaOfOperation, setAreaOfOperation] = useState(initialMission.areaOfOperation ?? "");
  const [missionBrief, setMissionBrief] = useState(initialMission.missionBrief ?? "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/missions/${missionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callsign,
            title,
            missionType,
            status,
            priority,
            areaOfOperation,
            missionBrief,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Mission update failed.");
          return;
        }

        router.refresh();
      } catch {
        setError("Mission update failed.");
      }
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Callsign</span>
          <input
            value={callsign}
            onChange={(event) => setCallsign(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Mission Type</span>
          <input
            value={missionType}
            onChange={(event) => setMissionType(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Mission Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Priority</span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Area of Operation</span>
          <input
            value={areaOfOperation}
            onChange={(event) => setAreaOfOperation(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Mission Brief</span>
        <textarea
          value={missionBrief}
          onChange={(event) => setMissionBrief(event.target.value)}
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
        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
        {isPending ? "Saving mission" : "Save mission"}
      </button>
    </form>
  );
}
