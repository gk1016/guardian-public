"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardList, Crosshair, LoaderCircle } from "lucide-react";
import { getMissionTemplate, missionTemplates } from "@/lib/mission-templates";

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
  const initialTemplate = getMissionTemplate("counter-piracy");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [templateCode, setTemplateCode] = useState(initialTemplate.code);
  const [callsign, setCallsign] = useState(initialTemplate.suggestedCallsign);
  const [title, setTitle] = useState(initialTemplate.suggestedTitle);
  const [missionType, setMissionType] = useState(initialTemplate.code);
  const [status, setStatus] = useState<(typeof statusOptions)[number]["value"]>("planning");
  const [priority, setPriority] = useState<(typeof priorityOptions)[number]["value"]>(initialTemplate.suggestedPriority);
  const [areaOfOperation, setAreaOfOperation] = useState(initialTemplate.suggestedAreaOfOperation);
  const [missionBrief, setMissionBrief] = useState(initialTemplate.suggestedBrief);

  const selectedTemplate = getMissionTemplate(templateCode);

  function applyTemplate(code: string) {
    const template = getMissionTemplate(code);
    setTemplateCode(template.code);
    setMissionType(template.code);
    setCallsign(template.suggestedCallsign);
    setTitle(template.suggestedTitle);
    setPriority(template.suggestedPriority);
    setAreaOfOperation(template.suggestedAreaOfOperation);
    setMissionBrief(template.suggestedBrief);
    setStatus("planning");
  }

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
      <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">Mission Template</p>
            <h2 className="mt-2 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
              {selectedTemplate.label}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">{selectedTemplate.summary}</p>
          </div>
          <ClipboardList size={18} className="mt-1 text-cyan-200" />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-cyan-100">Template</span>
            <select
              value={templateCode}
              onChange={(event) => applyTemplate(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
            >
              {missionTemplates.map((template) => (
                <option key={template.code} value={template.code}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
            <div>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Expected Package</span>
              <p className="mt-1 font-semibold uppercase tracking-[0.14em] text-white">
                {selectedTemplate.recommendedPackage}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Suggested Doctrine</span>
              <p className="mt-1 font-semibold uppercase tracking-[0.14em] text-white">
                {selectedTemplate.recommendedDoctrine}
              </p>
            </div>
          </div>
        </div>
      </section>

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
          Template selection only seeds the sortie. Command can still edit every field before launch.
        </span>
      </div>
    </form>
  );
}
