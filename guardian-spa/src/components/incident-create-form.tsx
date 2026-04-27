import { useState } from "react";
import { AlertTriangle, LoaderCircle, Plus } from "lucide-react";

type SelectOption = { id: string; label: string; detail?: string | null };

export function IncidentCreateForm({ missionOptions, rescueOptions, onSuccess }: { missionOptions: SelectOption[]; rescueOptions: SelectOption[]; onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", category: "contact", severity: "3", status: "open", missionId: "", rescueId: "", summary: "", lessonsLearned: "", actionItems: "", publicSummary: "" });

  function updateField(field: keyof typeof form, value: string) { setForm((c) => ({ ...c, [field]: value })); }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, severity: Number(form.severity), missionId: form.missionId || undefined, rescueId: form.rescueId || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "Incident creation failed."); return; }
      setForm({ title: "", category: "contact", severity: "3", status: "open", missionId: "", rescueId: "", summary: "", lessonsLearned: "", actionItems: "", publicSummary: "" });
      onSuccess?.();
    } catch { setError("Incident creation failed."); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <input value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="Incident title" className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40 md:col-span-2" />
        <input value={form.category} onChange={(e) => updateField("category", e.target.value)} placeholder="Category" className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
        <select value={form.status} onChange={(e) => updateField("status", e.target.value)} className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40">
          <option value="open">Open</option>
          <option value="triage">Triage</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <input value={form.severity} onChange={(e) => updateField("severity", e.target.value)} type="number" min={1} max={5} placeholder="Severity" className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
        <select value={form.missionId} onChange={(e) => updateField("missionId", e.target.value)} className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40">
          <option value="">No mission link</option>
          {missionOptions.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
        </select>
        <select value={form.rescueId} onChange={(e) => updateField("rescueId", e.target.value)} className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40">
          <option value="">No rescue link</option>
          {rescueOptions.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
        </select>
      </div>
      <textarea value={form.summary} onChange={(e) => updateField("summary", e.target.value)} rows={3} placeholder="Summary" className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
      <textarea value={form.lessonsLearned} onChange={(e) => updateField("lessonsLearned", e.target.value)} rows={3} placeholder="Lessons learned" className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
      <textarea value={form.actionItems} onChange={(e) => updateField("actionItems", e.target.value)} rows={3} placeholder="Action items" className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
      <textarea value={form.publicSummary} onChange={(e) => updateField("publicSummary", e.target.value)} rows={2} placeholder="Public summary" className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
      <button type="button" disabled={loading} onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
        Create incident
      </button>
      {error ? <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"><AlertTriangle size={16} /><span>{error}</span></div> : null}
    </div>
  );
}
