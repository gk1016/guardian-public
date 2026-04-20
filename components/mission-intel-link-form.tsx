"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Link2, LoaderCircle } from "lucide-react";

type MissionIntelLinkFormProps = {
  missionId: string;
  availableIntel: {
    id: string;
    title: string;
    severity: number;
  }[];
};

export function MissionIntelLinkForm({
  missionId,
  availableIntel,
}: MissionIntelLinkFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [intelId, setIntelId] = useState(availableIntel[0]?.id ?? "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/missions/${missionId}/intel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intelId }),
        });

        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Intel linkage failed.");
          return;
        }

        router.refresh();
      } catch {
        setError("Intel linkage failed.");
      }
    });
  }

  if (availableIntel.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
        No unlinked intel reports remain for this sortie.
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Attach Intel Report</span>
        <select
          value={intelId}
          onChange={(event) => setIntelId(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
        >
          {availableIntel.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} / Severity {item.severity}
            </option>
          ))}
        </select>
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
        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Link2 size={16} />}
        {isPending ? "Linking intel" : "Link intel"}
      </button>
    </form>
  );
}
