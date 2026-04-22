"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Save } from "lucide-react";

type IncidentUpdateFormProps = {
  incidentId: string;
  initialIncident: {
    status: string;
    lessonsLearned: string | null;
    actionItems: string | null;
    publicSummary: string | null;
  };
};

export function IncidentUpdateForm({
  incidentId,
  initialIncident,
}: IncidentUpdateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    status: initialIncident.status,
    lessonsLearned: initialIncident.lessonsLearned ?? "",
    actionItems: initialIncident.actionItems ?? "",
    publicSummary: initialIncident.publicSummary ?? "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/incidents/${incidentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Incident update failed.");
          return;
        }
        router.refresh();
      } catch {
        setError("Incident update failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <select
        value={form.status}
        onChange={(event) => updateField("status", event.target.value)}
        className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
      >
        <option value="open">Open</option>
        <option value="triage">Triage</option>
        <option value="active">Active</option>
        <option value="closed">Closed</option>
        <option value="archived">Archived</option>
      </select>

      <textarea
        value={form.lessonsLearned}
        onChange={(event) => updateField("lessonsLearned", event.target.value)}
        rows={3}
        placeholder="Lessons learned"
        className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
      />
      <textarea
        value={form.actionItems}
        onChange={(event) => updateField("actionItems", event.target.value)}
        rows={3}
        placeholder="Action items"
        className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
      />
      <textarea
        value={form.publicSummary}
        onChange={(event) => updateField("publicSummary", event.target.value)}
        rows={2}
        placeholder="Public summary"
        className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
      />

      <button
        type="button"
        disabled={isPending}
        onClick={handleSubmit}
        className="inline-flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
        Update incident
      </button>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
