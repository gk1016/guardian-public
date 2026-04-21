"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none";
const selectClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/20 px-3 py-2 text-sm text-white focus:border-cyan-400/40 focus:outline-none";
const labelClass = "block text-[10px] uppercase tracking-[0.1em] text-slate-500 mb-1.5";

export function IntelCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const tagsRaw = (fd.get("tags") as string) || "";
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    const body = {
      title: fd.get("title") as string,
      reportType: fd.get("reportType") as string,
      description: (fd.get("description") as string) || undefined,
      severity: Number(fd.get("severity")),
      locationName: (fd.get("locationName") as string) || undefined,
      starSystem: (fd.get("starSystem") as string) || undefined,
      hostileGroup: (fd.get("hostileGroup") as string) || undefined,
      confidence: fd.get("confidence") as string,
      tags: tags.length > 0 ? tags : undefined,
    };

    startTransition(async () => {
      const res = await fetch("/api/intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to file intel report.");
        return;
      }
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      {error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">{error}</div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelClass}>Title</label>
          <input name="title" required minLength={3} maxLength={200} placeholder="Hostile contact at..." className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Report Type</label>
          <select name="reportType" required className={selectClass}>
            <option value="pirate_sighting">Pirate Sighting</option>
            <option value="route_hazard">Route Hazard</option>
            <option value="ganker_activity">Ganker Activity</option>
            <option value="sector_control">Sector Control</option>
            <option value="intel_tip">Intel Tip</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea name="description" rows={3} maxLength={1000} placeholder="Details of observation..." className={inputClass} />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className={labelClass}>Severity (1-5)</label>
          <select name="severity" required className={selectClass}>
            <option value="5">5 - Critical</option>
            <option value="4">4 - High</option>
            <option value="3" selected>3 - Medium</option>
            <option value="2">2 - Low</option>
            <option value="1">1 - Minimal</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Confidence</label>
          <select name="confidence" required className={selectClass}>
            <option value="confirmed">Confirmed</option>
            <option value="high">High</option>
            <option value="medium" selected>Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Location</label>
          <input name="locationName" maxLength={100} placeholder="Sector / AO" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Star System</label>
          <input name="starSystem" maxLength={60} placeholder="Stanton" className={inputClass} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelClass}>Hostile Group</label>
          <input name="hostileGroup" maxLength={80} placeholder="Unknown pirate cell" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Tags (comma-separated)</label>
          <input name="tags" maxLength={200} placeholder="PIRATES, CONVOY, INTERDICTION" className={inputClass} />
        </div>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
      >
        {isPending ? <LoaderCircle size={14} className="animate-spin" /> : null}
        File Report
      </button>
    </form>
  );
}
