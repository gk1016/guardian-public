"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Plus } from "lucide-react";

type SelectOption = {
  id: string;
  label: string;
  detail?: string | null;
};

type IncidentCreateFormProps = {
  missionOptions: SelectOption[];
  rescueOptions: SelectOption[];
};

export function IncidentCreateForm({
  missionOptions,
  rescueOptions,
}: IncidentCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "contact",
    severity: "3",
    status: "open",
    missionId: "",
    rescueId: "",
    summary: "",
    lessonsLearned: "",
    actionItems: "",
    publicSummary: "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/incidents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            severity: Number(form.severity),
            missionId: form.missionId || undefined,
            rescueId: form.rescueId || undefined,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Incident creation failed.");
          return;
        }
        setForm({
          title: "",
          category: "contact",
          severity: "3",
          status: "open",
          missionId: "",
          rescueId: "",
          summary: "",
          lessonsLearned: "",
          actionItems: "",
          publicSummary: "",
        });
        router.refresh();
      } catch {
        setError("Incident creation failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <input
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="Incident title"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40 md:col-span-2"
        />
        <input
          value={form.category}
          onChange={(event) => updateField("category", event.target.value)}
          placeholder="Category"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
        <select
          value={form.status}
          onChange={(event) => updateField("status", event.target.value)}
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        >
          <option value="open">Open</option>
          <option value="triage">Triage</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <input
          value={form.severity}
          onChange={(event) => updateField("severity", event.target.value)}
          type="number"
          min={1}
          max={5}
          placeholder="Severity"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
        <select
          value={form.missionId}
          onChange={(event) => updateField("missionId", event.target.value)}
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        >
          <option value="">No mission link</option>
          {missionOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={form.rescueId}
          onChange={(event) => updateField("rescueId", event.target.value)}
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        >
          <option value="">No rescue link</option>
          {rescueOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={form.summary}
        onChange={(event) => updateField("summary", event.target.value)}
        rows={3}
        placeholder="Summary"
        className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
      />
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
        className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
        Create incident
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
