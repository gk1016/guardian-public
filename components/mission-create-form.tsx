"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Crosshair, LoaderCircle } from "lucide-react";

const statusOptions = [
  { value: "planning", label: "Planning" },
  { value: "ready", label: "Ready" },
  { value: "active", label: "Active" },
] as const;

const priorityOptions = [
  { value: "routine", label: "Routine" },
  { value: "priority", label: "Priority" },
  { value: "critical", label: "Critical" },
] as const;

export function MissionCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [callsign, setCallsign] = useState("VIGIL 21");
  const [title, setTitle] = useState("Interdict pirate strike package");
  const [missionType, setMissionType] = useState("counter-piracy");
  const [status, setStatus] = useState<(typeof statusOptions)[number]["value"]>("planning");
  const [priority, setPriority] = useState<(typeof priorityOptions)[number]["value"]>("priority");
  const [areaOfOperation, setAreaOfOperation] = useState("Yela common lanes");
  const [missionBrief, setMissionBrief] = useState(
    "Launch two-ship CAP with escort reserve. Interdict hostile pack, protect civilians, and hold contact reports for follow-on QRF.",
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/missions", {
          method: "POST",
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
          setError(payload.error || "Mission creation failed.");
          return;
        }

        router.push("/missions");
        router.refresh();
      } catch {
        setError("Mission creation failed.");
      }
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="grid gap-5 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Callsign</span>
          <input
            value={callsign}
            onChange={(event) => setCallsign(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
            placeholder="VIGIL 21"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Mission Type</span>
          <input
            value={missionType}
            onChange={(event) => setMissionType(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
            placeholder="counter-piracy"
          />
        </label>
      </section>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Mission Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
          placeholder="Interdict pirate strike package"
        />
      </label>

      <section className="grid gap-5 lg:grid-cols-3">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number]["value"])}
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
            onChange={(event) => setPriority(event.target.value as (typeof priorityOptions)[number]["value"])}
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
            placeholder="Yela common lanes"
          />
        </label>
      </section>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Mission Brief</span>
        <textarea
          value={missionBrief}
          onChange={(event) => setMissionBrief(event.target.value)}
          rows={6}
          className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition focus:border-amber-300/40"
          placeholder="Tasking, threat, launch posture, and end state."
        />
      </label>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/35 bg-amber-300 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Crosshair size={16} />}
          {isPending ? "Creating mission" : "Create mission"}
        </button>
        <span className="text-sm text-slate-400">
          This write path is commander-gated and posts directly into Guardian&apos;s mission table.
        </span>
      </div>
    </form>
  );
}
