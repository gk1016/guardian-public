import { useState } from "react";
import { AlertTriangle, LoaderCircle, Send } from "lucide-react";

type SelectOption = { id: string; label: string; detail?: string | null };

type QrfDispatchFormProps = {
  qrfId: string;
  missionOptions: SelectOption[];
  rescueOptions: SelectOption[];
  onSuccess?: () => void;
};

export function QrfDispatchForm({ qrfId, missionOptions, rescueOptions, onSuccess }: QrfDispatchFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    targetType: "rescue",
    missionId: missionOptions[0]?.id ?? "",
    rescueId: rescueOptions[0]?.id ?? "",
    notes: "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/qrf/${qrfId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          missionId: form.targetType === "mission" ? form.missionId : undefined,
          rescueId: form.targetType === "rescue" ? form.rescueId : undefined,
          notes: form.notes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "Dispatch failed."); return; }
      setForm((current) => ({ ...current, notes: "" }));
      onSuccess?.();
    } catch { setError("Dispatch failed."); }
    finally { setLoading(false); }
  }

  const activeOptions = form.targetType === "mission" ? missionOptions : rescueOptions;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <select value={form.targetType} onChange={(e) => updateField("targetType", e.target.value)} className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40">
          <option value="rescue">Rescue</option>
          <option value="mission">Mission</option>
        </select>
        <select value={form.targetType === "mission" ? form.missionId : form.rescueId} onChange={(e) => form.targetType === "mission" ? updateField("missionId", e.target.value) : updateField("rescueId", e.target.value)} className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40">
          {activeOptions.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}
        </select>
      </div>
      <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={3} placeholder="Dispatch notes" className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
      <button type="button" disabled={loading || activeOptions.length === 0} onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
        Dispatch asset
      </button>
      {error ? <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"><AlertTriangle size={16} /><span>{error}</span></div> : null}
    </div>
  );
}
