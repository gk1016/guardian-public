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
  const inputClass = "rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-cyan)]";
  const textareaClass = "w-full rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-3 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-cyan)]";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <select value={form.targetType} onChange={(e) => updateField("targetType", e.target.value)} className={`${inputClass} uppercase tracking-[0.14em]`}>
          <option value="rescue">Rescue</option>
          <option value="mission">Mission</option>
        </select>
        <select value={form.targetType === "mission" ? form.missionId : form.rescueId} onChange={(e) => form.targetType === "mission" ? updateField("missionId", e.target.value) : updateField("rescueId", e.target.value)} className={inputClass}>
          {activeOptions.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}
        </select>
      </div>
      <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={2} placeholder="Dispatch notes" className={textareaClass} />
      <button type="button" disabled={loading || activeOptions.length === 0} onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? <LoaderCircle size={12} className="animate-spin" /> : <Send size={12} />}
        Dispatch asset
      </button>
      {error ? (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
