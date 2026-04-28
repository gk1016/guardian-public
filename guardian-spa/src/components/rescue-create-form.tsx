import { useState } from "react";
import { AlertTriangle, LoaderCircle, Plus } from "lucide-react";

export function RescueCreateForm({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    survivorHandle: "",
    locationName: "",
    urgency: "urgent",
    threatSummary: "",
    rescueNotes: "",
    survivorCondition: "",
    escortRequired: true,
    medicalRequired: true,
    offeredPayment: "",
  });

  function updateField(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/rescues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          offeredPayment: form.offeredPayment ? Number(form.offeredPayment) : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Rescue intake failed.");
        return;
      }
      setForm({
        survivorHandle: "",
        locationName: "",
        urgency: "urgent",
        threatSummary: "",
        rescueNotes: "",
        survivorCondition: "",
        escortRequired: true,
        medicalRequired: true,
        offeredPayment: "",
      });
      onSuccess?.();
    } catch {
      setError("Rescue intake failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-cyan)]";
  const textareaClass = "w-full rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-3 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-cyan)]";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <input value={form.survivorHandle} onChange={(e) => updateField("survivorHandle", e.target.value)} placeholder="Survivor handle" className={inputClass} />
        <input value={form.locationName} onChange={(e) => updateField("locationName", e.target.value)} placeholder="Location" className={inputClass} />
        <select value={form.urgency} onChange={(e) => updateField("urgency", e.target.value)} className={`${inputClass} uppercase tracking-[0.14em]`}>
          <option value="flash">Flash</option>
          <option value="urgent">Urgent</option>
          <option value="priority">Priority</option>
          <option value="routine">Routine</option>
        </select>
        <input value={form.offeredPayment} onChange={(e) => updateField("offeredPayment", e.target.value)} placeholder="Offered payment" type="number" min={0} className={inputClass} />
      </div>
      <textarea value={form.threatSummary} onChange={(e) => updateField("threatSummary", e.target.value)} rows={2} placeholder="Threat summary" className={textareaClass} />
      <textarea value={form.survivorCondition} onChange={(e) => updateField("survivorCondition", e.target.value)} rows={2} placeholder="Survivor condition" className={textareaClass} />
      <textarea value={form.rescueNotes} onChange={(e) => updateField("rescueNotes", e.target.value)} rows={2} placeholder="Rescue notes" className={textareaClass} />
      <div className="flex flex-wrap items-center gap-5 text-xs text-[var(--color-text-secondary)]">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={form.escortRequired} onChange={(e) => updateField("escortRequired", e.target.checked)} />
          Escort required
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={form.medicalRequired} onChange={(e) => updateField("medicalRequired", e.target.checked)} />
          Medical required
        </label>
      </div>
      <button type="button" disabled={loading} onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? <LoaderCircle size={12} className="animate-spin" /> : <Plus size={12} />}
        Open rescue
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
