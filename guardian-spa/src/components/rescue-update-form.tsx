import { useState } from "react";
import { AlertTriangle, LoaderCircle, Save } from "lucide-react";

type SelectOption = {
  id: string;
  label: string;
  detail?: string | null;
};

type RescueUpdateFormProps = {
  rescueId: string;
  initialRescue: {
    status: string;
    operatorId: string;
    survivorCondition: string | null;
    rescueNotes: string | null;
    outcomeSummary: string | null;
  };
  operatorOptions: SelectOption[];
  onSuccess?: () => void;
};

export function RescueUpdateForm({
  rescueId,
  initialRescue,
  operatorOptions,
  onSuccess,
}: RescueUpdateFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    status: initialRescue.status,
    operatorId: initialRescue.operatorId,
    survivorCondition: initialRescue.survivorCondition ?? "",
    rescueNotes: initialRescue.rescueNotes ?? "",
    outcomeSummary: initialRescue.outcomeSummary ?? "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/rescues/${rescueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Rescue update failed.");
        return;
      }
      onSuccess?.();
    } catch {
      setError("Rescue update failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-cyan)]";
  const textareaClass = "w-full rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-3 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-cyan)]";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <select value={form.status} onChange={(e) => updateField("status", e.target.value)} className={`${inputClass} uppercase tracking-[0.14em]`}>
          <option value="open">Open</option>
          <option value="dispatching">Dispatching</option>
          <option value="en_route">En Route</option>
          <option value="on_scene">On Scene</option>
          <option value="recovered">Recovered</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={form.operatorId} onChange={(e) => updateField("operatorId", e.target.value)} className={inputClass}>
          <option value="">Unassigned</option>
          {operatorOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>
      <textarea value={form.survivorCondition} onChange={(e) => updateField("survivorCondition", e.target.value)} rows={2} placeholder="Survivor condition" className={textareaClass} />
      <textarea value={form.rescueNotes} onChange={(e) => updateField("rescueNotes", e.target.value)} rows={2} placeholder="Rescue notes" className={textareaClass} />
      <textarea value={form.outcomeSummary} onChange={(e) => updateField("outcomeSummary", e.target.value)} rows={2} placeholder="Outcome summary" className={textareaClass} />
      <button type="button" disabled={loading} onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? <LoaderCircle size={12} className="animate-spin" /> : <Save size={12} />}
        Update rescue
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
