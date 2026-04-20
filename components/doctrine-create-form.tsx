"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FilePlus2, LoaderCircle } from "lucide-react";

export function DoctrineCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [code, setCode] = useState("counter_piracy_cap");
  const [title, setTitle] = useState("Counter-Piracy CAP / Civilian Lane Shield");
  const [category, setCategory] = useState("counter-piracy");
  const [summary, setSummary] = useState(
    "Default CAP doctrine for civilian-lane protection, pirate interdiction, and restraint before positive identification.",
  );
  const [body, setBody] = useState(
    "1. Establish high/low cover over the civilian lane. 2. Force hostile contacts to commit into your geometry before merging. 3. Keep one element free to shield noncombatants or rescue traffic. 4. Break pursuit the moment the lane is secure and the package commander calls egress.",
  );
  const [escalation, setEscalation] = useState(
    "Escalate to weapons tight when pirate lock posture or bait distress operations are confirmed in the area of operation.",
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/doctrine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            title,
            category,
            summary,
            body,
            escalation,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Doctrine creation failed.");
          return;
        }

        router.refresh();
      } catch {
        setError("Doctrine creation failed.");
      }
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Category</span>
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Summary</span>
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={3}
          className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition focus:border-amber-300/40"
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Execution Checklist</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
          className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition focus:border-amber-300/40"
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Escalation Guidance</span>
        <textarea
          value={escalation}
          onChange={(event) => setEscalation(event.target.value)}
          rows={3}
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
        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <FilePlus2 size={16} />}
        {isPending ? "Saving doctrine" : "Save doctrine"}
      </button>
    </form>
  );
}
